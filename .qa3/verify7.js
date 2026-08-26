const { call, login } = require('./probe');
(async () => {
  const sales = await login('sales1@example.invalid', 'Staff@1234');
  const out = {};
  out.complaints = await call('GET', '/api/complaints?status=OPEN', null, sales);
  // reply to complaint 1
  out.reply = await call('POST', '/api/complaints/1/messages', { body: 'Thanks - our team is looking into this (QA reply).' }, sales);
  // buyer sees the reply?
  const buyer = await login('buyer2@example.invalid', 'Buyer@1234');
  out.buyerView = await call('GET', '/api/complaints/1', null, buyer);
  console.log(JSON.stringify(out, null, 1).slice(0, 900));
})().catch(e => { console.error(e.message); process.exit(1); });
