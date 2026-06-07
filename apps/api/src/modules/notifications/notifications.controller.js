const s = require('./notifications.service');
module.exports = {
  list: async (r, res, n) => { try { const d = await s.listOutbox(r.query); res.json({ success: true, ...d }); } catch (e) { n(e); } },
  retry: async (r, res, n) => { try { await s.retry(r.params.id); res.json({ success: true, data: { message: 'Retried' } }); } catch (e) { n(e); } },
  health: async (r, res, n) => { try { const d = await s.getHealth(); res.json({ success: true, data: d }); } catch (e) { n(e); } },
};
