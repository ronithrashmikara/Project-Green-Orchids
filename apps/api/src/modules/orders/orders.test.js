const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { Client } = require('pg');
const { startServer, req, login } = require('../../test/helpers');

let ctx;
let buyerToken;
let adminToken;
let product;
let order;

before(async () => {
  ctx = await startServer();
  buyerToken = await login(ctx.baseUrl, 'buyer1');
  adminToken = await login(ctx.baseUrl, 'admin');

  await req(ctx.baseUrl, 'DELETE', '/cart', { token: buyerToken });
  const { data } = await req(ctx.baseUrl, 'GET', '/products/buyer?limit=50', { token: buyerToken });
  product = data.products.find((p) => p.status === 'ACTIVE' && p.available >= p.moq * 3);
  assert.ok(product, 'seed data should include an ACTIVE product with enough available stock');
});

after(async () => { await ctx.close(); });

test('golden path: catalogue -> cart -> order -> admin approve -> stock reservation -> invoice', async () => {
  const add = await req(ctx.baseUrl, 'POST', '/cart/items', {
    token: buyerToken, body: { product_id: product.id, quantity: product.moq },
  });
  assert.equal(add.status, 201);

  const created = await req(ctx.baseUrl, 'POST', '/orders', { token: buyerToken, body: {} });
  assert.equal(created.status, 201);
  order = created.data.data;
  assert.equal(order.status, 'PENDING_APPROVAL');
  assert.equal(order.approved_by, null);

  const beforeReserve = await req(ctx.baseUrl, 'GET', `/products/${product.id}`, { token: buyerToken });
  const reservedBefore = beforeReserve.data.data.reserved;

  const approved = await req(ctx.baseUrl, 'PATCH', `/orders/${order.id}/approve`, { token: adminToken, body: {} });
  assert.equal(approved.status, 200);

  // Regression: approve() must persist who/when, not just flip the status.
  const orderAfter = await req(ctx.baseUrl, 'GET', `/orders/${order.id}`, { token: adminToken });
  assert.equal(orderAfter.data.data.status, 'APPROVED');
  assert.ok(orderAfter.data.data.approved_by, 'approved_by should be set after approval');
  assert.ok(orderAfter.data.data.approved_at, 'approved_at should be set after approval');

  const afterReserve = await req(ctx.baseUrl, 'GET', `/products/${product.id}`, { token: buyerToken });
  assert.equal(afterReserve.data.data.reserved, reservedBefore + product.moq, 'reserved should increase by the ordered quantity');

  const invoices = await req(ctx.baseUrl, 'GET', `/invoices?order_id=${order.id}`, { token: buyerToken });
  const invoice = (invoices.data.data || []).find((i) => i.order_id === order.id);
  assert.ok(invoice, 'approving an order should generate an invoice for it');
  assert.equal(invoice.status, 'PENDING');
  assert.equal(Number(invoice.balance_due), Number(invoice.total_amount));
});

test('a buyer cannot approve their own order, and cannot see another buyer\'s order', async () => {
  const buyer2Token = await login(ctx.baseUrl, 'buyer2');

  const selfApprove = await req(ctx.baseUrl, 'PATCH', `/orders/${order.id}/approve`, { token: buyerToken, body: {} });
  assert.equal(selfApprove.status, 403);

  const crossBuyer = await req(ctx.baseUrl, 'GET', `/orders/${order.id}`, { token: buyer2Token });
  assert.equal(crossBuyer.status, 403);
});

test('submitting an order with an empty cart is rejected', async () => {
  const buyer3Token = await login(ctx.baseUrl, 'buyer2');
  await req(ctx.baseUrl, 'DELETE', '/cart', { token: buyer3Token });
  const { status } = await req(ctx.baseUrl, 'POST', '/orders', { token: buyer3Token, body: {} });
  assert.ok(status >= 400, 'ordering with nothing in the cart should not succeed');
});

test('a bad/nonexistent order id returns a clean 404, not a crash', async () => {
  const { status, data } = await req(ctx.baseUrl, 'GET', '/orders/999999999', { token: adminToken });
  assert.equal(status, 404);
  assert.equal(data.error.code, 'NOT_FOUND');
});

