const { pool } = require('../../config/db');

async function list({ assignedTo, status, buyerUserId } = {}) {
  const conds = [], vals = [];
  if (assignedTo) { conds.push(`d.assigned_to = $${vals.length+1}`); vals.push(assignedTo); }
  if (status)     { conds.push(`d.status = $${vals.length+1}`);      vals.push(status); }
  if (buyerUserId) { conds.push(`ta.user_id = $${vals.length+1}`); vals.push(buyerUserId); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const { rows } = await pool.query(`
    SELECT d.*, o.order_no AS reference_number, u.full_name AS assigned_name
    FROM deliveries d
    JOIN orders o ON o.id = d.order_id
    JOIN trade_accounts ta ON ta.id = o.buyer_id
    LEFT JOIN users u ON u.id = d.assigned_to
    ${where}
    ORDER BY d.updated_at DESC
    LIMIT 100
  `, vals);
  return rows;
}

async function getById(id) {
  const { rows } = await pool.query(`
    SELECT d.*, o.order_no AS reference_number, u.full_name AS assigned_name,
           ta.user_id AS buyer_user_id
    FROM deliveries d
    JOIN orders o ON o.id = d.order_id
    JOIN trade_accounts ta ON ta.id = o.buyer_id
    LEFT JOIN users u ON u.id = d.assigned_to
    WHERE d.id = $1
  `, [id]);
  return rows[0] || null;
}

async function getByOrderId(orderId) {
  const { rows } = await pool.query(
    `SELECT d.*, o.order_no AS reference_number FROM deliveries d
     JOIN orders o ON o.id = d.order_id WHERE d.order_id = $1`,
    [orderId],
  );
  return rows[0] || null;
}

async function create(orderId) {
  const { rows } = await pool.query(
    `INSERT INTO deliveries (order_id) VALUES ($1)
     ON CONFLICT (order_id) DO NOTHING
     RETURNING *`,
    [orderId],
  );
  return rows[0];
}

async function findActiveCoordinator(userId) {
  const { rows } = await pool.query(
    `SELECT u.id FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1 AND u.status = 'ACTIVE' AND r.name = 'DELIVERY_COORDINATOR'`,
    [userId],
  );
  return rows[0] || null;
}

async function assign(id, assignedTo, actorId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE deliveries SET assigned_to = $1, status = 'ASSIGNED', updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [assignedTo, id],
    );
    await client.query(
      `INSERT INTO delivery_events (delivery_id, status, note, actor_id)
       VALUES ($1, 'ASSIGNED', 'Assigned to staff', $2)`,
      [id, actorId],
    );
    await client.query('COMMIT');
    return rows[0];
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}

// Stock helpers (Audit F2): a reservation made at order approval becomes a
// physical stock-out when goods actually leave the warehouse (DISPATCHED), with
// an ORDER_FULFILL ledger row per line. A failed delivery brings the goods
// back (restock + STOCKTAKE_CORRECTION); cancelling before dispatch releases
// the reservation (ORDER_RELEASE) without touching physical stock.
async function convertReservationToStockOut(client, orderId, actorId) {
  const { rows: items } = await client.query(
    `SELECT oi.product_id, oi.qty FROM order_items oi WHERE oi.order_id = $1`,
    [orderId],
  );
  for (const item of items) {
    await client.query(
      `UPDATE products SET stock_qty = stock_qty - $1, reserved_qty = GREATEST(reserved_qty - $1, 0), updated_at = NOW() WHERE id = $2`,
      [item.qty, item.product_id],
    );
    await client.query(
      `INSERT INTO stock_movements (product_id, movement_type, qty, ref_table, ref_id, performed_by, note)
       VALUES ($1, 'ORDER_FULFILL', $2, 'orders', $3, $4, $5)`,
      [item.product_id, item.qty, String(orderId), actorId || null, `Dispatched to customer`],
    );
  }
}

async function restockFailedDelivery(client, orderId, note, actorId) {
  const { rows: items } = await client.query(
    `SELECT oi.product_id, oi.qty FROM order_items oi WHERE oi.order_id = $1`,
    [orderId],
  );
  for (const item of items) {
    await client.query(
      `UPDATE products SET stock_qty = stock_qty + $1, updated_at = NOW() WHERE id = $2`,
      [item.qty, item.product_id],
    );
    await client.query(
      `INSERT INTO stock_movements (product_id, movement_type, qty, ref_table, ref_id, performed_by, note)
       VALUES ($1, 'STOCKTAKE_CORRECTION', $2, 'orders', $3, $4, $5)`,
      [item.product_id, item.qty, String(orderId), actorId || null, note ? `Delivery failed — returned to warehouse: ${note}` : 'Delivery failed — returned to warehouse'],
    );
  }
}

