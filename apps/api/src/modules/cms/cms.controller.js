const s = require('./cms.service');
const { publicUrl } = require('../../middleware/upload');
const { AppError } = require('../../middleware/errors');
module.exports = {
  list: async (r, res, n) => { try { const d = await s.list(!!r.user); res.json({ success: true, data: d }); } catch (e) { n(e); } },
  get: async (r, res, n) => { try { const d = await s.get(r.params.key, !!r.user); res.json({ success: true, data: d }); } catch (e) { n(e); } },
  create: async (r, res, n) => { try { const d = await s.create(r.body, r.user.id); res.status(201).json({ success: true, data: d }); } catch (e) { n(e); } },
  update: async (r, res, n) => { try { const d = await s.update(r.params.key, r.body, r.user.id); res.json({ success: true, data: d }); } catch (e) { n(e); } },
  togglePublish: async (r, res, n) => { try { const d = await s.togglePublish(r.params.key); res.json({ success: true, data: d }); } catch (e) { n(e); } },

  // Media endpoints intentionally return bare bodies (list: {files}, create: the
  // item itself) to match the admin CMS media-library UI's existing contract.
  listMedia: async (r, res, n) => { try { const files = await s.listMedia(); res.json({ files }); } catch (e) { n(e); } },
  createMedia: async (r, res, n) => {
    try {
      if (!r.file) throw new AppError('FILE_REQUIRED', 'An image file is required', 400);
      const url = publicUrl('cms', r.file.filename);
      const media = await s.createMedia({ originalname: r.file.originalname, url, mimetype: r.file.mimetype, size: r.file.size }, r.user.id);
      res.status(201).json({ id: media.id, filename: media.filename, url: media.url });
    } catch (e) { n(e); }
  },
  removeMedia: async (r, res, n) => { try { await s.removeMedia(r.params.id); res.json({ success: true }); } catch (e) { n(e); } },
};
