const { AppError } = require('../../middleware/errors');
const repo = require('./cms.repository');

const service = {
  // includeUnpublished must only ever be true for an authenticated (admin) request — an
  // unauthenticated visitor must never see draft/unpublished content (Finding: the public
  // GET /cms/blocks previously returned every block regardless of is_published).
  async list(includeUnpublished) { return repo.findAll(!!includeUnpublished); },
  async get(key, includeUnpublished) {
    const b = await repo.findByKey(key);
    if (!b || (!b.is_published && !includeUnpublished)) throw new AppError('NOT_FOUND', 'CMS block not found', 404);
    return b;
  },
  async create(data, actorId) { const existing = await repo.findByKey(data.key); if (existing) throw new AppError('KEY_EXISTS', 'CMS block with this key already exists', 409); return repo.create(data, actorId); },
  // These three are only ever reached behind requireAuth + cms.edit, so the caller is always
  // an admin — always look the block up including drafts.
  async update(key, data, actorId) { await this.get(key, true); return repo.update(key, data, actorId); },
  async togglePublish(key) { const b = await this.get(key, true); await repo.togglePublish(key, !b.is_published); return repo.findByKey(key); },

  async listMedia() { return repo.findAllMedia(); },
  async createMedia(file, actor) {
    return repo.createMedia({
      filename: file.originalname, url: file.url,
      mime_type: file.mimetype, size_bytes: file.size, uploaded_by: actor,
    });
  },
  async removeMedia(id) {
    const m = await repo.removeMedia(id);
    if (!m) throw new AppError('NOT_FOUND', 'Media file not found', 404);
    return m;
  },
};
module.exports = service;
