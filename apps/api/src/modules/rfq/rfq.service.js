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
      await sendMail({ to: user.email, subject: 'RFQ Received - ORCHIDS', template: 'rfq_received', data: { name: user.name, rfqNumber, itemCount: data.items.length } });
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
    await repo.updateStatus(null, id, 'UNDER_REVIEW');
    return { ...rfq, status: 'UNDER_REVIEW' };
  },

  async quote(id, data, role) {
    const rfq = await repo.findById(id);
    if (!rfq) throw new AppError('NOT_FOUND', 'RFQ not found', 404);
    assertTransition('RFQ', rfq.status, 'QUOTED', role);

    await tx(async (client) => {
      for (const item of data.items) {
        await repo.updateItemQuote(client, { itemId: item.rfq_item_id, quotedPrice: item.quoted_price, notes: item.notes });
      }
      if (data.quote_expiry) {
        await repo.setQuoteExpiry(client, id, data.quote_expiry);
      }
      await repo.updateStatus(client, id, 'QUOTED');
    });

    try {
      const user = await require('../auth/auth.repository').findUserById(rfq.buyer_id);
      const items = await repo.findItems(id);
      const totalAmount = items.reduce((s, i) => s + (Number(i.quoted_price) || 0) * i.quantity, 0);
      await sendMail({ to: user.email, subject: 'RFQ Quoted - ORCHIDS', template: 'rfq_quoted', data: { name: user.name, rfqNumber: rfq.rfq_number, totalAmount: totalAmount.toFixed(2), quoteExpiry: data.quote_expiry || '7 days', rfqUrl: '' } });
    } catch (_) {}
  },

  async decline(id, data, role) {
    const rfq = await repo.findById(id);
    if (!rfq) throw new AppError('NOT_FOUND', 'RFQ not found', 404);
    assertTransition('RFQ', rfq.status, 'DECLINED', role);

    await tx(async (client) => {
      await repo.setDeclineReason(client, id, data.reason);
      await repo.updateStatus(client, id, 'DECLINED');
    });

    try {
      const user = await require('../auth/auth.repository').findUserById(rfq.buyer_id);
      await sendMail({ to: user.email, subject: 'RFQ Declined - ORCHIDS', template: 'rfq_declined', data: { name: user.name, rfqNumber: rfq.rfq_number, reason: data.reason } });
    } catch (_) {}
  },

  async accept(id, userId, role) {
    const acct = await repo.accountIdForUser(userId);
    const rfq = await repo.findById(id);
    if (!rfq) throw new AppError('NOT_FOUND', 'RFQ not found', 404);
    if (!acct || rfq.buyer_id !== acct.id) throw new AppError('FORBIDDEN', 'Access denied', 403);
    assertTransition('RFQ', rfq.status, 'ACCEPTED', role);
    await repo.updateStatus(null, id, 'ACCEPTED');
  },

  async reject(id, userId, role) {
    const acct = await repo.accountIdForUser(userId);
    const rfq = await repo.findById(id);
    if (!rfq) throw new AppError('NOT_FOUND', 'RFQ not found', 404);
    if (!acct || rfq.buyer_id !== acct.id) throw new AppError('FORBIDDEN', 'Access denied', 403);
    assertTransition('RFQ', rfq.status, 'REJECTED', role);
    await repo.updateStatus(null, id, 'REJECTED');
  },

  async convertToOrder(id, userId) {
    const acct = await repo.accountIdForUser(userId);
    const rfq = await repo.findById(id);
    if (!rfq) throw new AppError('NOT_FOUND', 'RFQ not found', 404);
    if (!acct || rfq.buyer_id !== acct.id) throw new AppError('FORBIDDEN', 'Access denied', 403);
    if (rfq.status !== 'ACCEPTED') throw new AppError('INVALID_STATE', 'RFQ must be accepted to convert', 409);

    const items = await repo.findItems(id);
    // This is handled by the orders service
    return { rfq, items };
  },
};
module.exports = service;
