const { AppError } = require('../../middleware/errors');
const repo = require('./suppliers.repository');
const { paginate } = require('../../utils/pagination');

const service = {
  async list(q) { const o = paginate(q); const { rows, total } = await repo.findAll({ ...o, search: q.search }); return { data: rows, pagination: { page: o.page, limit: o.limit, total, pages: Math.ceil(total / o.limit) } }; },
  async get(id) { const s = await repo.findById(id); if (!s) throw new AppError('NOT_FOUND', 'Supplier not found', 404); return s; },
  async create(data) { return repo.create(data); },
  async update(id, data) { await this.get(id); return repo.update(id, data); },
  async remove(id) { await this.get(id); await repo.remove(id); },
  async getProducts(id, q) { await this.get(id); const o = paginate(q); const { rows, total } = await repo.findProducts(id, o); return { data: rows, pagination: { page: o.page, limit: o.limit, total, pages: Math.ceil(total / o.limit) } }; },
};
module.exports = service;
