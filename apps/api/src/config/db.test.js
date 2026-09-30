const { test, after } = require('node:test');
const assert = require('node:assert/strict');
// helpers must load first: it points DATABASE_URL at the isolated _test database
// before config/db.js reads it.
require('../test/helpers');
const { tx, pool, TX_MAX_ATTEMPTS } = require('./db');

after(async () => { await pool.end(); });

function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

test('tx() re-runs a transaction that Postgres aborts as a deadlock victim (40P01)', async () => {
  // Two transactions take the same two advisory locks in opposite order, and a
  // barrier makes sure each holds its first lock before asking for the second —
  // a guaranteed deadlock. Postgres aborts exactly one of them with 40P01; tx()
  // must retry that one so both calls still succeed. Advisory locks keep this
  // off every real table.
  const base = 900000000 + Math.floor(Math.random() * 1000000);
  const [k1, k2] = [base, base + 1];
  const aHolds = deferred();
  const bHolds = deferred();
  const attempts = { a: 0, b: 0 };

  const run = (name, first, second, iHold, otherHolds) => tx(async (client) => {
    attempts[name] += 1;
    await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [first]);
    if (attempts[name] === 1) {
      iHold.resolve();
      await otherHolds.promise;
    }
    await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [second]);
    return name;
  });

  const results = await Promise.all([
    run('a', k1, k2, aHolds, bHolds),
    run('b', k2, k1, bHolds, aHolds),
  ]);

  assert.deepEqual(results, ['a', 'b'], 'both transactions should eventually commit');
  assert.equal(attempts.a + attempts.b, 3, 'exactly one transaction should be the deadlock victim and be retried once');
});

test('tx() gives up after the bounded number of attempts and rethrows the last error', async () => {
  let calls = 0;
  await assert.rejects(
    tx(async () => {
      calls += 1;
      throw Object.assign(new Error('simulated serialization failure'), { code: '40001' });
    }),
    (err) => err.code === '40001',
  );
  assert.equal(calls, TX_MAX_ATTEMPTS);
});

test('tx() does not retry non-retryable errors', async () => {
  let calls = 0;
  await assert.rejects(
    tx(async (client) => {
      calls += 1;
      await client.query('SELECT 1');
      throw Object.assign(new Error('business rule violated'), { code: 'INVALID_TRANSITION' });
    }),
    /business rule violated/,
  );
  assert.equal(calls, 1, 'application errors must surface immediately, not be retried');
});
