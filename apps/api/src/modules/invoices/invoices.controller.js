const s = require('./invoices.service');
const isAdmin = (u) => u.permissions.includes('ADMIN') || u.permissions.includes('FINANCE_MANAGER');
module.exports = {
  list: async (r, res, n) => { try { const d = await s.list(r.query, r.user.id, isAdmin(r.user)); res.json({ success: true, ...d }); } catch (e) { n(e); } },
  get: async (r, res, n) => { try { const d = await s.get(r.params.id, r.user.id, isAdmin(r.user)); res.json({ success: true, data: d }); } catch (e) { n(e); } },
  pdf: async (r, res, n) => { try { const d = await s.getPdf(r.params.id); res.json({ success: true, data: d }); } catch (e) { n(e); } },
  statement: async (r, res, n) => { try { const d = await s.getStatement(r.user.id, r.query.month, r.query.year); res.json({ success: true, data: d }); } catch (e) { n(e); } },
  aging: async (r, res, n) => { try { const d = await s.getAging(); res.json({ success: true, data: d }); } catch (e) { n(e); } },
};
