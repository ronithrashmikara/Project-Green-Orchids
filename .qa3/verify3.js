const { call, login } = require('./probe');
(async () => {
  const admin = await login('admin@example.invalid', 'Staff@1234');
  const roles = await call('GET', '/api/users/roles', null, admin);
  const rolesArr = JSON.parse(roles.body).data;
  const sales = rolesArr.find(r => r.name === 'SALES_MANAGER');
  const out = {};
  out.createStaff = await call('POST', '/api/users', {
    name: 'QA Sales Staff', email: 'qasales@example.invalid',
    role_id: sales.id, password: 'Staff@1234', send_setup_email: false,
  }, admin);
  // cleanup: created user stays for role testing? keep — will test sales login count
  console.log(JSON.stringify(out, null, 1));
})().catch(e => { console.error(e.message); process.exit(1); });
