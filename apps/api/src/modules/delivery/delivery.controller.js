const svc = require('./delivery.service');
const path = require('path');
const { publicUrl, UPLOADS_ROOT } = require('../../middleware/upload');
const { AppError } = require('../../middleware/errors');

const list = async (req, res, next) => {
  try {
    const { status, assignedTo } = req.query;
    res.json(await svc.list({ assignedTo, status }));
  } catch (e) { next(e); }
};

const get = async (req, res, next) => {
  try { res.json(await svc.getById(Number(req.params.id))); }
  catch (e) { next(e); }
};

const getEvents = async (req, res, next) => {
  try { res.json(await svc.events(Number(req.params.id))); }
  catch (e) { next(e); }
};

const getPodFile = async (req, res, next) => {
  try {
    const delivery = await svc.getById(Number(req.params.id));
    const expectedPrefix = '/uploads/pod/';
    if (!delivery.pod_url || !delivery.pod_url.startsWith(expectedPrefix)) {
      throw new AppError('POD_NOT_FOUND', 'Proof-of-delivery file not found', 404);
    }
    const filename = path.basename(delivery.pod_url);
    if (filename !== delivery.pod_url.slice(expectedPrefix.length)) {
      throw new AppError('INVALID_POD_PATH', 'Invalid proof-of-delivery path', 400);
    }
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(filename, { root: path.join(UPLOADS_ROOT, 'pod'), dotfiles: 'deny' }, (err) => {
      if (err && !res.headersSent) next(new AppError('POD_NOT_FOUND', 'Proof-of-delivery file not found', 404));
    });
  } catch (e) { next(e); }
};

const assign = async (req, res, next) => {
  try {
    const { assignedTo } = req.body;
    res.json(await svc.assign(Number(req.params.id), assignedTo, req.user.id));
  } catch (e) { next(e); }
};

const dispatch = async (req, res, next) => {
  try { res.json(await svc.transition(Number(req.params.id), 'DISPATCHED', { actorId: req.user.id })); }
  catch (e) { next(e); }
};

const inTransit = async (req, res, next) => {
  try { res.json(await svc.transition(Number(req.params.id), 'IN_TRANSIT', { actorId: req.user.id })); }
  catch (e) { next(e); }
};

const uploadPod = async (req, res, next) => {
  try {
    const podUrl = req.file ? publicUrl('pod', req.file.filename) : null;
    if (!podUrl) return res.status(400).json({ success: false, error: { code: 'POD_REQUIRED', message: 'A proof-of-delivery photo is required' } });
    res.json(await svc.transition(Number(req.params.id), 'DELIVERED', { podUrl, actorId: req.user.id }));
  } catch (e) { next(e); }
};

const fail = async (req, res, next) => {
  try {
    const { note } = req.body;
    res.json(await svc.transition(Number(req.params.id), 'FAILED', { note, actorId: req.user.id }));
  } catch (e) { next(e); }
};

const cancel = async (req, res, next) => {
  try { res.json(await svc.transition(Number(req.params.id), 'CANCELLED', { actorId: req.user.id })); }
  catch (e) { next(e); }
};

module.exports = { list, get, getEvents, getPodFile, assign, dispatch, inTransit, uploadPod, fail, cancel };
