const repo = require('./finance.repository');
const service = {
  async getCreditMonitor() {
    const rows = await repo.getCreditMonitor();
    return rows.map((r) => ({ ...r, creditLimit: Number(r.creditLimit), creditUsed: Number(r.creditUsed) }));
  },
};
module.exports = service;
