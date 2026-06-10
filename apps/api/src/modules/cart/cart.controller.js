const s = require('./cart.service');
module.exports = {
  get: async (r, res, n) => { try { const d = await s.getCart(r.user.id); res.json({ success: true, data: d }); } catch (e) { n(e); } },
  addItem: async (r, res, n) => { try { const d = await s.addItem(r.user.id, r.body); res.status(201).json({ success: true, data: d }); } catch (e) { n(e); } },
  updateItem: async (r, res, n) => { try { const d = await s.updateItem(r.user.id, r.params.productId, r.body.quantity); res.json({ success: true, data: d }); } catch (e) { n(e); } },
  removeItem: async (r, res, n) => { try { await s.removeItem(r.user.id, r.params.productId); res.json({ success: true, data: { message: 'Item removed' } }); } catch (e) { n(e); } },
  clear: async (r, res, n) => { try { await s.clearCart(r.user.id); res.json({ success: true, data: { message: 'Cart cleared' } }); } catch (e) { n(e); } },
};
