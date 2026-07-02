const s = require('./finance.service');
module.exports = {
  credit: async (r, res, n) => { try { const d = await s.getCreditMonitor(); res.json({ success: true, data: d }); } catch (e) { n(e); } },
};
