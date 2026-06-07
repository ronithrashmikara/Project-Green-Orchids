const s = require('./products.service');
module.exports = {
  list: async (r, res, n) => { try { const d = await s.list(r.query); res.json({ success: true, ...d }); } catch (e) { n(e); } },
  get: async (r, res, n) => { try { const d = await s.get(r.params.id); res.json({ success: true, data: d }); } catch (e) { n(e); } },
  create: async (r, res, n) => { try { const d = await s.create(r.body, r.user.id); res.status(201).json({ success: true, data: d }); } catch (e) { n(e); } },
  update: async (r, res, n) => { try { const d = await s.update(r.params.id, r.body, r.user.id); res.json({ success: true, data: d }); } catch (e) { n(e); } },
  uploadImage: async (r, res, n) => { try { const d = await s.uploadImage(r.params.id, r.file, r.user.id); res.status(201).json({ success: true, data: d }); } catch (e) { n(e); } },
  updateImage: async (r, res, n) => { try { const d = await s.updateImage(r.params.id, r.params.imageId, r.body); res.json({ success: true, data: d }); } catch (e) { n(e); } },
  removeImage: async (r, res, n) => { try { await s.removeImage(r.params.id, r.params.imageId); res.json({ success: true, data: { message: 'Image removed' } }); } catch (e) { n(e); } },
  adjustStock: async (r, res, n) => { try { await s.adjustStock(r.params.id, r.body, r.user.id); res.json({ success: true, data: { message: 'Stock adjusted' } }); } catch (e) { n(e); } },
  priceHistory: async (r, res, n) => { try { const d = await s.getPriceHistory(r.params.id, r.query); res.json({ success: true, ...d }); } catch (e) { n(e); } },
  changePrice: async (r, res, n) => { try { const d = await s.changePrice(r.params.id, r.body, r.user.id); res.json({ success: true, data: d }); } catch (e) { n(e); } },
};
