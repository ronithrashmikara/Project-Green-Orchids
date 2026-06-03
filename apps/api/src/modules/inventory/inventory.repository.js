const { query } = require('../../config/db');
const repo = {
  async findMovements(filters, { limit, offset }) {
    let where = 'WHERE 1=1'; const params = []; let p = 1;
    if (filters.product_id) { where += ` AND sm.product_id = $${p++}`; params.push(filters.product_id); }
    if (filters.movement_type) { where += ` AND sm.movement_type = $${p++}`; params.push(filters.movement_type); }
    if (filters.from) { where += ` AND sm.created_at >= $${p++}`; params.push(filters.from); }
    if (filters.to) { where += ` AND sm.created_at <= $${p++}`; params.push(filters.to); }
    const ct = await query(`SELECT COUNT(*) FROM stock_movements sm ${where}`, params);
    const total = parseInt(ct.rows[0].count, 10);
    const r = await query(
      `SELECT sm.*, p.name as product_name FROM stock_movements sm LEFT JOIN products p ON p.id = sm.product_id ${where}
       ORDER BY sm.created_at DESC LIMIT $${p++} OFFSET $${p++}`,
      [...params, limit, offset]
    );
    return { rows: r.rows, total };
  },
  async findAlerts(filters, { limit, offset }) {
    let where = 'WHERE 1=1'; const params = []; let p = 1;
    if (filters.status) { where += ` AND sa.status = $${p++}`; params.push(filters.status); }
    const ct = await query(`SELECT COUNT(*) FROM stock_alerts sa ${where}`, params);
    const total = parseInt(ct.rows[0].count, 10);
    const r = await query(
      `SELECT sa.*, p.name as product_name, p.stock_qty, p.reorder_level FROM stock_alerts sa
       LEFT JOIN products p ON p.id = sa.product_id ${where} ORDER BY sa.created_at DESC LIMIT $${p++} OFFSET $${p++}`,
      [...params, limit, offset]
    );
    return { rows: r.rows, total };
  },
  async ackAlert(id, actor, note) {
    await query('UPDATE stock_alerts SET status=$1, acknowledged_by=$2, acknowledged_at=NOW(), notes=COALESCE($3, notes) WHERE id=$4', ['ACKNOWLEDGED', actor, note, id]);
  },
  async getSummary() {
    const r = await query(
      `SELECT COUNT(*) as total_products,
              COUNT(CASE WHEN stock_qty <= 0 THEN 1 END) as out_of_stock,
              COUNT(CASE WHEN stock_qty <= reorder_level AND stock_qty > 0 THEN 1 END) as low_stock,
              SUM(stock_qty) as total_stock,
              COUNT(CASE WHEN is_active = true THEN 1 END) as active_products
       FROM products`
    );
    return r.rows[0];
  },
  async findMovementsForExport(filters) {
    let where = 'WHERE 1=1'; const params = []; let p = 1;
    if (filters.product_id) { where += ` AND product_id = $${p++}`; params.push(filters.product_id); }
    if (filters.movement_type) { where += ` AND movement_type = $${p++}`; params.push(filters.movement_type); }
    if (filters.from) { where += ` AND created_at >= $${p++}`; params.push(filters.from); }
    if (filters.to) { where += ` AND created_at <= $${p++}`; params.push(filters.to); }
    const r = await query(
      `SELECT sm.*, p.name as product_name FROM stock_movements sm LEFT JOIN products p ON p.id = sm.product_id ${where} ORDER BY sm.created_at DESC LIMIT 10000`,
      params
    );
    return r.rows;
  },
};
module.exports = repo;
