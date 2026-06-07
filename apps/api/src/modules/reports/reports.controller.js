const { service, handleReport } = require('./reports.service');
module.exports = {
  salesTrend: (r, res, n) => handleReport(r, res, n, service.salesTrend, r.query),
  categoryPerformance: (r, res, n) => handleReport(r, res, n, service.categoryPerformance, r.query),
  topProducts: (r, res, n) => handleReport(r, res, n, service.topProducts, r.query),
  buyerBehaviour: (r, res, n) => handleReport(r, res, n, service.buyerBehaviour, r.query),
  creditRisk: (r, res, n) => handleReport(r, res, n, service.creditRisk),
  inventoryTurnover: (r, res, n) => handleReport(r, res, n, service.inventoryTurnover),
  supplierContribution: (r, res, n) => handleReport(r, res, n, service.supplierContribution, r.query),
  returnsAnalytics: (r, res, n) => handleReport(r, res, n, service.returnsAnalytics, r.query),
};
