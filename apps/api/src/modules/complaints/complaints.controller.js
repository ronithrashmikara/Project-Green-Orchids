const s = require('./complaints.service');
// "Staff view" = holds the all-complaints/handling permission (codes, not role names)
const isStaff = (u) => u.permissions.includes('complaint.view.all') || u.permissions.includes('complaint.handle');
module.exports = {
  create: async (r, res, n) => { try { const d = await s.create(r.body, r.user.id); res.status(201).json({ success: true, data: d }); } catch (e) { n(e); } },
  list: async (r, res, n) => { try { const d = await s.list(r.query, r.user.id, isStaff(r.user)); res.json({ success: true, ...d }); } catch (e) { n(e); } },
  get: async (r, res, n) => { try { const d = await s.get(r.params.id, r.user.id, isStaff(r.user)); res.json({ success: true, data: d }); } catch (e) { n(e); } },
  addMessage: async (r, res, n) => { try { const d = await s.addMessage(r.params.id, r.body.body, r.user.id, isStaff(r.user)); res.status(201).json({ success: true, data: d }); } catch (e) { n(e); } },
  queue: async (r, res, n) => { try { const d = await s.queue(r.query, r.user.id); res.json({ success: true, ...d }); } catch (e) { n(e); } },
  update: async (r, res, n) => { try { const d = await s.update(r.params.id, r.body, r.user.id); res.json({ success: true, data: d }); } catch (e) { n(e); } },
};
