const repo = require('./reports.repository');
const { stringify } = require('csv-stringify/sync');

const service = {
  salesTrend: (q) => repo.salesTrend(q.from, q.to),
  categoryPerformance: (q) => repo.categoryPerformance(q.from, q.to),
  topProducts: (q) => repo.topProducts(q.from, q.to, q.limit),
  buyerBehaviour: (q) => repo.buyerBehaviour(q.from, q.to),
  creditRisk: () => repo.creditRisk(),
  inventoryTurnover: () => repo.inventoryTurnover(),
  supplierContribution: (q) => repo.supplierContribution(q.from, q.to),
  returnsAnalytics: (q) => repo.returnsAnalytics(q.from, q.to),
};

async function handleReport(req, res, next, method, ...args) {
  try {
    const data = await method(...args);
    if (req.query.format === 'csv') {
      const csv = stringify(data, { header: true });
      res.header('Content-Type','text/csv').header('Content-Disposition','attachment; filename=report.csv').send(csv);
    } else {
      res.json({ success: true, data });
    }
  } catch (e) { next(e); }
}

module.exports = { service, handleReport };
