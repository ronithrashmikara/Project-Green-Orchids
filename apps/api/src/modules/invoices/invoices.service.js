const { AppError } = require('../../middleware/errors');
const { paginate } = require('../../utils/pagination');
const repo = require('./invoices.repository');

const service = {
  async list(queryParams, buyerId, isAdmin) {
    const o = paginate(queryParams);
    const filters = { status: queryParams.status, order_id: queryParams.order_id, due_before: queryParams.due_before };
    const { rows, total } = await repo.findAll(isAdmin ? null : buyerId, isAdmin, filters, o);
    return { data: rows, pagination: { page: o.page, limit: o.limit, total, pages: Math.ceil(total / o.limit) } };
  },
  async get(id, buyerId, isAdmin) {
    const inv = await repo.findById(id);
    if (!inv) throw new AppError('NOT_FOUND', 'Invoice not found', 404);
    if (!isAdmin && inv.buyer_id !== buyerId) throw new AppError('FORBIDDEN', 'Access denied', 403);
    const payments = await repo.findPayments(id);
    const adjustments = await repo.findAdjustments(id);
    return { ...inv, payments, adjustments };
  },
  async getPdf(id) {
    const inv = await repo.findById(id);
    if (!inv) throw new AppError('NOT_FOUND', 'Invoice not found', 404);
    // Placeholder PDF generation
    return { url: `/invoices/${id}/pdf`, message: 'PDF generation placeholder' };
  },
  async getStatement(buyerId, month, year) {
    const now = new Date();
    const m = month || now.getMonth() + 1;
    const y = year || now.getFullYear();
    const invoices = await repo.getStatement(buyerId, y, m);
    const total = invoices.reduce((s, i) => s + Number(i.total_amount), 0);
    return { month: m, year: y, invoices, total };
  },
  async getAging() {
    const rows = await repo.getAgingReport(new Date().toISOString());
    return rows;
  },
};
module.exports = service;
