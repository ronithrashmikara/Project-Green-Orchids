const { query } = require('../../config/db');

const repo = {
  async findAll(filters, { limit, offset, sort, order }) {
    let where = 'WHERE 1=1'; const params = []; let p = 1;
    if (filters.type) { where += ` AND p.product_type = $${p++}`; params.push(filters.type); }
    if (filters.category) { where += ` AND c.name = $${p++}`; params.push(filters.category); }
    if (filters.supplier_id) { where += ` AND p.supplier_id = $${p++}`; params.push(filters.supplier_id); }
    if (filters.status) { where += ` AND p.status = $${p++}`; params.push(filters.status.toUpperCase()); }
    if (filters.search) { where += ` AND (p.name ILIKE $${p} OR p.description ILIKE $${p} OR p.sku ILIKE $${p})`; params.push(`%${filters.search}%`); p++; }
    if (filters.min_price) { where += ` AND p.base_price >= $${p++}`; params.push(filters.min_price); }
    if (filters.max_price) { where += ` AND p.base_price <= $${p++}`; params.push(filters.max_price); }

    const ct = await query(`SELECT COUNT(*) FROM products p LEFT JOIN categories c ON c.id = p.category_id ${where}`, params);
    const total = parseInt(ct.rows[0].count, 10);
    const sorts = { name: 'p.name', base_price: 'p.base_price', stock_qty: 'p.stock_qty', created_at: 'p.created_at' };
    const sortCol = sorts[sort] || 'p.created_at';
    const r = await query(
      `SELECT p.*, s.name as supplier_name, c.name as category_name, (SELECT url FROM product_images WHERE product_id = p.id AND is_primary = true LIMIT 1) as primary_image
       FROM products p LEFT JOIN suppliers s ON s.id = p.supplier_id LEFT JOIN categories c ON c.id = p.category_id ${where}
       ORDER BY ${sortCol} ${order} LIMIT $${p++} OFFSET $${p++}`,
      [...params, limit, offset]
    );
    return { rows: r.rows, total };
  },

  async findCategories() {
    const r = await query('SELECT id, name, parent_id, type FROM categories ORDER BY type, name');
    return r.rows;
  },

  async findById(id) {
    const r = await query(`SELECT p.*, s.name as supplier_name FROM products p LEFT JOIN suppliers s ON s.id = p.supplier_id WHERE p.id = $1`, [id]);
    return r.rows[0] || null;
  },

  async findImages(productId) {
    const r = await query('SELECT * FROM product_images WHERE product_id = $1 ORDER BY sort_order, created_at', [productId]);
    return r.rows;
  },

  async tierDiscountForUser(userId) {
    const r = await query(
      `SELECT COALESCE(bt.discount_rate,0) AS discount_rate
       FROM trade_accounts ta LEFT JOIN buyer_tiers bt ON bt.id = ta.tier_id
       WHERE ta.user_id = $1`,
      [userId]
    );
    return Number(r.rows[0]?.discount_rate || 0);
  },

  async findBulkTiers(productId) {
    const r = await query('SELECT * FROM bulk_pricing_tiers WHERE product_id = $1 ORDER BY min_quantity ASC', [productId]);
    return r.rows;
  },

async create(data) {
    const cols = ['sku', 'name', 'description', 'category_id', 'supplier_id', 'product_type', 'unit_size', 'base_price', 'moq', 'stock_qty', 'reorder_level', 'status', 'bloom_video_url'];
    const vals = cols.map(c => data[c] !== undefined ? data[c] : null);
    const placeholders = cols.map((_, i) => `$${i + 1}`);
    const r = await query(
      `INSERT INTO products (${cols.join(',')}) VALUES (${placeholders.join(',')}) RETURNING *`,
      vals
    );
    return r.rows[0];
  },

  async findBySku(sku) {
    const r = await query('SELECT id FROM products WHERE sku = $1', [sku]);
    return r.rows[0] || null;
  },

  async replaceBulkTiers(productId, tiers) {
    await query('DELETE FROM bulk_pricing_tiers WHERE product_id = $1', [productId]);
    for (const t of tiers) {
      await query(
        `INSERT INTO bulk_pricing_tiers (product_id, min_quantity, unit_price) VALUES ($1,$2,$3)`,
        [productId, t.min_quantity, t.unit_price]
      );
    }
  },

  async update(id, data) {
    const keys = Object.keys(data); if (!keys.length) return null;
    const sets = keys.map((k, i) => `${k} = $${i + 2}`);
    const vals = keys.map(k => data[k]);
    const r = await query(`UPDATE products SET ${sets.join(',')}, updated_at = NOW() WHERE id = $1 RETURNING *`, [id, ...vals]);
    return r.rows[0];
  },

  async bulkUpdateStatus(ids, status) {
    const r = await query(
      `UPDATE products SET status = $1, updated_at = NOW() WHERE id = ANY($2::int[]) RETURNING id`,
      [status, ids]
    );
    return r.rows.length;
  },

  // Soft delete - a hard DELETE would violate FK constraints from any product
  // with order/RFQ/stock history, so mark discontinued instead.
  async softRemove(id) {
    const r = await query(
      `UPDATE products SET status = 'DISCONTINUED', updated_at = NOW() WHERE id = $1 RETURNING id`,
      [id]
    );
    return r.rows[0] || null;
  },

  async duplicate(id) {
    const src = await query('SELECT * FROM products WHERE id = $1', [id]);
    if (!src.rows.length) return null;
    const p = src.rows[0];
    const sku = `${p.sku}-COPY-${Date.now().toString(36).toUpperCase()}`;
    const r = await query(
      `INSERT INTO products (sku, name, description, category_id, supplier_id, product_type, unit_size, base_price, moq, stock_qty, reorder_level, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,$10,'INACTIVE') RETURNING *`,
      [sku, `${p.name} (Copy)`, p.description, p.category_id, p.supplier_id, p.product_type, p.unit_size, p.base_price, p.moq, p.reorder_level]
    );
    return r.rows[0];
  },

  async findAllForExport(filters) {
    let where = 'WHERE 1=1'; const params = []; let p = 1;
    if (filters.status) { where += ` AND p.status = $${p++}`; params.push(filters.status.toUpperCase()); }
    const r = await query(
      `SELECT p.sku, p.name, c.name AS category, s.name AS supplier, p.product_type, p.unit_size,
              p.base_price, p.moq, p.stock_qty, p.reserved_qty, p.reorder_level, p.status
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN suppliers s ON s.id = p.supplier_id
       ${where} ORDER BY p.name`,
      params
    );
    return r.rows;
  },

  async addImage(productId, data) {
    const r = await query(
      `INSERT INTO product_images (product_id, url, is_primary, sort_order) VALUES ($1,$2,$3,$4) RETURNING *`,
      [productId, data.url, data.is_primary || false, data.sort_order || 0]
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

  // Accepts an optional tx client (Audit F8): the movement row must commit or
  // roll back together with the stock change it documents.
  async createStockMovement(client, data) {
    const r = await (client ? client.query.bind(client) : query)(
      `INSERT INTO stock_movements (product_id, movement_type, qty, note, ref_table, ref_id, performed_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [data.product_id, data.movement_type, data.quantity, data.note, data.reference_type, data.reference_id, data.created_by]
    );
    return r.rows[0];
  },

  async updateStock(client, productId, newQty) {
    await (client ? client.query.bind(client) : query)(`UPDATE products SET stock_qty = $1, updated_at = NOW() WHERE id = $2`, [newQty, productId]);
  },

  async getStockMovements(productId, { limit, offset }) {
    const ct = await query('SELECT COUNT(*) FROM stock_movements WHERE product_id = $1', [productId]);
    const total = parseInt(ct.rows[0].count, 10);
    const r = await query('SELECT * FROM stock_movements WHERE product_id = $1 ORDER BY occurred_at DESC LIMIT $2 OFFSET $3', [productId, limit, offset]);
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
