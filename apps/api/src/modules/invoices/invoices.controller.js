const s = require('./invoices.service');
const { stringify } = require('csv-stringify/sync');
const isAdmin = (u) => u.permissions.includes('invoice.view.all');
module.exports = {
  list: async (r, res, n) => { try { const d = await s.list(r.query, r.user.id, isAdmin(r.user)); res.json({ success: true, ...d }); } catch (e) { n(e); } },
  get: async (r, res, n) => { try { const d = await s.get(r.params.id, r.user.id, isAdmin(r.user)); res.json({ success: true, data: d }); } catch (e) { n(e); } },
  pdf: async (r, res, n) => {
    try {
      const pdfBuffer = await s.getPdf(r.params.id, r.user.id, isAdmin(r.user));
      res.header('Content-Type', 'application/pdf').header('Content-Disposition', `inline; filename=invoice.pdf`).send(pdfBuffer);
    } catch (e) { n(e); }
  },
  pay: async (r, res, n) => { try { const d = await s.pay(r.params.id, r.user.id, r.body); res.status(201).json({ success: true, data: d }); } catch (e) { n(e); } },
  statement: async (r, res, n) => {
    try {
      const [year, month] = (r.query.month || '').split('-').map(Number);
      const d = await s.getStatement(r.user.id, isAdmin(r.user), { buyerUserId: r.query.buyerId, month, year });
      res.json({ success: true, data: d });
    } catch (e) { n(e); }
  },
  statementPdf: async (r, res, n) => {
    try {
      const [year, month] = (r.query.month || '').split('-').map(Number);
      const pdfBuffer = await s.getStatementPdf(r.user.id, isAdmin(r.user), { buyerUserId: r.query.buyerId, month, year });
      res.header('Content-Type', 'application/pdf').header('Content-Disposition', 'attachment; filename=statement.pdf').send(pdfBuffer);
    } catch (e) { n(e); }
  },
  aging: async (r, res, n) => {
    try {
      const d = await s.getAging();
      if (r.query.format === 'csv') {
        const csv = stringify(d, { header: true });
        res.header('Content-Type', 'text/csv').header('Content-Disposition', 'attachment; filename=aging-report.csv').send(csv);
      } else {
        res.json({ success: true, data: d });
      }
    } catch (e) { n(e); }
  },
};
