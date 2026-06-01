const { query } = require('../../config/db');

const repo = {
  async findAll(filters, { limit, offset, sort, order }) {
    let where = 'WHERE 1=1'; const params = []; let p = 1;
    if (filters.type) { where += ` AND p.product_type = $${p++}`; params.push(filters.type); }
    if (filters.category) { where += ` AND p.category = $${p++}`; params.push(filters.category); }
    if (filters.supplier_id) { where += ` AND p.supplier_id = $${p++}`; params.push(filters.supplier_id); }
    if (filters.status !== undefined) { where += ` AND p.is_active = $${p++}`; params.push(filters.status === 'active'); }
    if (filters.search) { where += ` AND (p.name ILIKE $${p} OR p.display_name ILIKE $${p} OR p.description ILIKE $${p} OR p.genus ILIKE $${p} OR p.hybrid_name ILIKE $${p})`; params.push(`%${filters.search}%`); p++; }
    if (filters.min_price) { where += ` AND p.base_price >= $${p++}`; params.push(filters.min_price); }
    if (filters.max_price) { where += ` AND p.base_price <= $${p++}`; params.push(filters.max_price); }

    const ct = await query(`SELECT COUNT(*) FROM products p ${where}`, params);
    const total = parseInt(ct.rows[0].count, 10);
    const sorts = { name: 'p.name', base_price: 'p.base_price', stock_qty: 'p.stock_qty', created_at: 'p.created_at' };
    const sortCol = sorts[sort] || 'p.created_at';
    const r = await query(
      `SELECT p.*, s.name as supplier_name, (SELECT url FROM product_images WHERE product_id = p.id AND is_primary = true LIMIT 1) as primary_image
       FROM products p LEFT JOIN suppliers s ON s.id = p.supplier_id ${where}
       ORDER BY ${sortCol} ${order} LIMIT $${p++} OFFSET $${p++}`,
      [...params, limit, offset]
    );
    return { rows: r.rows, total };
  },

  async findById(id) {
    const r = await query(`SELECT p.*, s.name as supplier_name FROM products p LEFT JOIN suppliers s ON s.id = p.supplier_id WHERE p.id = $1`, [id]);
    return r.rows[0] || null;
  },

  async findImages(productId) {
    const r = await query('SELECT * FROM product_images WHERE product_id = $1 ORDER BY sort_order, created_at', [productId]);
    return r.rows;
  },

  async findBulkTiers(productId) {
    const r = await query('SELECT * FROM product_bulk_tiers WHERE product_id = $1 ORDER BY min_qty ASC', [productId]);
    return r.rows;
  },

  async create(data) {
    const cols = ['name','display_name','description','product_type','category','genus','species','hybrid_name','color','supplier_id','base_price','unit','stock_qty','reorder_level','moq','is_active'];
    const vals = cols.map(c => data[c] !== undefined ? data[c] : null);
    const placeholders = cols.map((_, i) => `$${i + 1}`);
    const r = await query(
      `INSERT INTO products (${cols.join(',')}) VALUES (${placeholders.join(',')}) RETURNING *`,
      vals
    );
    return r.rows[0];
  },

  async update(id, data) {
    const keys = Object.keys(data); if (!keys.length) return null;
    const sets = keys.map((k, i) => `${k} = $${i + 2}`);
    const vals = keys.map(k => data[k]);
    const r = await query(`UPDATE products SET ${sets.join(',')}, updated_at = NOW() WHERE id = $1 RETURNING *`, [id, ...vals]);
    return r.rows[0];
  },

  async addImage(productId, data) {
    const r = await query(
      `INSERT INTO product_images (product_id, url, alt_text, is_primary, sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [productId, data.url, data.alt_text, data.is_primary || false, data.sort_order || 0]
    );
    return r.rows[0];
  },

  async updateImage(imageId, data) {
    const keys = Object.keys(data); if (!keys.length) return null;
    const sets = keys.map((k, i) => `${k} = $${i + 2}`);
    const vals = keys.map(k => data[k]);
    await query(`UPDATE product_images SET ${sets.join(',')} WHERE id = $1`, [imageId, ...vals]);
  },

  async clearPrimaryImages(productId) {
    await query('UPDATE product_images SET is_primary = false WHERE product_id = $1', [productId]);
  },

  async removeImage(imageId) {
    await query('DELETE FROM product_images WHERE id = $1', [imageId]);
  },

  async findImageById(imageId) {
    const r = await query('SELECT * FROM product_images WHERE id = $1', [imageId]);
    return r.rows[0] || null;
  },

  async createStockMovement(data) {
    const r = await query(
      `INSERT INTO stock_movements (product_id, movement_type, quantity, quantity_before, quantity_after, note, reference_type, reference_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [data.product_id, data.movement_type, data.quantity, data.quantity_before, data.quantity_after, data.note, data.reference_type, data.reference_id, data.created_by]
    );
    return r.rows[0];
  },

  async updateStock(client, productId, newQty) {
    await (client || query)(`UPDATE products SET stock_qty = $1, updated_at = NOW() WHERE id = $2`, [newQty, productId]);
  },

  async getStockMovements(productId, { limit, offset }) {
    const ct = await query('SELECT COUNT(*) FROM stock_movements WHERE product_id = $1', [productId]);
    const total = parseInt(ct.rows[0].count, 10);
    const r = await query('SELECT * FROM stock_movements WHERE product_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3', [productId, limit, offset]);
    return { rows: r.rows, total };
  },

  async createPriceChange(data) {
    const r = await query(
      `INSERT INTO price_changes (product_id, old_price, new_price, change_reason, changed_by, is_approved) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [data.product_id, data.old_price, data.new_price, data.reason, data.changed_by, data.is_approved !== false]
    );
    return r.rows[0];
  },

  async getPriceHistory(productId, { limit, offset }) {
    const ct = await query('SELECT COUNT(*) FROM price_changes WHERE product_id = $1', [productId]);
    const total = parseInt(ct.rows[0].count, 10);
    const r = await query(
      `SELECT pc.*, u.name as changed_by_name FROM price_changes pc LEFT JOIN users u ON u.id = pc.changed_by
       WHERE pc.product_id = $1 ORDER BY pc.created_at DESC LIMIT $2 OFFSET $3`,
      [productId, limit, offset]
    );
    return { rows: r.rows, total };
  },

  async countRecentPriceChanges(productId, hours = 24) {
    const r = await query(
      `SELECT COUNT(*) as count FROM price_changes WHERE product_id = $1 AND created_at > NOW() - INTERVAL '1 hour' * $2`,
      [productId, hours]
    );
    return parseInt(r.rows[0].count, 10);
  },
};

module.exports = repo;
