const s = require('./payments.service');
module.exports = {
  list: async (r, res, n) => { try { const d = await s.list(r.query); res.json({ success: true, ...d }); } catch (e) { n(e); } },
  create: async (r, res, n) => { try { const d = await s.create(r.body, r.user.id); res.status(201).json({ success: true, data: d }); } catch (e) { n(e); } },
  reverse: async (r, res, n) => { try { await s.reverse(r.params.id, r.body, r.user.id); res.json({ success: true, data: { message: 'Payment reversed' } }); } catch (e) { n(e); } },
  stripeWebhook: async (r, res, n) => {
    try {
      const d = await s.stripeWebhook(r.rawBody || Buffer.from(JSON.stringify(r.body || {})), r.get('stripe-signature'));
      res.json({ received: true, data: d });
    } catch (e) { n(e); }
  },
};
