const s = require('./tiers.service');
module.exports = {
  list: async (r, res, n) => { try { const d = await s.list(); res.json({ success: true, data: d }); } catch (e) { n(e); } },
  create: async (r, res, n) => { try { const d = await s.create(r.body, r.user.id); res.status(201).json({ success: true, data: d }); } catch (e) { n(e); } },
  update: async (r, res, n) => { try { const d = await s.update(r.params.id, r.body, r.user.id); res.json({ success: true, data: d }); } catch (e) { n(e); } },
  remove: async (r, res, n) => { try { await s.remove(r.params.id, r.user.id); res.json({ success: true, data: { message: 'Tier deleted' } }); } catch (e) { n(e); } },
};
