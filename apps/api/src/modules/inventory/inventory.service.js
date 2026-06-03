const { AppError } = require('../../middleware/errors');
const { paginate } = require('../../utils/pagination');
const repo = require('./inventory.repository');
const { stringify } = require('csv-stringify/sync');

const service = {
  async getMovements(q) {
    const o = paginate(q);
    const filters = { product_id: q.product_id, movement_type: q.movement_type, from: q.from, to: q.to };
    const { rows, total } = await repo.findMovements(filters, o);
    return { data: rows, pagination: { page: o.page, limit: o.limit, total, pages: Math.ceil(total / o.limit) } };
  },
  async exportMovements(q) {
    const filters = { product_id: q.product_id, movement_type: q.movement_type, from: q.from, to: q.to };
    const rows = await repo.findMovementsForExport(filters);
    const csv = stringify(rows, { header: true });
    return csv;
  },
  async getAlerts(q) {
    const o = paginate(q);
    const { rows, total } = await repo.findAlerts({ status: q.status }, o);
    return { data: rows, pagination: { page: o.page, limit: o.limit, total, pages: Math.ceil(total / o.limit) } };
  },
  async ackAlert(id, data, actor) {
    await repo.ackAlert(id, actor, data.note);
  },
  async getSummary() {
    return repo.getSummary();
  },
};
module.exports = service;
