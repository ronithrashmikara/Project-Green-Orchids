const { AppError } = require('../../middleware/errors');
const { writeAudit } = require('../../middleware/audit');
const repo = require('./tiers.repository');

const service = {
  async list() {
    return repo.findAll();
  },
  async create(data, actor) {
    const tier = await repo.create(data);
    await writeAudit({ actor, action: 'TIER_CREATED', entity: 'buyer_tiers', entityId: String(tier.id), after: data });
    return tier;
  },
  async update(id, data, actor) {
    const existing = await repo.findById(id);
    if (!existing) throw new AppError('NOT_FOUND', 'Tier not found', 404);
    const tier = await repo.update(id, data);
    await writeAudit({ actor, action: 'TIER_UPDATED', entity: 'buyer_tiers', entityId: String(id), before: existing, after: data });
    return tier;
  },
  async remove(id, actor) {
    const existing = await repo.findById(id);
    if (!existing) throw new AppError('NOT_FOUND', 'Tier not found', 404);
    const buyerCount = await repo.countBuyersOnTier(id);
    if (buyerCount > 0) throw new AppError('TIER_IN_USE', `${buyerCount} buyer(s) are assigned to this tier`, 409);
    await repo.remove(id);
    await writeAudit({ actor, action: 'TIER_DELETED', entity: 'buyer_tiers', entityId: String(id), before: existing });
  },
};
module.exports = service;
