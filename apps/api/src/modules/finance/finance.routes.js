const { Router } = require('express');
const c = require('./finance.controller');
const { requireAuth } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/rbac');
const r = Router();
r.use(requireAuth, requirePermission('credit.view'));
r.get('/credit', c.credit);
module.exports = r;
