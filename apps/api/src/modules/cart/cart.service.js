const { AppError } = require('../../middleware/errors');
const repo = require('./cart.repository');
const { calculateLineTotal } = require('../../utils/money');

const service = {
  async getCart(buyerId) {
    const items = await repo.findCartItems(buyerId);
    const cartItems = items.map(item => ({
      ...item,
      line_total: calculateLineTotal(item.quantity, item.base_price),
    }));
    const subtotal = cartItems.reduce((s, i) => s + i.line_total, 0);
    const itemCount = cartItems.reduce((s, i) => s + i.quantity, 0);
    return { items: cartItems, subtotal, item_count: itemCount };
  },

  async addItem(buyerId, data) {
    const items = await repo.findCartItems(buyerId);
    const existing = items.find(i => i.product_id === data.product_id);

    // Validate MOQ and stock
    const product = existing || (await repo.findCartItems(buyerId)).find(i => i.product_id === data.product_id);
    if (existing && existing.quantity + data.quantity > existing.stock_qty) {
      throw new AppError('INSUFFICIENT_STOCK', `Only ${existing.stock_qty} available`, 400);
    }

    const item = await repo.addOrUpdate(buyerId, data.product_id, data.quantity);
    return item;
  },

  async updateItem(buyerId, productId, quantity) {
    if (quantity === 0) {
      await repo.remove(buyerId, productId);
      return null;
    }
    const item = await repo.setQuantity(buyerId, productId, quantity);
    if (!item) throw new AppError('NOT_FOUND', 'Cart item not found', 404);
    return item;
  },

  async removeItem(buyerId, productId) {
    await repo.remove(buyerId, productId);
  },

  async clearCart(buyerId) {
    await repo.clear(buyerId);
  },
};
module.exports = service;
