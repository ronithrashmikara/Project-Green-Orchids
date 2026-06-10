const { query } = require('../../config/db');
const repo = {
  async findCartItems(buyerId) {
    const r = await query(
      `SELECT ci.*, p.name, p.base_price, p.stock_qty, p.moq, p.is_active, p.unit,
              (SELECT url FROM product_images WHERE product_id = p.id AND is_primary = true LIMIT 1) as image_url
       FROM cart_items ci INNER JOIN products p ON p.id = ci.product_id
       WHERE ci.buyer_id = $1 ORDER BY ci.created_at`,
      [buyerId]
    );
    return r.rows;
  },
  async findCartItem(buyerId, productId) {
    const r = await query('SELECT * FROM cart_items WHERE buyer_id = $1 AND product_id = $2', [buyerId, productId]);
    return r.rows[0] || null;
  },
  async addOrUpdate(buyerId, productId, quantity) {
    const r = await query(
      `INSERT INTO cart_items (buyer_id, product_id, quantity) VALUES ($1,$2,$3)
       ON CONFLICT (buyer_id, product_id) DO UPDATE SET quantity = cart_items.quantity + $3, updated_at = NOW()
       RETURNING *`,
      [buyerId, productId, quantity]
    );
    return r.rows[0];
  },
  async setQuantity(buyerId, productId, quantity) {
    const r = await query(
      'UPDATE cart_items SET quantity = $1, updated_at = NOW() WHERE buyer_id = $2 AND product_id = $3 RETURNING *',
      [quantity, buyerId, productId]
    );
    return r.rows[0] || null;
  },
  async remove(buyerId, productId) {
    await query('DELETE FROM cart_items WHERE buyer_id = $1 AND product_id = $2', [buyerId, productId]);
  },
  async clear(buyerId) {
    await query('DELETE FROM cart_items WHERE buyer_id = $1', [buyerId]);
  },
};
module.exports = repo;
