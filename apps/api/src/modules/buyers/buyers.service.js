const { tx } = require('../../config/db');
const { sendMail } = require('../../config/mailer');
const { AppError } = require('../../middleware/errors');
const { writeAudit } = require('../../middleware/audit');
const buyersRepository = require('./buyers.repository');
const authRepository = require('../auth/auth.repository');
const { paginate } = require('../../utils/pagination');

const buyersService = {
  async listBuyers(queryParams) {
    const pageOpts = paginate(queryParams);
    const filters = {
      status: queryParams.status,
      tier: queryParams.tier,
      search: queryParams.search,
    };
    const { rows, total } = await buyersRepository.findAll(filters, pageOpts);
    return {
      data: rows,
      pagination: { page: pageOpts.page, limit: pageOpts.limit, total, pages: Math.ceil(total / pageOpts.limit) },
    };
  },

  async getBuyer(userId) {
    const buyer = await buyersRepository.findById(userId);
    if (!buyer) throw new AppError('NOT_FOUND', 'Buyer not found', 404);
    return buyer;
  },

  async approve(userId, data, actor) {
    const buyer = await buyersRepository.findById(userId);
    if (!buyer) throw new AppError('NOT_FOUND', 'Buyer not found', 404);
    if (buyer.account_status === 'APPROVED') throw new AppError('ALREADY_APPROVED', 'Buyer is already approved', 409);

    await tx(async (client) => {
      await buyersRepository.approve(client, {
        userId, tier: data.tier, creditLimit: data.credit_limit,
        paymentTerms: data.payment_terms, approvedBy: actor,
      });
    });

    await writeAudit({
      actor, action: 'BUYER_APPROVED', entity: 'trade_accounts', entityId: buyer.trade_account_id,
      before: { account_status: buyer.account_status }, after: { account_status: 'APPROVED', tier: data.tier },
    });

    try {
      const user = await authRepository.findUserById(userId);
      await sendMail({
        to: user.email, subject: 'Trade Account Approved - ORCHIDS',
        template: 'buyer_approved', data: {
          name: buyer.name, creditLimit: data.credit_limit,
          paymentTerms: data.payment_terms, tier: data.tier,
          loginUrl: `${process.env.CORS_ORIGIN || ''}/login`,
        },
      });
    } catch (_) {}
  },

  async reject(userId, reason, actor) {
    const buyer = await buyersRepository.findById(userId);
    if (!buyer) throw new AppError('NOT_FOUND', 'Buyer not found', 404);

    await tx(async (client) => {
      await buyersRepository.reject(client, { userId, reason });
    });

    await writeAudit({
      actor, action: 'BUYER_REJECTED', entity: 'trade_accounts', entityId: buyer.trade_account_id,
      after: { reason },
    });

    try {
      const user = await authRepository.findUserById(userId);
      await sendMail({ to: user.email, subject: 'Trade Account Update - ORCHIDS', template: 'buyer_rejected', data: { name: buyer.name, reason } });
    } catch (_) {}
  },

  async suspend(userId, reason, actor) {
    const buyer = await buyersRepository.findById(userId);
    if (!buyer) throw new AppError('NOT_FOUND', 'Buyer not found', 404);

    await tx(async (client) => {
      await buyersRepository.suspend(client, { userId, reason });
      await authRepository.revokeAllUserSessions(client, userId);
    });
    // Instant revocation: drop the cached ACTIVE status (Finding 18 / F4.1)
    require('../../middleware/auth').bustUserStatus(userId);

    await writeAudit({
      actor, action: 'BUYER_SUSPENDED', entity: 'trade_accounts', entityId: buyer.trade_account_id,
      after: { reason },
    });

    try {
      const user = await authRepository.findUserById(userId);
      await sendMail({ to: user.email, subject: 'Account Suspended - ORCHIDS', template: 'buyer_suspended', data: { name: buyer.name, reason } });
    } catch (_) {}
  },

  async reactivate(userId, actor) {
    const buyer = await buyersRepository.findById(userId);
    if (!buyer) throw new AppError('NOT_FOUND', 'Buyer not found', 404);

    await tx(async (client) => {
      await buyersRepository.reactivate(client, userId);
    });

    await writeAudit({ actor, action: 'BUYER_REACTIVATED', entity: 'trade_accounts', entityId: buyer.trade_account_id });
  },

  async updateCredit(userId, data, actor) {
    const buyer = await buyersRepository.findById(userId);
    if (!buyer) throw new AppError('NOT_FOUND', 'Buyer not found', 404);

    const before = { credit_limit: buyer.credit_limit };
    await tx(async (client) => {
      await buyersRepository.updateCredit(client, { userId, creditLimit: data.credit_limit });
    });

    await writeAudit({
      actor, action: 'CREDIT_UPDATED', entity: 'trade_accounts', entityId: buyer.trade_account_id,
      before, after: { credit_limit: data.credit_limit, reason: data.reason },
    });
  },

  async updateTier(userId, data, actor) {
    const buyer = await buyersRepository.findById(userId);
    if (!buyer) throw new AppError('NOT_FOUND', 'Buyer not found', 404);

    const before = { tier: buyer.tier };
    await tx(async (client) => {
      await buyersRepository.updateTier(client, { userId, tier: data.tier });
    });

    await writeAudit({
      actor, action: 'TIER_CHANGED', entity: 'trade_accounts', entityId: buyer.trade_account_id,
      before, after: { tier: data.tier, reason: data.reason },
    });
  },

  async getRelated(userId, type, queryParams) {
    const buyer = await buyersRepository.findById(userId);
    if (!buyer) throw new AppError('NOT_FOUND', 'Buyer not found', 404);
    const pageOpts = paginate(queryParams);

    let result;
    switch (type) {
      case 'orders': result = await buyersRepository.findRelatedOrders(userId, pageOpts); break;
      case 'invoices': result = await buyersRepository.findRelatedInvoices(userId, pageOpts); break;
      case 'payments': result = await buyersRepository.findRelatedPayments(userId, pageOpts); break;
      case 'rma': result = await buyersRepository.findRelatedRMAs(userId, pageOpts); break;
      default: throw new AppError('INVALID_TYPE', 'Invalid related data type', 400);
    }

    return {
      data: result.rows,
      pagination: { page: pageOpts.page, limit: pageOpts.limit, total: result.total, pages: Math.ceil(result.total / pageOpts.limit) },
    };
  },
};

module.exports = buyersService;
