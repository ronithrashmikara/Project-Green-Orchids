const buyersService = require('./buyers.service');

const buyersController = {
  async list(req, res, next) {
    try { const r = await buyersService.listBuyers(req.query); res.json({ success: true, ...r }); } catch (e) { next(e); }
  },
  async get(req, res, next) {
    try { const r = await buyersService.getBuyer(req.params.id); res.json({ success: true, data: r }); } catch (e) { next(e); }
  },
  async approve(req, res, next) {
    try { await buyersService.approve(req.params.id, req.body, req.user.id); res.json({ success: true, data: { message: 'Buyer approved' } }); } catch (e) { next(e); }
  },
  async reject(req, res, next) {
    try { await buyersService.reject(req.params.id, req.body.reason, req.user.id); res.json({ success: true, data: { message: 'Buyer rejected' } }); } catch (e) { next(e); }
  },
  async suspend(req, res, next) {
    try { await buyersService.suspend(req.params.id, req.body.reason, req.user.id); res.json({ success: true, data: { message: 'Buyer suspended' } }); } catch (e) { next(e); }
  },
  async reactivate(req, res, next) {
    try { await buyersService.reactivate(req.params.id, req.user.id); res.json({ success: true, data: { message: 'Buyer reactivated' } }); } catch (e) { next(e); }
  },
  async updateCredit(req, res, next) {
    try { await buyersService.updateCredit(req.params.id, req.body, req.user.id); res.json({ success: true, data: { message: 'Credit limit updated' } }); } catch (e) { next(e); }
  },
  async updateTier(req, res, next) {
    try { await buyersService.updateTier(req.params.id, req.body, req.user.id); res.json({ success: true, data: { message: 'Tier updated' } }); } catch (e) { next(e); }
  },
  async getOrders(req, res, next) {
    try { const r = await buyersService.getRelated(req.params.id, 'orders', req.query); res.json({ success: true, ...r }); } catch (e) { next(e); }
  },
  async getInvoices(req, res, next) {
    try { const r = await buyersService.getRelated(req.params.id, 'invoices', req.query); res.json({ success: true, ...r }); } catch (e) { next(e); }
  },
  async getPayments(req, res, next) {
    try { const r = await buyersService.getRelated(req.params.id, 'payments', req.query); res.json({ success: true, ...r }); } catch (e) { next(e); }
  },
  async getRMA(req, res, next) {
    try { const r = await buyersService.getRelated(req.params.id, 'rma', req.query); res.json({ success: true, ...r }); } catch (e) { next(e); }
  },
};
module.exports = buyersController;
