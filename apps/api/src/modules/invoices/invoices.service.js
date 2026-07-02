const { AppError } = require('../../middleware/errors');
const { paginate } = require('../../utils/pagination');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const repo = require('./invoices.repository');

async function resolveAccountId(userId) {
  const acct = await repo.accountIdForUser(userId);
  if (!acct) throw new AppError('NO_ACCOUNT', 'No trade account for this user', 403);
  return acct.id;
}

const service = {
  async list(queryParams, userId, isAdmin) {
    const o = paginate(queryParams);
    const filters = { status: queryParams.status, order_id: queryParams.order_id, due_before: queryParams.due_before };
    const buyerId = isAdmin ? null : await resolveAccountId(userId);
    const { rows, total } = await repo.findAll(buyerId, isAdmin, filters, o);
    return { data: rows, pagination: { page: o.page, limit: o.limit, total, pages: Math.ceil(total / o.limit) } };
  },

  async get(id, userId, isAdmin) {
    const inv = await repo.findById(id);
    if (!inv) throw new AppError('NOT_FOUND', 'Invoice not found', 404);
    if (!isAdmin) {
      const buyerId = await resolveAccountId(userId);
      if (inv.buyer_id !== buyerId) throw new AppError('FORBIDDEN', 'Access denied', 403);
    }
    const payments = await repo.findPayments(id);
    const adjustments = await repo.findAdjustments(id);
    return { ...inv, payments, adjustments };
  },

  async getPdf(id, userId, isAdmin) {
    const inv = await repo.findById(id);
    if (!inv) throw new AppError('NOT_FOUND', 'Invoice not found', 404);
    if (!isAdmin) {
      const buyerId = await resolveAccountId(userId);
      if (inv.buyer_id !== buyerId) throw new AppError('FORBIDDEN', 'Access denied', 403);
    }
    const payments = await repo.findPayments(id);

    const doc = await PDFDocument.create();
    const page = doc.addPage([595.28, 841.89]); // A4
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const { height } = page.getSize();
    let y = height - 60;
    const fmt = (n) => `LKR ${Number(n).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    page.drawText('ORCHIDS', { x: 50, y, size: 20, font: bold, color: rgb(0.17, 0.42, 0.31) });
    page.drawText('Invoice', { x: 450, y, size: 20, font: bold });
    y -= 40;

    page.drawText(`Invoice No: ${inv.invoice_no}`, { x: 50, y, size: 11, font: bold });
    page.drawText(`Order No: ${inv.order_no || '-'}`, { x: 320, y, size: 11, font });
    y -= 18;
    page.drawText(`Bill To: ${inv.business_name || inv.buyer_name || '-'}`, { x: 50, y, size: 11, font });
    page.drawText(`Due Date: ${new Date(inv.due_date).toLocaleDateString('en-GB')}`, { x: 320, y, size: 11, font });
    y -= 18;
    page.drawText(`Status: ${inv.status}`, { x: 50, y, size: 11, font });
    page.drawText(`Created: ${new Date(inv.created_at).toLocaleDateString('en-GB')}`, { x: 320, y, size: 11, font });
    y -= 40;

    page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
    y -= 20;
    page.drawText('Description', { x: 50, y, size: 10, font: bold });
    page.drawText('Amount', { x: 470, y, size: 10, font: bold });
    y -= 8;
    page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
    y -= 20;

    page.drawText(`Order total`, { x: 50, y, size: 10, font });
    page.drawText(fmt(inv.total_amount), { x: 470, y, size: 10, font });
    y -= 18;

    for (const p of payments) {
      page.drawText(`Payment ${p.payment_no || ''} (${p.method})${p.reversed_at ? ' - REVERSED' : ''}`, { x: 50, y, size: 10, font });
      page.drawText(`-${fmt(p.amount)}`, { x: 470, y, size: 10, font });
      y -= 18;
    }

    y -= 10;
    page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
    y -= 22;
    page.drawText('Balance Due', { x: 50, y, size: 12, font: bold });
    page.drawText(fmt(inv.balance_due), { x: 460, y, size: 12, font: bold });

    return Buffer.from(await doc.save());
  },

  async pay(id, userId, data) {
    const inv = await repo.findById(id);
    if (!inv) throw new AppError('NOT_FOUND', 'Invoice not found', 404);
    const buyerId = await resolveAccountId(userId);
    if (inv.buyer_id !== buyerId) throw new AppError('FORBIDDEN', 'Access denied', 403);

    // Reuse the same balance/overpayment logic staff payment recording uses.
    const paymentsService = require('../payments/payments.service');
    return paymentsService.create({ invoice_id: id, amount: data.amount, method: data.method, reference: data.reference }, userId);
  },

  async getStatement(userId, isAdmin, { buyerUserId, month, year } = {}) {
    const targetUserId = isAdmin && buyerUserId ? buyerUserId : userId;
    const buyerId = await resolveAccountId(targetUserId);
    const now = new Date();
    const m = month || now.getMonth() + 1;
    const y = year || now.getFullYear();
    const statement = await repo.getStatement(buyerId, y, m);
    const total = statement.invoices.reduce((s, i) => s + Number(i.total_amount), 0);
    return { month: m, year: y, ...statement, total };
  },

  async getStatementPdf(userId, isAdmin, { buyerUserId, month, year } = {}) {
    const targetUserId = isAdmin && buyerUserId ? buyerUserId : userId;
    const buyerId = await resolveAccountId(targetUserId);
    const buyerName = await repo.businessNameForAccount(buyerId);
    const statement = await this.getStatement(userId, isAdmin, { buyerUserId, month, year });

    const doc = await PDFDocument.create();
    const page = doc.addPage([595.28, 841.89]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const { height } = page.getSize();
    let y = height - 60;
    const fmt = (n) => `LKR ${Number(n).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    page.drawText('ORCHIDS', { x: 50, y, size: 20, font: bold, color: rgb(0.17, 0.42, 0.31) });
    page.drawText('Statement', { x: 420, y, size: 20, font: bold });
    y -= 40;
    page.drawText(`Account: ${buyerName || '-'}`, { x: 50, y, size: 11, font: bold });
    page.drawText(`Period: ${statement.month}/${statement.year}`, { x: 320, y, size: 11, font });
    y -= 40;

    page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
    y -= 20;
    page.drawText('Invoice', { x: 50, y, size: 10, font: bold });
    page.drawText('Status', { x: 300, y, size: 10, font: bold });
    page.drawText('Amount', { x: 470, y, size: 10, font: bold });
    y -= 8;
    page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
    y -= 20;

    for (const inv of statement.invoices) {
      if (y < 60) { y = height - 60; doc.addPage([595.28, 841.89]); }
      page.drawText(inv.invoice_no, { x: 50, y, size: 10, font });
      page.drawText(inv.status, { x: 300, y, size: 10, font });
      page.drawText(fmt(inv.total_amount), { x: 470, y, size: 10, font });
      y -= 18;
    }

    y -= 10;
    page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
    y -= 22;
    page.drawText('Total for period', { x: 50, y, size: 12, font: bold });
    page.drawText(fmt(statement.total), { x: 460, y, size: 12, font: bold });

    return Buffer.from(await doc.save());
  },

  async getAging() {
    const rows = await repo.getAgingReport(new Date().toISOString());
    return rows;
  },
};
module.exports = service;
