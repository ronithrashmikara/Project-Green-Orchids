const s = require('./sales.service');
module.exports = {
  listAvailability: async (r, res, n) => { try { const d = await s.listAvailability(); res.json({ success: true, data: d }); } catch (e) { n(e); } },
  setAvailability: async (r, res, n) => { try { const d = await s.setAvailability(r.user.id, r.body.status); res.json({ success: true, data: d }); } catch (e) { n(e); } },
  queue: async (r, res, n) => { try { const d = await s.queue(r.user.id); res.json({ success: true, data: d }); } catch (e) { n(e); } },
};
