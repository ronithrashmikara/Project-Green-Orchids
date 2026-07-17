const { AppError } = require('../../middleware/errors');
const { writeAudit } = require('../../middleware/audit');
const { bustUserStatus } = require('../../middleware/auth');
const { paginate } = require('../../utils/pagination');
const repo = require('./security.repository');

const SETTING_KEYS = {
  sessionCap: 'security.session_cap',
  lockoutThreshold: 'security.lockout_threshold',
  lockoutDuration: 'security.lockout_duration_minutes',
};
const DEFAULTS = { sessionCap: 3, lockoutThreshold: 5, lockoutDuration: 15 };

const service = {
  async listLogins(queryParams) {
    const o = paginate(queryParams);
    const { rows, total } = await repo.findLogins(
      { user: queryParams.user, outcome: queryParams.outcome, ip: queryParams.ip, dateFrom: queryParams.dateFrom, dateTo: queryParams.dateTo },
      o
    );
    return { data: rows, pagination: { page: o.page, limit: o.limit, total, pages: Math.ceil(total / o.limit) } };
  },

  async listSessions() {
    return repo.findActiveSessions();
  },

  async forceLogout(sessionId, actor) {
    await repo.forceLogout(sessionId, actor);
    await writeAudit({ actor, action: 'SESSION_FORCE_LOGOUT', entity: 'auth_sessions', entityId: sessionId });
  },

  async listLockedAccounts() {
    return repo.findLockedAccounts();
  },

  async unlockAccount(userId, actor) {
    await repo.unlockAccount(userId);
    bustUserStatus(userId);
    await writeAudit({ actor, action: 'ACCOUNT_UNLOCKED', entity: 'users', entityId: userId });
  },

  async listAuditLogs(queryParams) {
    const o = paginate(queryParams);
    const { rows, total } = await repo.findAuditLogs(
      { actor: queryParams.actor, action: queryParams.action, entity: queryParams.entity, dateFrom: queryParams.dateFrom, dateTo: queryParams.dateTo },
      o
    );
    return { data: rows, pagination: { page: o.page, limit: o.limit, total, pages: Math.ceil(total / o.limit) } };
  },

  async getAccessWindowSettings() {
    const stored = await repo.getSettings(Object.values(SETTING_KEYS));
    const result = { ...DEFAULTS };
    for (const [name, dbKey] of Object.entries(SETTING_KEYS)) {
      if (stored.has(dbKey)) result[name] = stored.get(dbKey);
    }
    return result;
  },

  async saveAccessWindowSettings(data, actor) {
    for (const [name, dbKey] of Object.entries(SETTING_KEYS)) {
      if (data[name] !== undefined) await repo.setSetting(dbKey, Number(data[name]));
    }
    await writeAudit({ actor, action: 'SECURITY_SETTINGS_UPDATED', entity: 'settings', entityId: 'security', after: data });
    return service.getAccessWindowSettings();
  },
};
module.exports = service;
