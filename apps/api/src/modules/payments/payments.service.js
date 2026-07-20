const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const Stripe = require('stripe');
const { tx } = require('../../config/db');
const env = require('../../config/env');
const { AppError } = require('../../middleware/errors');
const { writeAudit } = require('../../middleware/audit');
const { calculateBalanceDue, toCents, roundMoney } = require('../../utils/money');
const { enqueueEmail } = require('../../utils/outbox');
const { paginate } = require('../../utils/pagination');
const repo = require('./payments.repository');

const PAYMENT_REVERSAL_SECOND_APPROVAL_THRESHOLD = 50000;
const GATEWAY = 'STRIPE';

function baseUrl(value, fallback) {
  return String(value || fallback).replace(/\/+$/, '');
}

function stripeCurrency() {
  return (env.STRIPE_CURRENCY || 'lkr').toLowerCase();
}

function stripeAmount(amount) {
  return toCents(roundMoney(amount));
}

function publicUrls(invoiceId, gatewayOrderId) {
  const appBase = baseUrl(env.APP_PUBLIC_URL, 'http://localhost:3000');
  return {
    success_url: `${appBase}/buyer/invoices/${invoiceId}?payment=success&provider=stripe&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appBase}/buyer/invoices/${invoiceId}?payment=cancel&provider=stripe&gateway_order_id=${encodeURIComponent(gatewayOrderId)}`,
  };
}

function requireStripeConfig() {
  if (!env.STRIPE_SECRET_KEY) {
    throw new AppError(
      'STRIPE_NOT_CONFIGURED',
      'Stripe payments are not configured. Set STRIPE_SECRET_KEY before starting online checkout.',
      503
    );
  }
}

let stripeClient;
function getStripeClient() {
  requireStripeConfig();
  if (env.STRIPE_MOCK_CHECKOUT) {
    return {
      checkout: {
        sessions: {
          create: async (params) => ({
            id: `cs_test_${crypto.randomBytes(10).toString('hex')}`,
            object: 'checkout.session',
            url: `https://checkout.stripe.com/c/pay/cs_test_${crypto.randomBytes(8).toString('hex')}`,
            client_reference_id: params.client_reference_id,
            currency: params.line_items?.[0]?.price_data?.currency,
            amount_total: params.line_items?.[0]?.price_data?.unit_amount,
            payment_status: 'unpaid',
            metadata: params.metadata || {},
          }),
        },
      },
    };
  }
  if (!stripeClient) stripeClient = new Stripe(env.STRIPE_SECRET_KEY);
  return stripeClient;
}

// Decide invoice status from money state (Finding 10 / F1.3):
//  - balance 0 reached purely via a negative adjustment  -> ADJUSTED
//  - balance 0 with money covering total+adjustments      -> PAID
function invoiceStatus(total, adjustments, paid, balance) {
  if (balance <= 0) {
    if (paid <= 1e-9 && Number(adjustments) < 0) return 'ADJUSTED';
    return paid >= (Number(total) + Number(adjustments)) - 1e-9 ? 'PAID' : 'ADJUSTED';
  }
  return paid > 0 ? 'PARTIALLY_PAID' : 'PENDING';
}