test('regression (FINDING-S01): concurrent approve calls on the same order do not double-reserve stock or create duplicate invoices', async () => {
  const add = await req(ctx.baseUrl, 'POST', '/cart/items', {
    token: buyerToken, body: { product_id: product.id, quantity: product.moq },
  });
  assert.equal(add.status, 201);
  const created = await req(ctx.baseUrl, 'POST', '/orders', { token: buyerToken, body: {} });
  const raceOrder = created.data.data;
  assert.equal(raceOrder.status, 'PENDING_APPROVAL');

  const beforeReserve = await req(ctx.baseUrl, 'GET', `/products/${product.id}`, { token: buyerToken });
  const reservedBefore = beforeReserve.data.data.reserved;

  // Fire the same approve() twice concurrently. Before the row lock was added, the order
  // row's status was only read once before the transaction started, so both requests could
  // pass the PENDING_APPROVAL check, both reserve stock, and both create an invoice — only an
  // unrelated invoices.order_id UNIQUE constraint accidentally caught the second one with a
  // raw unhandled 500 instead of a clean conflict response.
  const [r1, r2] = await Promise.all([
    req(ctx.baseUrl, 'PATCH', `/orders/${raceOrder.id}/approve`, { token: adminToken, body: {} }),
    req(ctx.baseUrl, 'PATCH', `/orders/${raceOrder.id}/approve`, { token: adminToken, body: {} }),
  ]);
  const statuses = [r1.status, r2.status].sort();
  assert.deepEqual(statuses, [200, 409], 'exactly one approve should succeed, the other should get a clean 409');
  const loser = r1.status === 409 ? r1 : r2;
  assert.equal(loser.data.error.code, 'INVALID_TRANSITION');

  const afterReserve = await req(ctx.baseUrl, 'GET', `/products/${product.id}`, { token: buyerToken });
  assert.equal(afterReserve.data.data.reserved, reservedBefore + product.moq,
    'reserved should increase by exactly one order worth of stock, not double');

  const invoices = await req(ctx.baseUrl, 'GET', `/invoices?order_id=${raceOrder.id}`, { token: buyerToken });
  const matching = (invoices.data.data || []).filter((i) => i.order_id === raceOrder.id);
  assert.equal(matching.length, 1, 'exactly one invoice should be created, not two');
});

// --- Deterministic row-lock tests -------------------------------------------------
// The race test above fires two requests at once and relies on the scheduler to
// interleave them. These tests remove the luck: a second, independent Postgres
// connection takes the order row lock itself, the API request is fired, and the
// test waits until Postgres reports that request's backend as blocked on that
// exact lock (pg_blocking_pids) before deciding what the blocker does next.

async function submitFreshOrder() {
  const add = await req(ctx.baseUrl, 'POST', '/cart/items', {
    token: buyerToken, body: { product_id: product.id, quantity: product.moq },
  });
  assert.equal(add.status, 201);
  const created = await req(ctx.baseUrl, 'POST', '/orders', { token: buyerToken, body: {} });
  assert.equal(created.status, 201);
  assert.equal(created.data.data.status, 'PENDING_APPROVAL');
  return created.data.data;
}

async function openBlockerHoldingOrderLock(orderId) {
  const blocker = new Client({ connectionString: process.env.DATABASE_URL });
  await blocker.connect();
  await blocker.query('BEGIN');
  const { rows } = await blocker.query('SELECT id FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
  assert.equal(rows.length, 1);
  const { rows: [{ pid }] } = await blocker.query('SELECT pg_backend_pid() AS pid');
  return { blocker, pid };
}

// Resolves with the SQL text the blocked backend is waiting on, so tests can assert
// *where* the request queued, not just that it did.
async function waitUntilSomeoneIsBlockedBy(blocker, blockerPid, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    // The blocker is inside a transaction, and Postgres caches pg_stat_activity per
    // transaction; drop that snapshot so each poll sees the backends' current queries.
    await blocker.query('SELECT pg_stat_clear_snapshot()');
    const { rows } = await blocker.query(
      'SELECT query FROM pg_stat_activity WHERE $1::int = ANY(pg_blocking_pids(pid))',
      [blockerPid],
    );
    if (rows.length > 0) return rows[0].query;
    await new Promise((r) => setTimeout(r, 25));
  }
  assert.fail('the API request never queued behind the held order row lock');
}

