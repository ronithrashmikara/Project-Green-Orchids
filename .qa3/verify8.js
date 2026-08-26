const { call, login } = require('./probe');
(async () => {
  const buyer = await login('buyer2@example.invalid', 'Buyer@1234');
  const out = {};
  // find an unpaid invoice
  const invs = await call('GET', '/api/invoices?status=PENDING&limit=3', null, buyer);
  const rows = (() => { try { return JSON.parse(invs.body).data.data || JSON.parse(invs.body).data || []; } catch(e){ return []; } })();
  if (rows.length) {
    out.payAttempt = await call('POST', `/api/invoices/${rows[0].id}/pay`, {}, buyer);
  } else out.noUnpaid = invs.body.slice(0,120);
  console.log(JSON.stringify(out, null, 1));
})().catch(e => { console.error(e.message); process.exit(1); });
