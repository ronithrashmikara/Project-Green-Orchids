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
  summary: () => repo.summary(),
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

// Maps the 8 admin BI dashboard views to the underlying report queries, and
// reshapes each into the {series, summary} contract the dashboard renders.
const VIEWS = {
  sales: {
    rows: (q) => repo.salesTrend(q.from, q.to),
    series: (rows) => rows.map((r) => ({ name: new Date(r.month).toLocaleDateString('en-LK', { year: 'numeric', month: 'short' }), value: Number(r.revenue) })).reverse(),
    summary: (rows) => ({ total_revenue: rows.reduce((s, r) => s + Number(r.revenue), 0), total_orders: rows.reduce((s, r) => s + Number(r.order_count), 0) }),
  },
  category: {
    rows: (q) => repo.categoryPerformance(q.from, q.to),
    series: (rows) => rows.map((r) => ({ name: r.category, value: Number(r.revenue) })),
    summary: (rows) => ({ categories: rows.length, total_revenue: rows.reduce((s, r) => s + Number(r.revenue), 0) }),
  },
  top_products: {
    rows: (q) => repo.topProducts(q.from, q.to, q.limit),
    series: (rows) => rows.map((r) => ({ name: r.name, value: Number(r.revenue) })),
    summary: (rows) => ({ products_shown: rows.length, total_units_sold: rows.reduce((s, r) => s + Number(r.units_sold), 0) }),
  },
  buyers: {
    rows: (q) => repo.buyerBehaviour(q.from, q.to),
    series: (rows) => rows.map((r) => ({ name: r.business_name || r.name, revenue: Number(r.total_spend), orders: Number(r.order_count) })),
    summary: (rows) => ({ active_buyers: rows.length, total_spend: rows.reduce((s, r) => s + Number(r.total_spend), 0) }),
  },
  credit_risk: {
    rows: () => repo.creditRisk(),
    series: (rows) => ([
      { name: '0-30/60-90 days', value: rows.reduce((s, r) => s + Number(r.bucket_30_60) + Number(r.bucket_60_90), 0) },
      { name: '90+ days', value: rows.reduce((s, r) => s + Number(r.bucket_90plus), 0) },
      { name: 'Current', value: rows.reduce((s, r) => s + Math.max(0, Number(r.total_exposure) - Number(r.bucket_30_60) - Number(r.bucket_60_90) - Number(r.bucket_90plus)), 0) },
    ]),
    summary: (rows) => ({ buyers_at_risk: rows.filter((r) => Number(r.overdue_invoices) > 0).length, total_exposure: rows.reduce((s, r) => s + Number(r.total_exposure), 0) }),
  },
  inventory: {
    rows: () => repo.inventoryTurnover(),
    series: (rows) => rows.slice(0, 20).map((r) => ({ name: r.name, stock: Number(r.current_stock), turnover: Number(r.units_sold_90d) })),
    summary: (rows) => ({ dead_stock: rows.filter((r) => r.turnover_category === 'DEAD').length, fast_moving: rows.filter((r) => r.turnover_category === 'FAST').length }),
  },
  suppliers: {
    rows: (q) => repo.supplierContribution(q.from, q.to),
    series: (rows) => rows.map((r) => ({ name: r.name || 'Unassigned', value: Number(r.revenue) })),
    summary: (rows) => ({ suppliers: rows.length, total_revenue: rows.reduce((s, r) => s + Number(r.revenue), 0) }),
  },
  returns: {
    rows: (q) => repo.returnsAnalytics(q.from, q.to),
    series: (rows) => rows.map((r) => ({ name: r.reason_category, value: Number(r.count) })),
    summary: (rows) => ({ total_returns: rows.reduce((s, r) => s + Number(r.count), 0), resolved: rows.reduce((s, r) => s + Number(r.resolved), 0) }),
  },
};

async function handleDashboard(req, res, next) {
  try {
    const view = VIEWS[req.query.view] || VIEWS.sales;
    const rows = await view.rows(req.query);
    if (req.query.format === 'csv') {
      const csv = stringify(rows, { header: true });
      res.header('Content-Type', 'text/csv').header('Content-Disposition', `attachment; filename=report-${req.query.view || 'sales'}.csv`).send(csv);
    } else {
      res.json({ success: true, series: view.series(rows), summary: view.summary(rows) });
    }
  } catch (e) { next(e); }
}

module.exports = { service, handleReport, handleDashboard };
