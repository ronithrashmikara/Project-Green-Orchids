const { call, login } = require('./probe');
(async () => {
  const admin = await login('admin@example.invalid', 'Staff@1234');
  const out = {};
  out.logins = await call('GET', '/api/admin/security/logins?page=1&limit=5', null, admin);
  out.sessions = await call('GET', '/api/admin/security/sessions', null, admin);
  out.locked = await call('GET', '/api/admin/security/locked-accounts', null, admin);
  out.windows = await call('GET', '/api/admin/security/access-windows', null, admin);
  console.log(JSON.stringify(out, null, 1).slice(0, 1200));
})().catch(e => { console.error(e.message); process.exit(1); });
