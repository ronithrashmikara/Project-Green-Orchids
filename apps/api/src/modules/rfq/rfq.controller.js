const s = require('./rfq.service');
const isAdmin = (user) => user.permissions.includes('rfq.quote');
module.exports = {
  create: async (r, res, n) => { try { const d = await s.create(r.body, r.user.id); res.status(201).json({ success: true, data: d }); } catch (e) { n(e); } },
  list: async (r, res, n) => { try { const d = await s.list(r.query, r.user.id, isAdmin(r.user)); res.json({ success: true, ...d }); } catch (e) { n(e); } },
  get: async (r, res, n) => { try { const d = await s.get(r.params.id, r.user.id, isAdmin(r.user)); res.json({ success: true, data: d }); } catch (e) { n(e); } },
  review: async (r, res, n) => { try { await s.review(r.params.id, r.body, 'ADMIN'); res.json({ success: true, data: { message: 'Under review' } }); } catch (e) { n(e); } },
  quote: async (r, res, n) => { try { await s.quote(r.params.id, r.body, 'ADMIN'); res.json({ success: true, data: { message: 'Quoted' } }); } catch (e) { n(e); } },
  decline: async (r, res, n) => { try { await s.decline(r.params.id, r.body, 'ADMIN'); res.json({ success: true, data: { message: 'Declined' } }); } catch (e) { n(e); } },
  accept: async (r, res, n) => { try { await s.accept(r.params.id, r.user.id, 'BUYER'); res.json({ success: true, data: { message: 'Accepted' } }); } catch (e) { n(e); } },
  reject: async (r, res, n) => { try { await s.reject(r.params.id, r.user.id, 'BUYER'); res.json({ success: true, data: { message: 'Rejected' } }); } catch (e) { n(e); } },
  convert: async (r, res, n) => { try { const d = await s.convertToOrder(r.params.id, r.user.id); res.json({ success: true, data: d }); } catch (e) { n(e); } },
};