async function releaseReservations(client, orderId, actorId) {
  const { rows: items } = await client.query(
    `SELECT oi.product_id, oi.qty FROM order_items oi WHERE oi.order_id = $1`,
    [orderId],
  );
  for (const item of items) {
    await client.query(
      `UPDATE products SET reserved_qty = GREATEST(reserved_qty - $1, 0), updated_at = NOW() WHERE id = $2`,
      [item.qty, item.product_id],
    );
    await client.query(
      `INSERT INTO stock_movements (product_id, movement_type, qty, ref_table, ref_id, performed_by, note)
       VALUES ($1, 'ORDER_RELEASE', $2, 'orders', $3, $4, $5)`,
      [item.product_id, item.qty, String(orderId), actorId || null, 'Delivery cancelled before dispatch'],
    );
  }
}

async function transition(id, status, { note, podUrl, actorId } = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Lock the delivery row so concurrent transitions serialize here and we can
    // see the true pre-transition status instead of a stale service-layer read.
    const cur = await client.query('SELECT * FROM deliveries WHERE id = $1 FOR UPDATE', [id]);
    if (!cur.rows.length) throw Object.assign(new Error('Delivery not found'), { status: 404 });
    const previousStatus = cur.rows[0].status;
    const leftWarehouse = ['DISPATCHED', 'IN_TRANSIT', 'DELIVERED'].includes(previousStatus);

    const sets = ['status = $1', 'updated_at = NOW()'];
    const vals = [status];
    if (status === 'DISPATCHED') { sets.push('dispatch_date = NOW()'); }
    if (podUrl) { vals.push(podUrl); sets.push(`pod_url = $${vals.length}`, 'pod_uploaded_at = NOW()'); }
    // buyer_confirmed_at is NOT set here — POD upload means "delivered", not
    // "the buyer confirmed it". That's a separate, buyer-initiated action
    // (see orders.service.js confirmReceipt(), which sets this field for real).
    if (note && status === 'FAILED') { vals.push(note); sets.push(`failure_note = $${vals.length}`); }
    vals.push(id);
    const { rows } = await client.query(
      `UPDATE deliveries SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`,
      vals,
    );
    await client.query(
      `INSERT INTO delivery_events (delivery_id, status, note, actor_id) VALUES ($1, $2, $3, $4)`,
      [id, status, note || null, actorId || null],
    );

    // Order sync is conditional: never resurrect a CANCELLED/CLOSED/REJECTED order
    // just because a stale delivery row moved (Audit P1-11).
    const orderId = rows[0].order_id;
    if (status === 'DISPATCHED') {
      await client.query(
        `UPDATE orders SET status = 'DISPATCHED', updated_at = NOW() WHERE id = $1 AND status IN ('APPROVED', 'DISPATCHED')`,
        [orderId],
      );
      await convertReservationToStockOut(client, orderId, actorId);
    }
    if (status === 'DELIVERED') {
      await client.query(
        `UPDATE orders SET status = 'DELIVERED', updated_at = NOW() WHERE id = $1 AND status IN ('APPROVED', 'DISPATCHED')`,
        [orderId],
      );
    }
    if (status === 'FAILED' && leftWarehouse) {
      await restockFailedDelivery(client, orderId, note, actorId);
    }
    if (status === 'CANCELLED' && !leftWarehouse) {
      await releaseReservations(client, orderId, actorId);
    }

    await client.query('COMMIT');
    return rows[0];
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}

async function events(deliveryId) {
  const { rows } = await pool.query(
    `SELECT de.*, u.full_name AS actor_name
     FROM delivery_events de
     LEFT JOIN users u ON u.id = de.actor_id
     WHERE de.delivery_id = $1
     ORDER BY de.occurred_at ASC`,
    [deliveryId],
  );
  return rows;
}

module.exports = { list, getById, getByOrderId, create, findActiveCoordinator, assign, transition, events };
