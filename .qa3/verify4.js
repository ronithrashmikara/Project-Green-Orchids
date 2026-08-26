const { call, login } = require('./probe');
(async () => {
  const admin = await login('admin@example.invalid', 'Staff@1234');
  const out = {};
  // CMS PATCH with schema-valid payload
  out.cmsPatch = await call('PATCH', '/api/cms/blocks/home_hero', {
    type: 'HERO', content: JSON.stringify({ heading: 'Welcome to Orchids', subheading: 'Premium Wholesale Orchids from Sri Lanka', cta_text: 'Browse Catalogue', cta_url: '/products', background_image: '/assets/hero-orchids.jpg' }),
  }, admin);
  // security endpoints used by the page tabs
  out.audit = await call('GET', '/api/admin/security/audit-logs?page=1&limit=5', null, admin);
  out.sessions = await call('GET', '/api/auth/sessions', null, admin);
  // settings access windows shape
  out.settings = await call('GET', '/api/admin/settings', null, admin);
  // deliveries list for admin
  out.deliveries = await call('GET', '/api/deliveries?limit=3', null, admin);
  console.log(JSON.stringify(out, null, 1).slice(0, 1800));
})().catch(e => { console.error(e.message); process.exit(1); });
