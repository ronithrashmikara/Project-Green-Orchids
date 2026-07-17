const { Router } = require('express');
const c = require('./delivery.controller');
const { requireAuth } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/rbac');
const { validate } = require('../../middleware/validate');
const { makeUploader } = require('../../middleware/upload');
const { assignSchema } = require('./delivery.schema');

const podUpload = makeUploader('pod');
const r = Router();
r.use(requireAuth);

r.get('/',           requirePermission('delivery.view'), c.list);
r.get('/:id',        requirePermission('delivery.view'), c.get);
r.get('/:id/events', requirePermission('delivery.view'), c.getEvents);
r.get('/:id/pod-file', requirePermission('delivery.view', 'pod.upload'), c.getPodFile);

r.patch('/:id/assign',     requirePermission('delivery.assign'), validate({ body: assignSchema }), c.assign);
r.patch('/:id/dispatch',   requirePermission('delivery.update'), c.dispatch);
r.patch('/:id/in-transit', requirePermission('delivery.update'), c.inTransit);
r.patch('/:id/pod',        requirePermission('pod.upload'), podUpload.single('photo'), c.uploadPod);
r.patch('/:id/fail',       requirePermission('delivery.update'), c.fail);
r.patch('/:id/cancel',     requirePermission('delivery.update'), c.cancel);

module.exports = r;
