const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, req, login } = require('../../test/helpers');

let ctx;
let adminToken;
const blockKey = `automated_test_block_${Date.now()}`;

before(async () => {
  ctx = await startServer();
  adminToken = await login(ctx.baseUrl, 'admin');
});

after(async () => {
  // Best-effort cleanup so re-running this suite doesn't accumulate blocks.
  await req(ctx.baseUrl, 'PATCH', `/cms/blocks/${blockKey}`, { token: adminToken, body: { is_published: false } }).catch(() => {});
  await ctx.close();
});

test('golden path: create a content block -> publish it -> it appears in the public list -> edit -> unpublish removes it from the public list', async () => {
  const created = await req(ctx.baseUrl, 'POST', '/cms/blocks', {
    token: adminToken,
    body: { key: blockKey, title: 'Automated test banner', content: 'hello', block_type: 'BANNER', is_published: false },
  });
  assert.equal(created.status, 201);

  const beforePublish = await req(ctx.baseUrl, 'GET', '/cms/blocks');
  assert.ok(!beforePublish.data.data.some((b) => b.key === blockKey), 'an unpublished block should not appear in the public list');

  const published = await req(ctx.baseUrl, 'PATCH', `/cms/blocks/${blockKey}/publish`, { token: adminToken, body: {} });
  assert.equal(published.status, 200);

  const afterPublish = await req(ctx.baseUrl, 'GET', '/cms/blocks');
  assert.ok(afterPublish.data.data.some((b) => b.key === blockKey), 'a published block should appear in the public list');

  const updated = await req(ctx.baseUrl, 'PATCH', `/cms/blocks/${blockKey}`, { token: adminToken, body: { title: 'Updated title' } });
  assert.equal(updated.status, 200);

  const single = await req(ctx.baseUrl, 'GET', `/cms/blocks/${blockKey}`);
  assert.equal(single.data.data.content.title, 'Updated title');
});

test('media upload rejects a bad file type cleanly and accepts a real image', async () => {
  const badForm = new FormData();
  badForm.append('file', new Blob([Buffer.from('not an image')], { type: 'text/plain' }), 'bad.txt');
  const bad = await req(ctx.baseUrl, 'POST', '/cms/media', { token: adminToken, form: badForm });
  assert.equal(bad.status, 400);
  assert.equal(bad.data.error.code, 'INVALID_FILE_TYPE');

  const goodForm = new FormData();
  goodForm.append('file', new Blob([Buffer.from('\x89PNG\r\n\x1a\n')], { type: 'image/png' }), 'good.png');
  const good = await req(ctx.baseUrl, 'POST', '/cms/media', { token: adminToken, form: goodForm });
  assert.equal(good.status, 201);
  assert.ok(good.data.url);

  const list = await req(ctx.baseUrl, 'GET', '/cms/media', { token: adminToken });
  assert.equal(list.status, 200);
  assert.ok(list.data.files.some((f) => f.filename === 'good.png'));
});

test('a non-admin cannot create or edit CMS content blocks', async () => {
  const buyerToken = await login(ctx.baseUrl, 'buyer1');
  const { status } = await req(ctx.baseUrl, 'POST', '/cms/blocks', {
    token: buyerToken, body: { key: 'buyer_should_not_create', title: 'nope' },
  });
  assert.equal(status, 403);
});
