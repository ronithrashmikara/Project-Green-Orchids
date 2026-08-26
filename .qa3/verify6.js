const { call, login } = require('./probe');
(async () => {
  const sales = await login('sales1@example.invalid', 'Staff@1234');
  const out = {};
  out.getAvail = await call('GET', '/api/sales/availability', null, sales);
  out.setAway = await call('PATCH', '/api/sales/availability', { status: 'AWAY' }, sales);
  out.queue = await call('GET', '/api/sales/queue', null, sales);
  // complaints list + reply
  out.complaints = await call('GET', '/api/complaints?status=OPEN', null, sales);
  console.log(JSON.stringify(out, null, 1).slice(0, 1200));
})().catch(e => { console.error(e.message); process.exit(1); });
