const { query } = require('../../config/db');
const { v4: uuidv4 } = require('uuid');

const repo = {
  async accountIdForUser(userId) {
    const r = await query(`SELECT id FROM trade_accounts WHERE user_id = $1`, [userId]);
    return r.rows[0] || null;
  },
  async nextRfqNumber() {
    const r = await query("SELECT nextval('rfq_number_seq') as num");
    return `RFQ-${String(r.rows[0].num).padStart(6, '0')}`;
  },
  async create(client, data) {
    const r = await (client ? client.query.bind(client) : query)(
      `INSERT INTO rfqs (rfq_no, buyer_id, status, buyer_note) VALUES ($1,$2,'SUBMITTED',$3) RETURNING *`,
      [data.rfq_number, data.buyer_id, data.notes]
    );
    return r.rows[0];
  },
  async createItem(client, data) {
    const r = await (client ? client.query.bind(client) : query)(
      `INSERT INTO rfq_items (rfq_id, product_id, requested_qty) VALUES ($1,$2,$3) RETURNING *`,
      [data.rfq_id, data.product_id, data.quantity]
    );
    return r.rows[0];
  },
  async findAll(buyerId, isAdmin, { limit, offset, sort, order }) {
    let where = ''; const params = []; let p = 1;
    if (!isAdmin && buyerId) { where = `WHERE r.buyer_id = $${p++}`; params.push(buyerId); }
    const ct = await query(`SELECT COUNT(*) FROM rfqs r ${where}`, params);
    const total = parseInt(ct.rows[0].count, 10);
    const r = await query(
      `SELECT r.*, ta.business_name AS buyer_name FROM rfqs r
       LEFT JOIN trade_accounts ta ON ta.id = r.buyer_id
       ${where} ORDER BY r.${sort} ${order} LIMIT $${p++} OFFSET $${p++}`,
      [...params, limit, offset]
    );
    return { rows: r.rows, total };
  },
  async findById(id) {
    const r = await query(
      `SELECT r.*, ta.business_name AS buyer_name, u.email AS buyer_email
       FROM rfqs r
       LEFT JOIN trade_accounts ta ON ta.id = r.buyer_id
       LEFT JOIN users u ON u.id = ta.user_id
       WHERE r.id = $1`,
      [id]
    );
    return r.rows[0] || null;
  },
  async findItems(rfqId) {
    const r = await query(
      `SELECT ri.*, p.name as product_name, p.base_price as product_base_price, p.unit_size
       FROM rfq_items ri LEFT JOIN products p ON p.id = ri.product_id WHERE ri.rfq_id = $1 ORDER BY ri.created_at`,
      [rfqId]
    );
    return r.rows;
  },
  async updateStatus(client, id, status) {
    await (client ? client.query.bind(client) : query)(`UPDATE rfqs SET status = $1, updated_at = NOW() WHERE id = $2`, [status, id]);
  },
  async updateItemQuote(client, { itemId, quotedPrice }) {
    await (client ? client.query.bind(client) : query)('UPDATE rfq_items SET quoted_unit_price = $1 WHERE id = $2', [quotedPrice, itemId]);
  },
  async setQuoteExpiry(client, rfqId, expiry) {
    await (client ? client.query.bind(client) : query)('UPDATE rfqs SET quote_expiry = $1, updated_at = NOW() WHERE id = $2', [expiry, rfqId]);
  },
  async setDeclineReason(client, rfqId, reason) {
    await (client ? client.query.bind(client) : query)('UPDATE rfqs SET decline_reason = $1, updated_at = NOW() WHERE id = $2', [reason, rfqId]);
  },
};
module.exports = repo;