async function recordPaymentWithLockedInvoice(client, invoice, data, actor) {
  if (!invoice) throw new AppError('NOT_FOUND', 'Invoice not found', 404);
  if (['CANCELLED', 'VOID'].includes(invoice.status)) {
    throw new AppError('INVALID_STATE', 'Cannot record payment on a void invoice', 409);
  }

  const amount = roundMoney(data.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AppError('VALIDATION_ERROR', 'Payment amount must be a positive number', 422);
  }

  const adjustments = await repo.sumAdjustments(client, data.invoice_id);
  const currentBalance = calculateBalanceDue(Number(invoice.total_amount), Number(invoice.paid_amount), adjustments);

  // Overpayment rejected (Finding 9) — never let balance go negative via payment.
  if (toCents(amount) > toCents(currentBalance)) {
    throw new AppError('OVERPAYMENT', `Amount exceeds balance due. Maximum acceptable: ${currentBalance.toFixed(2)}`, 422, { maxAcceptable: currentBalance });
  }

  // Idempotency backstop for blank-reference manual submits. Distinct referenced
  // payments with the same amount are legitimate installments and must be allowed.
  const normalizedReference = data.reference ? data.reference.trim() : null;
  if (!normalizedReference) {
    const duplicate = await repo.findRecentDuplicate(client, data.invoice_id, amount, 30);
    if (duplicate) {
      throw new AppError('DUPLICATE_PAYMENT', 'A matching payment with no reference was already recorded moments ago — add a reference to record a distinct payment', 409, { paymentId: duplicate.id });
    }
  }

  const recordedBy = actor && actor !== 'SYSTEM' ? actor : invoice.buyer_user_id;
  if (!recordedBy) {
    throw new AppError('PAYMENT_ATTRIBUTION_FAILED', 'Payment could not be attributed to a user', 500);
  }

  const paymentNo = await repo.nextPaymentNumber();
  const payment = await repo.create(client, {
    payment_no: paymentNo,
    invoice_id: data.invoice_id,
    buyer_id: invoice.buyer_id,
    amount,
    method: data.method || 'BANK_TRANSFER',
    reference: normalizedReference,
    recorded_by: recordedBy,
    payment_date: data.payment_date,
  });

  const newPaid = roundMoney(Number(invoice.paid_amount) + amount);
  const newBalance = calculateBalanceDue(Number(invoice.total_amount), newPaid, adjustments);
  const status = invoiceStatus(invoice.total_amount, adjustments, newPaid, newBalance);
  await repo.updateInvoice(client, data.invoice_id, newPaid, newBalance, status);

  await writeAudit({
    actor: actor === 'SYSTEM' ? null : actor,
    action: 'PAYMENT_RECORDED',
    entityType: 'payments',
    entityId: String(payment.id),
    after: { invoice_id: data.invoice_id, amount, newBalance },
  }, client);

  await enqueueEmail(client, {
    recipientUserId: null,
    recipientEmail: invoice.buyer_email || null,
    template: 'payment_received',
    payload: {
      name: invoice.buyer_name || 'customer',
      amount: amount.toFixed(2),
      invoiceNumber: invoice.invoice_no,
      paymentMethod: payment.method,
      paymentReference: payment.reference || payment.payment_no,
      balanceDue: newBalance.toFixed(2),
    },
  });

  return payment;
}

async function assertSecondOfficerApproval(data, actor) {
  const email = data.confirming_officer_email;
  const password = data.confirming_officer_password;
  if (!email || !password) {
    throw new AppError('TWO_PERSON_REQUIRED', 'Reversal over 50,000 requires a different finance/admin officer to re-authenticate', 403);
  }

  const approver = await repo.findSecondApproverByEmail(email, 'payment.reverse');
  if (!approver || approver.id === actor) {
    throw new AppError('TWO_PERSON_REQUIRED', 'Confirming officer must be a different active user authorized to reverse payments', 403);
  }

  const ok = await bcrypt.compare(password, approver.password_hash);
  if (!ok) {
    throw new AppError('TWO_PERSON_REQUIRED', 'Confirming officer credentials were rejected', 403);
  }
  return approver;
}

async function createStripeSession(invoice, gatewayTransaction, amount) {
  const currency = stripeCurrency();
  const urls = publicUrls(invoice.id, gatewayTransaction.gateway_order_id);
  const metadata = {
    gateway_order_id: gatewayTransaction.gateway_order_id,
    gateway_transaction_id: String(gatewayTransaction.id),
    invoice_id: String(invoice.id),
    invoice_no: invoice.invoice_no,
    buyer_id: String(invoice.buyer_id),
  };

  const params = {
    mode: 'payment',
    client_reference_id: gatewayTransaction.gateway_order_id,
    customer_email: invoice.buyer_email || undefined,
    success_url: urls.success_url,
    cancel_url: urls.cancel_url,
    line_items: [{
      quantity: 1,
      price_data: {
        currency,
        product_data: { name: `Invoice ${invoice.invoice_no}` },
        unit_amount: stripeAmount(amount),
      },
    }],
    metadata,
    payment_intent_data: { metadata },
  };

  const session = await getStripeClient().checkout.sessions.create(params);
  return { session, params: { ...params, payment_intent_data: undefined } };
}

