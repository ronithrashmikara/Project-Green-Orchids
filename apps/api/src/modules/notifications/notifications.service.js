const { AppError } = require('../../middleware/errors');
const { paginate } = require('../../utils/pagination');
const repo = require('./notifications.repository');
const { sendMail } = require('../../config/mailer');

const service = {
  async listOutbox(q) {
    const o = paginate(q);
    const { rows, total } = await repo.findOutbox({ ...o, status: q.status });
    return { data: rows, pagination: { page: o.page, limit: o.limit, total, pages: Math.ceil(total / o.limit) } };
  },
  async retry(id) {
    const item = await repo.findOutboxById(id);
    if (!item) throw new AppError('NOT_FOUND', 'Notification not found', 404);
    if (item.status !== 'FAILED') throw new AppError('INVALID_STATE', 'Can only retry failed notifications', 409);

    try {
      await sendMail({
        to: item.recipient_email, subject: `Orchids: ${item.template}`,
        template: item.template, data: item.payload || {},
      });
      await repo.updateStatus(null, id, 'SENT');
    } catch (err) {
      await repo.updateStatus(null, id, 'FAILED');
      throw err;
    }
  },
  async getHealth() {
    return repo.getHealthStats();
  },
};
module.exports = service;
