const { Router } = require('express');
const ctrl = require('./users.controller');
const { requireAuth } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/rbac');
const { validate } = require('../../middleware/validate');
const { createUserSchema, updateUserSchema } = require('./users.schema');

const router = Router();
router.use(requireAuth, requirePermission('ADMIN'));

router.get('/', ctrl.list);
router.post('/', validate({ body: createUserSchema }), ctrl.create);
router.get('/:id', ctrl.get);
router.patch('/:id', validate({ body: updateUserSchema }), ctrl.update);
router.get('/:id/login-history', ctrl.loginHistory);

module.exports = router;
