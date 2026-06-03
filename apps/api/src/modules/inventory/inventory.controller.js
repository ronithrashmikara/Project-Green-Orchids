const s = require('./inventory.service');
module.exports = {
  movements: async (r, res, n) => { try { if (r.query.format === 'csv') { const csv = await s.exportMovements(r.query); res.header('Content-Type','text/csv').header('Content-Disposition','attachment; filename=stock_movements.csv').send(csv); } else { const d = await s.getMovements(r.query); res.json({ success: true, ...d }); } } catch (e) { n(e); } },
  alerts: async (r, res, n) => { try { const d = await s.getAlerts(r.query); res.json({ success: true, ...d }); } catch (e) { n(e); } },
  ackAlert: async (r, res, n) => { try { await s.ackAlert(r.params.id, r.body, r.user.id); res.json({ success: true, data: { message: 'Alert acknowledged' } }); } catch (e) { n(e); } },
  summary: async (r, res, n) => { try { const d = await s.getSummary(); res.json({ success: true, data: d }); } catch (e) { n(e); } },
};
