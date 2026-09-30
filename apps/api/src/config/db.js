const { Pool } = require('pg');
const env = require('./env');

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 8,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ...(env.isProd ? { ssl: { rejectUnauthorized: false } } : {}),
});

pool.on('error', (err) => {
  console.error('Unexpected pool error:', err.message);
  if (err.code === '57P01') {
    console.error('Database connection terminated by admin. Attempting reconnect...');
  }
});

/**
 * Single query helper
 */
async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  if (env.isDev && duration > 100) {
    console.log(`🐢 Slow query (${duration}ms):`, text.substring(0, 100));
  }
  return result;
}

// SQLSTATEs where Postgres has already rolled the whole transaction back and
// the documented remedy is simply to run it again:
//   40P01 deadlock_detected      (this backend was picked as the deadlock victim)
//   40001 serialization_failure  (only reachable under REPEATABLE READ/SERIALIZABLE)
const RETRYABLE_TX_CODES = new Set(['40P01', '40001']);
const TX_MAX_ATTEMPTS = 3;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runTxOnce(callback) {
  const client = await pool.connect();
  let releaseErr;
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      // The connection itself is unusable; destroy it instead of returning it
      // to the pool, and surface the original error rather than the rollback's.
      releaseErr = rollbackErr;
    }
    throw err;
  } finally {
    client.release(releaseErr);
  }
}

/**
 * Transaction helper: acquires a client, runs callback with client as arg,
 * calls BEGIN/COMMIT/ROLLBACK automatically.
 *
 * If Postgres aborts the transaction with a retryable SQLSTATE (deadlock victim
 * or serialization failure), the whole callback is re-run on a fresh
 * transaction, up to `maxAttempts` times in total, with a short jittered
 * backoff. Every other error is rethrown immediately. Because the callback can
 * run more than once, it must only have side effects through `client` (which
 * are rolled back) — external calls such as email or payment-provider requests
 * belong outside the callback (the outbox pattern already used here).
 */
async function tx(callback, { maxAttempts = TX_MAX_ATTEMPTS } = {}) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await runTxOnce(callback);
    } catch (err) {
      if (!RETRYABLE_TX_CODES.has(err && err.code) || attempt >= maxAttempts) throw err;
      if (!env.isTest) {
        console.warn(`Transaction aborted with ${err.code}; retrying (attempt ${attempt + 1}/${maxAttempts})`);
      }
      await sleep(10 * 2 ** attempt + Math.floor(Math.random() * 25));
    }
  }
}

module.exports = { pool, query, tx, RETRYABLE_TX_CODES, TX_MAX_ATTEMPTS };
