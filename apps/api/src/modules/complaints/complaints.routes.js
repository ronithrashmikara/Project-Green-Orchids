const { Router } = require('express');
const c = require('./complaints.controller');
const { requireAuth } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/rbac');
const { validate } = require('../../middleware/validate');
const { createSchema, messageSchema, updateSchema } = require('./complaints.schema');
const r = Router(); r.use(requireAuth);
// /queue before /:id so it isn't swallowed by the param route
r.get('/queue', requirePermission('complaint.handle'), c.queue);
r.post('/', requirePermission('complaint.create'), validate({ body: createSchema }), c.create);
r.get('/', requirePermission('complaint.view.own', 'complaint.view.all'), c.list);
r.get('/:id', requirePermission('complaint.view.own', 'complaint.view.all'), c.get);
r.post('/:id/messages', requirePermission('complaint.create', 'complaint.handle'), validate({ body: messageSchema }), c.addMessage);
r.patch('/:id', requirePermission('complaint.handle'), validate({ body: updateSchema }), c.update);
module.exports = r;
