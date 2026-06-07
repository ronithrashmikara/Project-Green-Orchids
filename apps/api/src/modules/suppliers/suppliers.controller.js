const s = require('./suppliers.service');
module.exports = {
  list: async (r, res, n) => { try { const d = await s.list(r.query); res.json({ success: true, ...d }); } catch (e) { n(e); } },
  get: async (r, res, n) => { try { const d = await s.get(r.params.id); res.json({ success: true, data: d }); } catch (e) { n(e); } },
  create: async (r, res, n) => { try { const d = await s.create(r.body); res.status(201).json({ success: true, data: d }); } catch (e) { n(e); } },
  update: async (r, res, n) => { try { const d = await s.update(r.params.id, r.body); res.json({ success: true, data: d }); } catch (e) { n(e); } },
  remove: async (r, res, n) => { try { await s.remove(r.params.id); res.json({ success: true, data: { message: 'Supplier removed' } }); } catch (e) { n(e); } },
  products: async (r, res, n) => { try { const d = await s.getProducts(r.params.id, r.query); res.json({ success: true, ...d }); } catch (e) { n(e); } },
};
