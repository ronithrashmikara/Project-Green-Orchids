const { Router } = require('express');
const c = require('./notifications.controller');
const { requireAuth } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/rbac');
const r = Router(); r.use(requireAuth, requirePermission('ADMIN'));
r.get('/outbox', c.list);
r.post('/outbox/:id/retry', c.retry);
r.get('/outbox/health', c.health);
module.exports = r;
