const { tx } = require('../../config/db');
const { AppError } = require('../../middleware/errors');
const { writeAudit } = require('../../middleware/audit');
const { calculateBalanceDue } = require('../../utils/money');
const { enqueueEmail } = require('../../utils/outbox');
const repo = require('./payments.repository');

// Decide invoice status from money state (Finding 10 / F1.3):
//  - balance 0 reached purely via a negative adjustment  -> ADJUSTED
//  - balance 0 with money covering total+adjustments      -> PAID
function invoiceStatus(total, adjustments, paid, balance) {
  if (balance <= 0) {
    return paid >= (Number(total) + Number(adjustments)) - 1e-9 ? 'PAID' : 'ADJUSTED';
  }
  return paid > 0 ? 'PARTIALLY_PAID' : 'PENDING';
}

const service = {
  async create(data, actor) {
    let payment;
    await tx(async (client) => {
      const invoice = await repo.lockInvoice(client, data.invoice_id);
      if (!invoice) throw new AppError('NOT_FOUND', 'Invoice not found', 404);
      if (['CANCELLED', 'VOID'].includes(invoice.status)) {
        throw new AppError('INVALID_STATE', 'Cannot record payment on a void invoice', 409);
      }

      const adjustments = await repo.sumAdjustments(client, data.invoice_id);
      const currentBalance = calculateBalanceDue(Number(invoice.total_amount), Number(invoice.paid_amount), adjustments);

      // Overpayment rejected (Finding 9) — never let balance go negative via payment
      if (Number(data.amount) > currentBalance + 1e-9) {
        throw new AppError('OVERPAYMENT', `Amount exceeds balance due. Maximum acceptable: ${currentBalance.toFixed(2)}`, 422, { maxAcceptable: currentBalance });
      }

      const paymentNo = await repo.nextPaymentNumber();
      payment = await repo.create(client, {
        payment_no: paymentNo, invoice_id: data.invoice_id, buyer_id: invoice.buyer_id,
        amount: data.amount, method: data.method || 'BANK_TRANSFER', reference: data.reference,
        recorded_by: actor && actor !== 'SYSTEM' ? actor : invoice.buyer_id, payment_date: data.payment_date,
      });

      const newPaid = Number(invoice.paid_amount) + Number(data.amount);
      const newBalance = calculateBalanceDue(Number(invoice.total_amount), newPaid, adjustments);
      const status = invoiceStatus(invoice.total_amount, adjustments, newPaid, newBalance);
      await repo.updateInvoice(client, data.invoice_id, newPaid, newBalance, status);

      await writeAudit({ actor: actor === 'SYSTEM' ? null : actor, action: 'PAYMENT_RECORDED',
        entityType: 'payments', entityId: String(payment.id),
        after: { invoice_id: data.invoice_id, amount: data.amount, newBalance } }, client);
      await enqueueEmail(client, {
        recipientUserId: null, recipientEmail: invoice.recipient_email || null, template: 'payment_received',
        payload: { amount: Number(data.amount).toFixed(2), invoiceNo: invoice.invoice_no, balanceDue: newBalance.toFixed(2) },
      });
    });
    return payment;
  },

  async reverse(id, data, actor) {
    const payment = await repo.findById(id);
    if (!payment) throw new AppError('NOT_FOUND', 'Payment not found', 404);
    // Reversal detected via reversed_at (Finding 6) — guard against double reversal
    if (payment.reversed_at) throw new AppError('ALREADY_REVERSED', 'Payment is already reversed', 409);

    // Two-person rule for large reversals (Finding 11): require a distinct, present approver
    if (Number(payment.amount) > 50000) {
      if (!data.confirmed_by || data.confirmed_by === actor) {
        throw new AppError('TWO_PERSON_REQUIRED', 'Reversal over 50,000 requires confirmation by a different officer', 403);
      }
    }

    await tx(async (client) => {
      await repo.markReversed(client, id, data.reason);
      const invoice = await repo.lockInvoice(client, payment.invoice_id);
      if (invoice) {
        const adjustments = await repo.sumAdjustments(client, payment.invoice_id);
        const newPaid = Math.max(0, Number(invoice.paid_amount) - Number(payment.amount));
        const newBalance = calculateBalanceDue(Number(invoice.total_amount), newPaid, adjustments);
        const status = invoiceStatus(invoice.total_amount, adjustments, newPaid, newBalance);
        await repo.updateInvoice(client, payment.invoice_id, newPaid, newBalance, status);
      }
      await writeAudit({ actor, action: 'PAYMENT_REVERSED', entityType: 'payments', entityId: String(id),
        after: { reason: data.reason, confirmedBy: data.confirmed_by || null } }, client);
    });
  },

  async payhereNotify(data) {
    const crypto = require('crypto');
    const env = require('../../config/env');
    const merchantId = env.PAYHERE_MERCHANT_ID;
    const secret = env.PAYHERE_SECRET;

    // Verify md5sig (F1.1) — reject silently on bad signature
    if (merchantId && secret) {
      const hash = crypto.createHash('md5').update(
        `${merchantId}${data.order_id}${data.payhere_amount}${data.payhere_currency}${data.status_code}` +
        crypto.createHash('md5').update(secret).digest('hex').toUpperCase()
      ).digest('hex').toUpperCase();
      if (hash !== data.md5sig) {
        await writeAudit({ actor: null, action: 'PAYHERE_BAD_SIG', entityType: 'payments', entityId: String(data.order_id || ''),
          after: { order_id: data.order_id } }).catch(() => {});
        return { ok: true, ignored: true };
      }
    }

    // Resolve OUR invoice from the PayHere order reference (Finding 13) — never assume equality
    const invoice = await repo.findInvoiceByOrderNo(data.order_id);
    if (!invoice) throw new AppError('NOT_FOUND', 'No invoice for PayHere order reference', 404);

    // Idempotency: PayHere retries notifies. UNIQUE(invoice_id, method, reference) backstops this.
    const existing = await repo.findByReference(data.payment_id);
    if (existing) return existing;

    try {
      return await this.create({
        invoice_id: invoice.id,
        amount: parseFloat(data.payhere_amount),
        method: 'ONLINE', // 'PAYHERE' is not an allowed CHECK value (Finding 5)
        reference: data.payment_id,
      }, 'SYSTEM');
    } catch (e) {
      // Duplicate notify caught by the unique constraint -> clean no-op
      if (e && (e.code === '23505' || e.message?.includes('uq_payments_idempotent'))) {
        return await repo.findByReference(data.payment_id);
      }
      throw e;
    }
  },
};
module.exports = service;