async function markStripeGatewayStatus(client, gatewayTransaction, status, data = {}) {
  return repo.updateGatewayTransaction(client, gatewayTransaction.id, {
    status,
    gateway_payment_id: data.gateway_payment_id || null,
    notify_payload: data.notify_payload || null,
    status_message: data.status_message || null,
    method: data.method || null,
    checkout_payload: data.checkout_payload || null,
  });
}

async function handleStripeSessionPaid(session, eventType) {
  let result;
  await tx(async (client) => {
    const gatewayOrderId = session.client_reference_id || session.metadata?.gateway_order_id;
    const gatewayTransaction = gatewayOrderId
      ? await repo.lockGatewayTransactionByOrderId(client, gatewayOrderId)
      : null;

    if (!gatewayTransaction) {
      await writeAudit({
        actor: null,
        action: 'STRIPE_UNKNOWN_SESSION',
        entityType: 'payments',
        entityId: String(session.id || ''),
        after: { sessionId: session.id, clientReferenceId: gatewayOrderId || null, eventType },
      }, client);
      result = { ok: true, ignored: true, reason: 'unknown_session' };
      return;
    }

    const paymentReference = String(session.payment_intent || session.id);
    const existing = await repo.findByReferenceForUpdate(client, paymentReference);
    if (existing || gatewayTransaction.status === 'COMPLETED') {
      await markStripeGatewayStatus(client, gatewayTransaction, 'COMPLETED', {
        gateway_payment_id: paymentReference,
        notify_payload: { eventType, session },
        status_message: existing ? 'Stripe webhook replay matched an already-recorded payment' : 'Stripe webhook replay matched a completed gateway transaction',
        method: 'STRIPE_CHECKOUT',
      });
      result = existing || { ok: true, replay: true };
      return;
    }

    const amountTotal = Number(session.amount_total);
    const currency = String(session.currency || '').toLowerCase();
    if (!Number.isInteger(amountTotal) || amountTotal <= 0 || currency !== gatewayTransaction.currency.toLowerCase() || amountTotal !== stripeAmount(gatewayTransaction.amount)) {
      result = await markStripeGatewayStatus(client, gatewayTransaction, 'REQUIRES_REVIEW', {
        gateway_payment_id: paymentReference,
        notify_payload: { eventType, session },
        status_message: 'Stripe amount/currency did not match initiated transaction',
        method: 'STRIPE_CHECKOUT',
      });
      await writeAudit({
        actor: null,
        action: 'STRIPE_AMOUNT_MISMATCH',
        entityType: 'payment_gateway_transactions',
        entityId: String(gatewayTransaction.id),
        after: { expectedAmount: gatewayTransaction.amount, receivedAmountTotal: session.amount_total, expectedCurrency: gatewayTransaction.currency, receivedCurrency: session.currency },
      }, client);
      return;
    }

    const invoice = await repo.lockInvoice(client, gatewayTransaction.invoice_id);
    if (!invoice) {
      result = await markStripeGatewayStatus(client, gatewayTransaction, 'REQUIRES_REVIEW', {
        gateway_payment_id: paymentReference,
        notify_payload: { eventType, session },
        status_message: 'Invoice disappeared before Stripe settlement could be recorded',
        method: 'STRIPE_CHECKOUT',
      });
      return;
    }

    const adjustments = await repo.sumAdjustments(client, invoice.id);
    const currentBalance = calculateBalanceDue(Number(invoice.total_amount), Number(invoice.paid_amount), adjustments);
    if (toCents(Number(gatewayTransaction.amount)) > toCents(currentBalance)) {
      result = await markStripeGatewayStatus(client, gatewayTransaction, 'REQUIRES_REVIEW', {
        gateway_payment_id: paymentReference,
        notify_payload: { eventType, session },
        status_message: 'Stripe payment would overpay the current invoice balance',
        method: 'STRIPE_CHECKOUT',
      });
      return;
    }

    const payment = await recordPaymentWithLockedInvoice(client, invoice, {
      invoice_id: invoice.id,
      amount: Number(gatewayTransaction.amount),
      method: 'ONLINE',
      reference: paymentReference,
    }, 'SYSTEM');

    await markStripeGatewayStatus(client, gatewayTransaction, 'COMPLETED', {
      gateway_payment_id: paymentReference,
      notify_payload: { eventType, session },
      status_message: 'Stripe Checkout payment completed',
      method: 'STRIPE_CHECKOUT',
    });
    result = payment;
  });
  return result;
}

