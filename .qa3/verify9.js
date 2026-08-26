const { call, login } = require('./probe');
(async () => {
  const out = {};
  const finance = await login('finance@example.invalid', 'Staff@1234');
  // statements buyer list should now work for finance
  out.financeBuyers = await call('GET', '/api/buyers?limit=5', null, finance);
  // pending buyer login message now accurate (verified + pending)
  const pendingLogin = await call('POST', '/api/auth/login', { email: 'qanewbuyer@example.invalid', password: 'Buyer@1234' });
  out.pendingMsg = pendingLogin;
  console.log(JSON.stringify(out, null, 1).slice(0, 800));
})().catch(e => { console.error(e.message); process.exit(1); });
