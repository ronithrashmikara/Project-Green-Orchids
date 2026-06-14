const s = require('./payments.service');
module.exports = {
  create: async (r, res, n) => { try { const d = await s.create(r.body, r.user.id); res.status(201).json({ success: true, data: d }); } catch (e) { n(e); } },
  // confirmed_by comes from the request body (a DIFFERENT officer), not the actor (Finding 11)
  reverse: async (r, res, n) => { try { await s.reverse(r.params.id, r.body, r.user.id); res.json({ success: true, data: { message: 'Payment reversed' } }); } catch (e) { n(e); } },
  payhereNotify: async (r, res, n) => { try { const d = await s.payhereNotify(r.body); res.json({ success: true, data: d }); } catch (e) { n(e); } },
};
