const s = require('./orders.service');
// "Admin view" = holds the all-orders permission (codes, not invented role names) — Findings 16/21
const isAdmin = (user) => user.permissions.includes('order.view.all') || user.permissions.includes('order.approve');
module.exports = {
  create: async (r, res, n) => { try { const d = await s.createFromCart(r.user.id, r.body); res.status(201).json({ success: true, data: d }); } catch (e) { n(e); } },
  createFromRfq: async (r, res, n) => { try { const d = await s.createFromRfq(r.user.id, r.body.rfq_id); res.status(201).json({ success: true, data: d }); } catch (e) { n(e); } },
  list: async (r, res, n) => { try { const d = await s.list(r.query, r.user.id, isAdmin(r.user)); res.json({ success: true, ...d }); } catch (e) { n(e); } },
  get: async (r, res, n) => { try { const d = await s.get(r.params.id, r.user.id, isAdmin(r.user)); res.json({ success: true, data: d }); } catch (e) { n(e); } },
  claim: async (r, res, n) => { try { const d = await s.claim(r.params.id, r.user.id); res.json({ success: true, data: d }); } catch (e) { n(e); } },
  approve: async (r, res, n) => { try { await s.approve(r.params.id, r.user.id); res.json({ success: true, data: { message: 'Order approved' } }); } catch (e) { n(e); } },
  reject: async (r, res, n) => { try { await s.reject(r.params.id, r.body, r.user.id); res.json({ success: true, data: { message: 'Order rejected' } }); } catch (e) { n(e); } },
  cancel: async (r, res, n) => { try { await s.cancel(r.params.id, r.body, r.user.id); res.json({ success: true, data: { message: 'Order cancelled' } }); } catch (e) { n(e); } },
  confirmReceipt: async (r, res, n) => { try { await s.confirmReceipt(r.params.id, r.user.id); res.json({ success: true, data: { message: 'Receipt confirmed' } }); } catch (e) { n(e); } },
  requestReturn: async (r, res, n) => { try { const d = await s.requestReturn(r.params.id, r.user.id, r.body); res.status(201).json({ success: true, data: d }); } catch (e) { n(e); } },
};
