const { query } = require('../../config/db');

const BASE_SELECT = `
  SELECT c.*,
         bu.full_name AS buyer_name, bu.email AS buyer_email,
         au.full_name AS assignee_name, au.email AS assignee_email,
         o.order_no
  FROM complaints c
  LEFT JOIN users bu ON bu.id = c.buyer_id
  LEFT JOIN users au ON au.id = c.assigned_to
  LEFT JOIN orders o ON o.id = c.order_id`;

const repo = {
  async create(client, data) {
    const run = client ? client.query.bind(client) : query;
    const r = await run(
      `INSERT INTO complaints (buyer_id, order_id, subject, description, category, priority, assigned_to)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [data.buyer_id, data.order_id || null, data.subject, data.description,
       data.category, data.priority, data.assigned_to || null]
    );
    return r.rows[0];
  },
  async findById(id) {
    const r = await query(`${BASE_SELECT} WHERE c.id = $1`, [id]);
    return r.rows[0] || null;
  },
  async findMessages(complaintId) {
    const r = await query(
      `SELECT m.*, u.full_name AS author_name,
              CASE WHEN m.author_id = c.buyer_id THEN 'BUYER' ELSE 'STAFF' END AS author_type
       FROM complaint_messages m
       INNER JOIN complaints c ON c.id = m.complaint_id
       LEFT JOIN users u ON u.id = m.author_id
       WHERE m.complaint_id = $1 ORDER BY m.created_at ASC`,
      [complaintId]
    );
    return r.rows;
  },
  async addMessage(client, complaintId, authorId, body) {
    const run = client ? client.query.bind(client) : query;
    const r = await run(
      `INSERT INTO complaint_messages (complaint_id, author_id, body) VALUES ($1,$2,$3) RETURNING *`,
      [complaintId, authorId, body]
    );
    return r.rows[0];
  },
  async findAllForBuyer(buyerId, filters, { limit, offset }) {
    let where = 'WHERE c.buyer_id = $1'; const params = [buyerId]; let p = 2;
    if (filters.status) { where += ` AND c.status = $${p++}`; params.push(filters.status); }
    const ct = await query(`SELECT COUNT(*) FROM complaints c ${where}`, params);
    const total = parseInt(ct.rows[0].count, 10);
    const r = await query(
      `${BASE_SELECT} ${where} ORDER BY c.created_at DESC LIMIT $${p++} OFFSET $${p++}`,
      [...params, limit, offset]
    );
    return { rows: r.rows, total };
  },
  async findAll(filters, { limit, offset }) {
    let where = 'WHERE 1=1'; const params = []; let p = 1;
    if (filters.status) { where += ` AND c.status = $${p++}`; params.push(filters.status); }
    const ct = await query(`SELECT COUNT(*) FROM complaints c ${where}`, params);
    const total = parseInt(ct.rows[0].count, 10);
    const r = await query(
      `${BASE_SELECT} ${where} ORDER BY c.created_at DESC LIMIT $${p++} OFFSET $${p++}`,
      [...params, limit, offset]
    );
    return { rows: r.rows, total };
  },
  // Staff queue: complaints assigned to me + unassigned (claimable) ones.
  async findQueue(userId, filters, { limit, offset }) {
    let where = 'WHERE 1=1'; const params = []; let p = 1;
    const assigned = filters.assigned || 'queue';
    if (assigned === 'me') { where += ` AND c.assigned_to = $${p++}`; params.push(userId); }
    else if (assigned === 'unassigned') { where += ' AND c.assigned_to IS NULL'; }
    else if (assigned !== 'all') { where += ` AND (c.assigned_to = $${p++} OR c.assigned_to IS NULL)`; params.push(userId); }
    if (filters.status) { where += ` AND c.status = $${p++}`; params.push(filters.status); }
    else { where += ` AND c.status IN ('OPEN','IN_PROGRESS')`; }
    const ct = await query(`SELECT COUNT(*) FROM complaints c ${where}`, params);
    const total = parseInt(ct.rows[0].count, 10);
    const r = await query(
      `${BASE_SELECT} ${where}
       ORDER BY CASE c.priority WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 ELSE 2 END, c.created_at ASC
       LIMIT $${p++} OFFSET $${p++}`,
      [...params, limit, offset]
    );
    return { rows: r.rows, total };
  },
  // Locks the complaint row so concurrent claim/transition calls serialize
  // (same FINDING-S01 pattern the rma/orders modules use).
  async lockForUpdate(client, id) {
    const r = await client.query('SELECT * FROM complaints WHERE id = $1 FOR UPDATE', [id]);
    return r.rows[0] || null;
  },
  async update(client, id, data) {
    const keys = Object.keys(data); if (!keys.length) return null;
    const sets = keys.map((k, i) => `${k}=$${i + 2}`); const vals = keys.map(k => data[k]);
    const run = client ? client.query.bind(client) : query;
    const r = await run(
      `UPDATE complaints SET ${sets.join(',')}, updated_at=NOW() WHERE id=$1 RETURNING *`,
      [id, ...vals]
    );
    return r.rows[0] || null;
  },
  async isStaffAssignable(userId) {
    const r = await query(
      `SELECT 1 FROM users u INNER JOIN roles ro ON ro.id = u.role_id
       WHERE u.id = $1 AND u.status = 'ACTIVE' AND ro.name IN ('SALES_MANAGER','ADMIN')`,
      [userId]
    );
    return r.rows.length > 0;
  },
  // Ownership check for complaints raised against an order: orders.buyer_id is a
  // trade_accounts.id, complaints.buyer_id is a users.id — join through.
  async orderBelongsToUser(orderId, userId) {
    const r = await query(
      `SELECT 1 FROM orders o INNER JOIN trade_accounts ta ON ta.id = o.buyer_id
       WHERE o.id = $1 AND ta.user_id = $2`,
      [orderId, userId]
    );
    return r.rows.length > 0;
  },
};
module.exports = repo;
