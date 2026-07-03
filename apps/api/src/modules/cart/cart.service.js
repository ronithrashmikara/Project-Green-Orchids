const { AppError } = require('../../middleware/errors');
const repo = require('./cart.repository');
const { calculateLineTotal } = require('../../utils/money');

async function resolveAccountId(userId) {
  const acct = await repo.accountIdForUser(userId);
  if (!acct) throw new AppError('NO_ACCOUNT', 'No trade account for this user', 403);
  return acct.id;
}

const service = {
  async getCart(userId) {
    const buyerId = await resolveAccountId(userId);
    const [items, discount] = await Promise.all([
      repo.findCartItems(buyerId),
      repo.tierDiscountForAccount(buyerId),
    ]);
    const cartItems = items.map(item => {
      const basePrice = Number(item.base_price);
      const tierPrice = Number((basePrice * (1 - discount / 100)).toFixed(2));
      return {
        ...item,
        base_price: basePrice,
        tier_price: tierPrice,
        line_total: calculateLineTotal(item.quantity, tierPrice),
      };
    });
    const subtotal = cartItems.reduce((s, i) => s + Number(i.base_price) * i.quantity, 0);
    const tierSubtotal = cartItems.reduce((s, i) => s + i.line_total, 0);
    const itemCount = cartItems.reduce((s, i) => s + i.quantity, 0);
    return { items: cartItems, subtotal, tier_subtotal: tierSubtotal, savings: subtotal - tierSubtotal, item_count: itemCount, discount };
  },

  async addItem(userId, data) {
    const buyerId = await resolveAccountId(userId);
    const items = await repo.findCartItems(buyerId);
    const existing = items.find(i => i.product_id === data.product_id);

    // Enforce MOQ and available stock at the point the buyer adds/increases quantity, not just
    // at order submission (Finding: a below-MOQ or over-stock quantity could sit in the cart
    // indefinitely and only got caught at checkout, discarding the buyer's progress). The old
    // stock check here only ever looked at `existing`, so it silently did nothing for a
    // brand-new cart line — any quantity of an out-of-stock product could be added.
    const product = await repo.findProductBasics(data.product_id);
    if (!product) throw new AppError('NOT_FOUND', 'Product not found', 404);
    const totalQty = (existing?.quantity || 0) + data.quantity;
    if (totalQty < product.moq) {
      throw new AppError('BELOW_MOQ', `${product.name} minimum order is ${product.moq}`, 400);
    }
    const available = Number(product.stock_qty) - Number(product.reserved_qty || 0);
    if (totalQty > available) {
      throw new AppError('INSUFFICIENT_STOCK', `Only ${available} available`, 400);
    }

    const item = await repo.addOrUpdate(buyerId, data.product_id, data.quantity);
    return item;
  },

  async updateItem(userId, productId, quantity) {
    const buyerId = await resolveAccountId(userId);
    if (quantity === 0) {
      await repo.remove(buyerId, productId);
      return null;
    }
    const product = await repo.findProductBasics(productId);
    if (product && quantity < product.moq) {
      throw new AppError('BELOW_MOQ', `${product.name} minimum order is ${product.moq}`, 400);
    }
    const item = await repo.setQuantity(buyerId, productId, quantity);
    if (!item) throw new AppError('NOT_FOUND', 'Cart item not found', 404);
    return item;
  },

  async removeItem(userId, productId) {
    const buyerId = await resolveAccountId(userId);
    await repo.remove(buyerId, productId);
  },

  async clearCart(userId) {
    const buyerId = await resolveAccountId(userId);
    await repo.clear(buyerId);
  },
};
module.exports = service;