// The first statement in approve()/reject() that touches the order row inside the
// transaction is the explicit row lock (orders.repository.js lockForUpdate). If that
// lock were removed, the request would instead queue later (at the invoice FK check
// or the conditional UPDATE), after it had already done work on a stale read.
const ORDER_ROW_LOCK_SQL = /FROM orders WHERE id = \$1 FOR UPDATE/;

function track(promise) {
  const state = { settled: false };
  state.promise = promise.finally(() => { state.settled = true; });
  return state;
}

test('deterministic lock: reject waits on a held order row lock and completes once it is released', async () => {
  const lockedOrder = await submitFreshOrder();
  const { blocker, pid } = await openBlockerHoldingOrderLock(lockedOrder.id);
  try {
    const pending = track(req(ctx.baseUrl, 'PATCH', `/orders/${lockedOrder.id}/reject`, {
      token: adminToken, body: { reason: 'Deterministic lock test rejection' },
    }));

    const blockedOn = await waitUntilSomeoneIsBlockedBy(blocker, pid);
    assert.match(blockedOn, ORDER_ROW_LOCK_SQL, 'reject should queue on the explicit order row lock');
    // Give the request a generous window to (wrongly) finish while the lock is still held.
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(pending.settled, false, 'reject must not complete while another transaction holds the order row lock');

    await blocker.query('ROLLBACK');
    const res = await pending.promise;
    assert.equal(res.status, 200, 'once the lock is released the queued reject should go through');

    const afterReject = await req(ctx.baseUrl, 'GET', `/orders/${lockedOrder.id}`, { token: adminToken });
    assert.equal(afterReject.data.data.status, 'REJECTED');
  } finally {
    await blocker.query('ROLLBACK').catch(() => {});
    await blocker.end();
  }
});

test('deterministic lock (FINDING-S01): approve re-reads status under the lock and returns 409 if the holder changed it', async () => {
  const lockedOrder = await submitFreshOrder();
  const beforeReserve = await req(ctx.baseUrl, 'GET', `/products/${product.id}`, { token: buyerToken });
  const reservedBefore = beforeReserve.data.data.reserved;

  const { blocker, pid } = await openBlockerHoldingOrderLock(lockedOrder.id);
  try {
    // The holder moves the order out of PENDING_APPROVAL but has not committed yet, so
    // approve()'s pre-transaction read still sees PENDING_APPROVAL and passes the state
    // check. Only the re-read under the row lock can catch the change.
    await blocker.query(
      `UPDATE orders SET status = 'REJECTED', rejection_reason = 'Rejected by the lock holder', updated_at = NOW()
       WHERE id = $1`,
      [lockedOrder.id],
    );

    const pending = track(req(ctx.baseUrl, 'PATCH', `/orders/${lockedOrder.id}/approve`, { token: adminToken, body: {} }));

    const blockedOn = await waitUntilSomeoneIsBlockedBy(blocker, pid);
    assert.match(blockedOn, ORDER_ROW_LOCK_SQL, 'approve should queue on the explicit order row lock, before any other work');
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(pending.settled, false, 'approve must not complete while another transaction holds the order row lock');

    await blocker.query('COMMIT');
    const res = await pending.promise;
    assert.equal(res.status, 409, 'approve must see the committed REJECTED status, not its stale pre-lock read');
    assert.equal(res.data.error.code, 'INVALID_TRANSITION');

    const afterReserve = await req(ctx.baseUrl, 'GET', `/products/${product.id}`, { token: buyerToken });
    assert.equal(afterReserve.data.data.reserved, reservedBefore, 'no stock may be reserved for an order that was not approved');

    const invoices = await req(ctx.baseUrl, 'GET', `/invoices?order_id=${lockedOrder.id}`, { token: buyerToken });
    const matching = (invoices.data.data || []).filter((i) => i.order_id === lockedOrder.id);
    assert.equal(matching.length, 0, 'no invoice may be created for an order that was not approved');
  } finally {
    await blocker.query('ROLLBACK').catch(() => {});
    await blocker.end();
  }
});
