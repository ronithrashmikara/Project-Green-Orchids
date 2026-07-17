const { tx } = require('../../config/db');
const { AppError } = require('../../middleware/errors');
const { writeAudit } = require('../../middleware/audit');
const { calculateBalanceDue } = require('../../utils/money');
const { enqueueEmail } = require('../../utils/outbox');
const { paginate } = require('../../utils/pagination');
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
  async list(queryParams) {
    const o = paginate(queryParams);
    const { rows, total } = await repo.findAll(o);
    return { data: rows, pagination: { page: o.page, limit: o.limit, total, pages: Math.ceil(total / o.limit) } };
  },

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

      // Idempotency backstop (Finding S03): the DB unique constraint is (invoice_id, method,
      // reference). A blank reference bypasses it entirely (NULL <> NULL in SQL, so two
      // reference-less submits never collide), which is the actual resubmit loophole — two
      // *distinct* payments of the same amount (e.g. two equal installments) are legitimate
      // and must not be blocked just for sharing an amount. So this fallback only fires when
      // the client didn't supply a reference to dedupe on in the first place.
      const normalizedReference = data.reference ? data.reference.trim() : null;
      if (!normalizedReference) {
        const duplicate = await repo.findRecentDuplicate(client, data.invoice_id, data.amount, 30);
        if (duplicate) {
          throw new AppError('DUPLICATE_PAYMENT', 'A matching payment with no reference was already recorded moments ago — add a reference to record a distinct payment', 409, { paymentId: duplicate.id });
        }
      }

      const paymentNo = await repo.nextPaymentNumber();
      payment = await repo.create(client, {
        payment_no: paymentNo, invoice_id: data.invoice_id, buyer_id: invoice.buyer_id,
        amount: data.amount, method: data.method || 'BANK_TRANSFER', reference: normalizedReference,
        recorded_by: actor && actor !== 'SYSTEM' ? actor : invoice.buyer_id, payment_date: data.payment_date,
      });

      const newPaid = Number(invoice.paid_amount) + Number(data.amount);
      const newBalance = calculateBalanceDue(Number(invoice.total_amount), newPaid, adjustments);
      const status = invoiceStatus(invoice.total_amount, adjustments, newPaid, newBalance);
      await repo.updateInvoice(client, data.invoice_id, newPaid, newBalance, status);

      await writeAudit({ actor: actor === 'SYSTEM' ? null : actor, action: 'PAYMENT_RECORDED',
        entityType: 'payments', entityId: String(payment.id),
        after: { invoice_id: data.invoice_id, amount: data.amount, newBalance } }, client);
      // invoice.recipient_email was never a real column — invoices don't carry
      // an email, the buyer's email lives on users via trade_accounts. Resolve
      // it for real so this notification can actually be delivered.
      const buyerEmail = await client.query(
        `SELECT u.email FROM trade_accounts ta JOIN users u ON u.id = ta.user_id WHERE ta.id = $1`,
        [invoice.buyer_id]
      );
      await enqueueEmail(client, {
        recipientUserId: null, recipientEmail: buyerEmail.rows[0]?.email || null, template: 'payment_received',
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

    // Two-person rule for large reversals (Finding 11): require a distinct, present approver who
    // is a real, ACTIVE user actually entitled to countersign a reversal — a fabricated or
    // wrong-role UUID must not satisfy this check.
    if (Number(payment.amount) > 50000) {
      if (!data.confirmed_by || data.confirmed_by === actor) {
        throw new AppError('TWO_PERSON_REQUIRED', 'Reversal over 50,000 requires confirmation by a different officer', 403);
      }
      const confirmer = await repo.findActiveUserWithPermission(data.confirmed_by, 'payment.reverse');
      if (!confirmer) {
        throw new AppError('TWO_PERSON_REQUIRED', 'Confirming officer must be a real, active user authorized to reverse payments', 403);
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

    // PayHere mandates this MD5 checksum format. Treat it strictly as a protocol MAC,
    // fail closed when configuration or required fields are absent, and compare in
    // constant time. It is never used for password hashing or local data integrity.
    if (!merchantId || !secret) {
      throw new AppError('PAYHERE_NOT_CONFIGURED', 'Payment notifications are not configured', 503);
    }
    const required = ['merchant_id', 'order_id', 'payment_id', 'payhere_amount', 'payhere_currency', 'status_code', 'md5sig'];
    if (required.some(field => typeof data[field] !== 'string' || !data[field].trim())) {
      throw new AppError('INVALID_NOTIFICATION', 'Malformed payment notification', 400);
    }
    if (data.merchant_id !== merchantId || !/^[-+]?\d+$/.test(data.status_code)) {
      throw new AppError('INVALID_NOTIFICATION', 'Invalid payment notification', 400);
    }
    const amount = Number(data.payhere_amount);
    if (!Number.isFinite(amount) || amount <= 0 || !/^\d+(?:\.\d{1,2})?$/.test(data.payhere_amount)) {
      throw new AppError('INVALID_AMOUNT', 'Invalid payment amount', 400);
    }

    const hash = crypto.createHash('md5').update(
      `${merchantId}${data.order_id}${data.payhere_amount}${data.payhere_currency}${data.status_code}` +
      crypto.createHash('md5').update(secret).digest('hex').toUpperCase()
    ).digest('hex').toUpperCase();
    const provided = data.md5sig.toUpperCase();
    const validSignature = /^[A-F0-9]{32}$/.test(provided) &&
      crypto.timingSafeEqual(Buffer.from(hash, 'ascii'), Buffer.from(provided, 'ascii'));
    if (!validSignature) {
      await writeAudit({ actor: null, action: 'PAYHERE_BAD_SIG', entityType: 'payments', entityId: String(data.order_id),
        after: { order_id: data.order_id } }).catch(() => {});
      return { ok: true, ignored: true };
    }
    if (data.status_code !== '2') {
      return { ok: true, ignored: true };
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
        amount,
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