async function handleStripeSessionPendingOrFailed(session, status, eventType) {
  let result;
  await tx(async (client) => {
    const gatewayOrderId = session.client_reference_id || session.metadata?.gateway_order_id;
    const gatewayTransaction = gatewayOrderId
      ? await repo.lockGatewayTransactionByOrderId(client, gatewayOrderId)
      : null;
    if (!gatewayTransaction) {
      result = { ok: true, ignored: true, reason: 'unknown_session' };
      return;
    }
    const alreadyCompleted = gatewayTransaction.status === 'COMPLETED';
    result = await markStripeGatewayStatus(client, gatewayTransaction, alreadyCompleted ? 'COMPLETED' : status, {
      gateway_payment_id: alreadyCompleted ? null : (session.payment_intent || session.id),
      notify_payload: { eventType, session },
      status_message: alreadyCompleted ? `Ignored ${eventType} after completed settlement` : `Stripe ${eventType}`,
      method: 'STRIPE_CHECKOUT',
    });
  });
  return result;
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
      payment = await recordPaymentWithLockedInvoice(client, invoice, data, actor);
    });
    return payment;
  },

  async initiateStripeCheckout(invoiceId, userId, data = {}) {
    requireStripeConfig();
    const invoiceIdNum = Number(invoiceId);
    if (!Number.isInteger(invoiceIdNum) || invoiceIdNum <= 0) {
      throw new AppError('VALIDATION_ERROR', 'Invalid invoice id', 422);
    }

    let pending;
    await tx(async (client) => {
      const invoice = await repo.lockInvoice(client, invoiceIdNum);
      if (!invoice) throw new AppError('NOT_FOUND', 'Invoice not found', 404);
      if (invoice.buyer_user_id !== userId) throw new AppError('FORBIDDEN', 'Access denied', 403);
      if (['CANCELLED', 'VOID'].includes(invoice.status)) {
        throw new AppError('INVALID_STATE', 'Cannot pay a void invoice', 409);
      }

      const adjustments = await repo.sumAdjustments(client, invoiceIdNum);
      const balance = calculateBalanceDue(Number(invoice.total_amount), Number(invoice.paid_amount), adjustments);
      if (toCents(balance) <= 0) {
        throw new AppError('ALREADY_SETTLED', 'Invoice has no balance due', 409);
      }

      const requestedAmount = data.amount == null ? balance : roundMoney(data.amount);
      if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
        throw new AppError('VALIDATION_ERROR', 'Payment amount must be a positive number', 422);
      }
      if (toCents(requestedAmount) > toCents(balance)) {
        throw new AppError('OVERPAYMENT', `Amount exceeds balance due. Maximum acceptable: ${balance.toFixed(2)}`, 422, { maxAcceptable: balance });
      }

      const gatewayOrderId = `stripe-${invoice.id}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
      const gatewayTransaction = await repo.createGatewayTransaction(client, {
        gateway: GATEWAY,
        gateway_order_id: gatewayOrderId,
        invoice_id: invoice.id,
        buyer_id: invoice.buyer_id,
        amount: requestedAmount,
        currency: stripeCurrency().toUpperCase(),
        status: 'INITIATED',
        checkout_payload: { provider: GATEWAY, gateway_order_id: gatewayOrderId, invoice_no: invoice.invoice_no },
        created_by: userId,
      });

      await writeAudit({
        actor: userId,
        action: 'STRIPE_CHECKOUT_INITIATED',
        entityType: 'payment_gateway_transactions',
        entityId: String(gatewayTransaction.id),
        after: { invoice_id: invoice.id, gateway_order_id: gatewayOrderId, amount: requestedAmount },
      }, client);

      pending = { invoice, gatewayTransaction, requestedAmount };
    });

    try {
      const { session, params } = await createStripeSession(pending.invoice, pending.gatewayTransaction, pending.requestedAmount);
      await tx(async (client) => {
        await markStripeGatewayStatus(client, pending.gatewayTransaction, 'PENDING', {
          checkout_payload: {
            provider: GATEWAY,
            session_id: session.id,
            checkout_url: session.url,
            request: params,
          },
          status_message: 'Stripe Checkout Session created',
        });
      });

      return {
        provider: GATEWAY,
        checkout_url: session.url,
        session_id: session.id,
        transaction: {
          id: pending.gatewayTransaction.id,
          gateway_order_id: pending.gatewayTransaction.gateway_order_id,
          status: 'PENDING',
          amount: pending.requestedAmount,
          currency: stripeCurrency().toUpperCase(),
        },
      };
    } catch (err) {
      await tx(async (client) => {
        await markStripeGatewayStatus(client, pending.gatewayTransaction, 'FAILED', {
          status_message: err.message || 'Stripe Checkout Session creation failed',
        });
      }).catch(() => {});
      throw err.isOperational ? err : new AppError('STRIPE_CHECKOUT_FAILED', err.message || 'Stripe Checkout Session creation failed', 502);
    }
  },

  async reverse(id, data, actor) {
    await tx(async (client) => {
      const payment = await repo.lockPayment(client, id);
      if (!payment) throw new AppError('NOT_FOUND', 'Payment not found', 404);
      if (payment.reversed_at) throw new AppError('ALREADY_REVERSED', 'Payment is already reversed', 409);

      let approver = null;
      if (Number(payment.amount) > PAYMENT_REVERSAL_SECOND_APPROVAL_THRESHOLD) {
        approver = await assertSecondOfficerApproval(data, actor);
      }

      const reversed = await repo.markReversed(client, id, data.reason);
      if (!reversed) throw new AppError('ALREADY_REVERSED', 'Payment is already reversed', 409);

      const invoice = await repo.lockInvoice(client, payment.invoice_id);
      if (invoice) {
        const adjustments = await repo.sumAdjustments(client, payment.invoice_id);
        const newPaid = Math.max(0, roundMoney(Number(invoice.paid_amount) - Number(payment.amount)));
        const newBalance = calculateBalanceDue(Number(invoice.total_amount), newPaid, adjustments);
        const status = invoiceStatus(invoice.total_amount, adjustments, newPaid, newBalance);
        await repo.updateInvoice(client, payment.invoice_id, newPaid, newBalance, status);
      }
      await writeAudit({
        actor,
        action: 'PAYMENT_REVERSED',
        entityType: 'payments',
        entityId: String(id),
        after: { reason: data.reason, confirmedBy: approver?.id || null },
      }, client);
    });
  },

  async stripeWebhook(rawBody, signature) {
    if (!env.STRIPE_WEBHOOK_SECRET) {
      throw new AppError('STRIPE_WEBHOOK_NOT_CONFIGURED', 'Stripe webhook secret is not configured', 503);
    }
    if (!signature) {
      throw new AppError('STRIPE_SIGNATURE_MISSING', 'Missing Stripe-Signature header', 400);
    }

    let event;
    try {
      event = Stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      await writeAudit({ actor: null, action: 'STRIPE_BAD_SIGNATURE', entityType: 'payments', entityId: '', after: { message: err.message } }).catch(() => {});
      throw new AppError('STRIPE_BAD_SIGNATURE', 'Invalid Stripe webhook signature', 400);
    }

    const session = event.data?.object;
    switch (event.type) {
      case 'checkout.session.completed':
        if (session.payment_status === 'paid') {
          return handleStripeSessionPaid(session, event.type);
        }
        return handleStripeSessionPendingOrFailed(session, 'PENDING', event.type);
      case 'checkout.session.async_payment_succeeded':
        return handleStripeSessionPaid(session, event.type);
      case 'checkout.session.async_payment_failed':
        return handleStripeSessionPendingOrFailed(session, 'FAILED', event.type);
      case 'checkout.session.expired':
        return handleStripeSessionPendingOrFailed(session, 'CANCELLED', event.type);
      default:
        return { ok: true, ignored: true, eventType: event.type };
    }
  },
};

module.exports = service;
module.exports.invoiceStatus = invoiceStatus;
