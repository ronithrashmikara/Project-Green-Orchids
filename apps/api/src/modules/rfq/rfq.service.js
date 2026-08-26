const { tx } = require('../../config/db');
const { sendMail } = require('../../config/mailer');
const { AppError } = require('../../middleware/errors');
const { assertTransition } = require('../../utils/stateMachine');
const { paginate } = require('../../utils/pagination');
const repo = require('./rfq.repository');

const service = {
  async create(data, buyerId) {
    const acct = await repo.accountIdForUser(buyerId);
    if (!acct) throw new AppError('NO_ACCOUNT', 'No trade account for this user', 403);
    const rfqNumber = await repo.nextRfqNumber();
    let rfq;
    await tx(async (client) => {
      rfq = await repo.create(client, { rfq_number: rfqNumber, buyer_id: acct.id, notes: data.notes });
      for (const item of data.items) {
        await repo.createItem(client, { rfq_id: rfq.id, product_id: item.product_id, quantity: item.quantity, notes: item.notes });
      }
    });
    try {
      const user = await require('../auth/auth.repository').findUserById(buyerId);
      await sendMail({ to: user.email, subject: 'RFQ Received - Orchids', template: 'rfq_received', data: { name: user.name, rfqNumber, itemCount: data.items.length } });
    } catch (_) {}
    return rfq;
  },

  async list(queryParams, userId, isAdmin) {
    const o = paginate(queryParams);
    const acct = isAdmin ? null : await repo.accountIdForUser(userId);
    const { rows, total } = await repo.findAll(isAdmin ? null : acct?.id, isAdmin, o);
    return { data: rows, pagination: { page: o.page, limit: o.limit, total, pages: Math.ceil(total / o.limit) } };
  },

  async get(id, userId, isAdmin) {
    const rfq = await repo.findById(id);
    if (!rfq) throw new AppError('NOT_FOUND', 'RFQ not found', 404);
    if (!isAdmin) {
      const acct = await repo.accountIdForUser(userId);
      if (!acct || rfq.buyer_id !== acct.id) throw new AppError('FORBIDDEN', 'Access denied', 403);
    }
    const items = await repo.findItems(id);
    return {
      id: rfq.id,
      rfqNo: rfq.rfq_no,
      status: rfq.status,
      notes: rfq.buyer_note,
      quoteExpiry: rfq.quote_expiry,
      quotedAt: rfq.quoted_at,
      createdAt: rfq.created_at,
      expiresAt: rfq.quote_expiry,
      buyerName: rfq.buyer_name,
      buyerEmail: rfq.buyer_email,
      buyerTier: rfq.buyer_tier,
      buyerBalance: Number(rfq.buyer_balance || 0),
      lines: items.map((it) => ({
        id: it.id,
        productId: it.product_id,
        productName: it.product_name,
        quantity: it.requested_qty,
        targetPrice: it.requested_unit_price,
        quotedPrice: it.quoted_unit_price,
      })),
    };
  },

  async review(id, data, role) {
    const rfq = await repo.findById(id);
    if (!rfq) throw new AppError('NOT_FOUND', 'RFQ not found', 404);
    assertTransition('RFQ', rfq.status, 'UNDER_REVIEW', role);
    const updated = await repo.setStatus(null, id, 'UNDER_REVIEW', 'SUBMITTED');
    if (!updated) throw new AppError('INVALID_TRANSITION', 'RFQ was updated by another request', 409);
    return { ...rfq, status: 'UNDER_REVIEW' };
  },

  async quote(id, data, role) {
    const rfq = await repo.findById(id);
    if (!rfq) throw new AppError('NOT_FOUND', 'RFQ not found', 404);
    assertTransition('RFQ', rfq.status, 'QUOTED', role);

    // A quote that already expires in the past is meaningless — reject it here rather
    // than in the Zod schema, since "not before today" is a business rule, not a format check.
    if (data.quote_expiry && new Date(data.quote_expiry).getTime() < Date.now()) {
      throw new AppError('INVALID_EXPIRY', 'Quote expiry date cannot be in the past', 422);
    }

    await tx(async (client) => {
      for (const item of data.items) {
        await repo.updateItemQuote(client, { itemId: item.rfq_item_id, quotedPrice: item.quoted_price });
      }
      // Persist a default 7-day expiry when the admin quotes without one
      // (Audit P1-6): the email already promised "7 days" — now the data agrees.
      const expiry = data.quote_expiry || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await repo.setQuoteExpiry(client, id, expiry);
      const quoted = await repo.setStatus(client, id, 'QUOTED', rfq.status);
      if (!quoted) throw new AppError('INVALID_TRANSITION', 'RFQ was updated by another request', 409);
    });

    try {
      const user = await require('../auth/auth.repository').findUserById(rfq.buyer_id);
      // Column fixes (Audit P1-3): totals read quoted_unit_price × requested_qty
      // (the old code summed i.quoted_price × i.quantity — both undefined → 0.00),
      // and the RFQ number column is rfq_no.
      const totalAmount = items.reduce((s, i) => s + (Number(i.quoted_unit_price) || 0) * i.requested_qty, 0);
      const expiryLabel = new Date(data.quote_expiry || Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      await sendMail({ to: user.email, subject: 'RFQ Quoted - Orchids', template: 'rfq_quoted', data: { name: user.name, rfqNumber: rfq.rfq_no, totalAmount: totalAmount.toFixed(2), quoteExpiry: expiryLabel, rfqUrl: '' } });
    } catch (_) {}
  },

  async decline(id, data, role) {
    const rfq = await repo.findById(id);
    if (!rfq) throw new AppError('NOT_FOUND', 'RFQ not found', 404);
    assertTransition('RFQ', rfq.status, 'DECLINED', role);
    await tx(async (client) => {
      await repo.setDeclineReason(client, id, data.reason);
      const declined = await repo.setStatus(client, id, 'DECLINED', rfq.status);
      if (!declined) throw new AppError('INVALID_TRANSITION', 'RFQ was updated by another request', 409);
    });

    try {
      const user = await require('../auth/auth.repository').findUserById(rfq.buyer_id);
      await sendMail({ to: user.email, subject: 'RFQ Declined - Orchids', template: 'rfq_declined', data: { name: user.name, rfqNumber: rfq.rfq_no, reason: data.reason } });
    } catch (_) {}
  },

  async accept(id, userId, role) {
    const acct = await repo.accountIdForUser(userId);
    const rfq = await repo.findById(id);
    if (!rfq) throw new AppError('NOT_FOUND', 'RFQ not found', 404);
    if (!acct || rfq.buyer_id !== acct.id) throw new AppError('FORBIDDEN', 'Access denied', 403);
    assertTransition('RFQ', rfq.status, 'ACCEPTED', role);
    const accepted = await repo.setStatus(null, id, 'ACCEPTED', 'QUOTED');
    if (!accepted) throw new AppError('INVALID_TRANSITION', 'RFQ was updated by another request', 409);
  },

  async reject(id, userId, role) {
    const acct = await repo.accountIdForUser(userId);
    const rfq = await repo.findById(id);
    if (!rfq) throw new AppError('NOT_FOUND', 'RFQ not found', 404);
    if (!acct || rfq.buyer_id !== acct.id) throw new AppError('FORBIDDEN', 'Access denied', 403);
    assertTransition('RFQ', rfq.status, 'REJECTED', role);
    const rejected = await repo.setStatus(null, id, 'REJECTED', 'QUOTED');
    if (!rejected) throw new AppError('INVALID_TRANSITION', 'RFQ was updated by another request', 409);
  },

};
module.exports = service;
