const s = require('./rma.service');
const isAdmin = (u) => u.permissions.includes('ADMIN') || u.permissions.includes('SUPPORT_MANAGER');
module.exports = {
  create: async (r, res, n) => { try { const d = await s.create(r.body, r.user.id); res.status(201).json({ success: true, data: d }); } catch (e) { n(e); } },
  list: async (r, res, n) => { try { const d = await s.list(r.query, r.user.id, isAdmin(r.user)); res.json({ success: true, ...d }); } catch (e) { n(e); } },
  get: async (r, res, n) => { try { const d = await s.get(r.params.id, r.user.id, isAdmin(r.user)); res.json({ success: true, data: d }); } catch (e) { n(e); } },
  review: async (r, res, n) => { try { await s.review(r.params.id, 'ADMIN'); res.json({ success: true, data: { message: 'Under review' } }); } catch (e) { n(e); } },
  approve: async (r, res, n) => { try { await s.approve(r.params.id, 'ADMIN'); res.json({ success: true, data: { message: 'Approved' } }); } catch (e) { n(e); } },
  reject: async (r, res, n) => { try { await s.reject(r.params.id, r.body, 'ADMIN'); res.json({ success: true, data: { message: 'Rejected' } }); } catch (e) { n(e); } },
  receive: async (r, res, n) => { try { await s.receive(r.params.id, r.body, r.user.id); res.json({ success: true, data: { message: 'Received' } }); } catch (e) { n(e); } },
  resolve: async (r, res, n) => { try { await s.resolve(r.params.id, r.body, r.user.id); res.json({ success: true, data: { message: 'Resolved' } }); } catch (e) { n(e); } },
};
