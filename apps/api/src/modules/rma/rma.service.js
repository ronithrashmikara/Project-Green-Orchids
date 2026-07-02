const { tx, query } = require('../../config/db');
const { sendMail } = require('../../config/mailer');
const { AppError } = require('../../middleware/errors');
const { writeAudit } = require('../../middleware/audit');
const { assertTransition } = require('../../utils/stateMachine');
const { paginate } = require('../../utils/pagination');
const repo = require('./rma.repository');

async function resolveAccountId(userId) {
  const acct = await repo.accountIdForUser(userId);
  if (!acct) throw new AppError('NO_ACCOUNT', 'No trade account for this user', 403);
  return acct.id;
}

async function notifyBuyer(buyerAccountId, subject, template, data) {
  try {
    const u = await query(
      `SELECT u.full_name AS name, u.email FROM trade_accounts ta JOIN users u ON u.id = ta.user_id WHERE ta.id = $1`,
      [buyerAccountId]
    );
    if (u.rows.length) await sendMail({ to: u.rows[0].email, subject, template, data: { name: u.rows[0].name, ...data } });
  } catch (_) { /* best-effort */ }
}

const service = {
  async create(data, userId) {
    const buyerId = await resolveAccountId(userId);
    const rmaNo = await repo.nextRmaNumber();
    const rma = await repo.create(null, {
      rma_no: rmaNo,
      order_id: data.order_id,
      order_item_id: data.order_item_id,
      quantity: data.quantity,
      buyer_id: buyerId,
      reason_category: data.return_type,
      reason_detail: data.reason,
    });
    await notifyBuyer(buyerId, 'RMA Received', 'rma_received', { rmaNumber: rmaNo, reason: data.reason });
    return rma;
  },

  async list(queryParams, userId, isAdmin) {
    const o = paginate(queryParams);
    const buyerId = isAdmin ? null : await resolveAccountId(userId);
    const { rows, total } = await repo.findAll(buyerId, isAdmin, o);
    return { data: rows, pagination: { page: o.page, limit: o.limit, total, pages: Math.ceil(total / o.limit) } };
  },

  async get(id, userId, isAdmin) {
    const r = await repo.findById(id);
    if (!r) throw new AppError('NOT_FOUND', 'RMA not found', 404);
    if (!isAdmin) {
      const buyerId = await resolveAccountId(userId);
      if (r.buyer_id !== buyerId) throw new AppError('FORBIDDEN', 'Access denied', 403);
    }
    return r;
  },

  async approve(id, actor, role) {
    const r = await repo.findById(id);
    if (!r) throw new AppError('NOT_FOUND', 'RMA not found', 404);
    assertTransition('RMA', r.status, 'APPROVED', role);
    await tx(async (client) => {
      await repo.updateStatus(client, id, 'APPROVED');
      await client.query(`UPDATE rma_requests SET decided_by = $1, decided_at = NOW() WHERE id = $2`, [actor, id]);
      await writeAudit({ actor, action: 'RMA_APPROVED', entity: 'rma_requests', entityId: String(id) }, client);
    });
    await notifyBuyer(r.buyer_id, 'RMA Approved', 'rma_decision', { rmaNumber: r.rma_no, decision: 'approved' });
  },

  async reject(id, data, actor, role) {
    const r = await repo.findById(id);
    if (!r) throw new AppError('NOT_FOUND', 'RMA not found', 404);
    assertTransition('RMA', r.status, 'REJECTED', role);
    await tx(async (client) => {
      await repo.updateStatus(client, id, 'REJECTED');
      await client.query(`UPDATE rma_requests SET decided_by = $1, decided_at = NOW(), resolution = $2 WHERE id = $3`, [actor, data.reason, id]);
      await writeAudit({ actor, action: 'RMA_REJECTED', entity: 'rma_requests', entityId: String(id), after: { reason: data.reason } }, client);
    });
    await notifyBuyer(r.buyer_id, 'RMA Declined', 'rma_decision', { rmaNumber: r.rma_no, decision: 'declined', reason: data.reason });
  },

  async receive(id, data, actor, role) {
    const r = await repo.findById(id);
    if (!r) throw new AppError('NOT_FOUND', 'RMA not found', 404);
    assertTransition('RMA', r.status, 'ITEM_RECEIVED', role);

    await tx(async (client) => {
      await repo.updateStatus(client, id, 'ITEM_RECEIVED');
      await client.query(`UPDATE rma_requests SET inventory_adjustment_note = $1 WHERE id = $2`, [data.notes || data.disposition, id]);

      const movType = data.disposition === 'WRITE_OFF' ? 'DAMAGE_WRITE_OFF' : 'RMA_RETURN';
      for (const item of r.items) {
        await client.query(
          `INSERT INTO stock_movements (product_id, movement_type, qty, note, ref_table, ref_id, performed_by)
           SELECT oi.product_id, $1, $2, $3, 'rma_requests', $4, $5 FROM order_items oi WHERE oi.id = $6`,
          [movType, item.qty, data.notes || null, String(id), actor, item.order_item_id]
        );
        if (data.disposition !== 'WRITE_OFF') {
          await client.query(
            `UPDATE products SET stock_qty = stock_qty + $1, updated_at = NOW()
             WHERE id = (SELECT product_id FROM order_items WHERE id = $2)`,
            [item.qty, item.order_item_id]
          );
        }
      }
      await writeAudit({ actor, action: 'RMA_ITEM_RECEIVED', entity: 'rma_requests', entityId: String(id), after: { disposition: data.disposition } }, client);
    });
  },

  async resolve(id, data, actor, role) {
    const r = await repo.findById(id);
    if (!r) throw new AppError('NOT_FOUND', 'RMA not found', 404);
    assertTransition('RMA', r.status, 'RESOLVED', role);

    await tx(async (client) => {
      await repo.updateStatus(client, id, 'RESOLVED');
      await client.query(`UPDATE rma_requests SET resolution = $1 WHERE id = $2`, [data.resolution, id]);

      if (data.adjustment_amount > 0) {
        const invoice = await client.query('SELECT id FROM invoices WHERE order_id = $1 LIMIT 1', [r.order_id]);
        if (invoice.rows.length) {
          await client.query(
            `INSERT INTO invoice_adjustments (invoice_id, amount, reason, rma_id, created_by)
             VALUES ($1, $2, $3, $4, $5)`,
            [invoice.rows[0].id, data.adjustment_amount, data.notes || 'RMA Resolution', id, actor]
          );
          await client.query(`UPDATE rma_requests SET invoice_adjustment_note = $1 WHERE id = $2`, [`Credit note ${data.adjustment_amount}`, id]);
        }
      }
      await writeAudit({ actor, action: 'RMA_RESOLVED', entity: 'rma_requests', entityId: String(id), after: { resolution: data.resolution } }, client);
    });
    await notifyBuyer(r.buyer_id, 'RMA Resolved', 'rma_resolved', { rmaNumber: r.rma_no, resolution: data.resolution, adjustmentAmount: data.adjustment_amount || 0 });
  },
};
module.exports = service;
