#!/usr/bin/env node
/**
 * migrate.js – Run all SQL migration files in lexicographic order.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... node scripts/migrate.js
 *
 * Default URL: postgresql://postgres:postgres@localhost:5432/project_green
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL
  || 'postgresql://postgres:postgres@localhost:5432/project_green';

const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'apps', 'api', 'migrations');

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  // Ensure the target database exists
  const dbName = new URL(DATABASE_URL).pathname.replace(/^\//, '') || 'project_green';
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(dbName)) {
    throw new Error('Invalid PostgreSQL database name');
  }
  const adminPool = new Pool({
    connectionString: DATABASE_URL.replace(/\/[^/]+$/, '/postgres'),
  });
  try {
    const { rows } = await adminPool.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]
    );
    if (rows.length === 0) {
      // PostgreSQL does not parameterize identifiers. dbName is constrained above to
      // a strict identifier grammar before it is quoted here.
      await adminPool.query(`CREATE DATABASE "${dbName}"`);
      console.log(`✅ Created database "${dbName}"`);
    }
  } finally {
    await adminPool.end();
  }

  // Track applied migrations so re-running this script against an existing DB is a no-op for
  // files already applied, instead of re-executing non-idempotent DDL (e.g. CREATE TRIGGER)
  // and failing halfway through.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  const { rows: appliedRows } = await pool.query('SELECT filename FROM schema_migrations');
  const applied = new Set(appliedRows.map(r => r.filename));

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => /^\d{4}_[A-Za-z0-9_-]+\.sql$/.test(f))
    .sort();

  if (files.length === 0) {
    console.log('⚠️  No migration files found in', MIGRATIONS_DIR);
    await pool.end();
    return;
  }

  const pending = files.filter(f => !applied.has(f));
  if (pending.length === 0) {
    console.log(`✅ Nothing to do — all ${files.length} migration(s) already applied to ${dbName}.`);
    await pool.end();
    return;
  }

  console.log(`📦 Running ${pending.length} pending migration(s) of ${files.length} total against ${dbName}...\n`);

  for (const file of pending) {
    const filePath = path.resolve(MIGRATIONS_DIR, file);
    if (!filePath.startsWith(`${MIGRATIONS_DIR}${path.sep}`)) {
      throw new Error('Migration path escapes the configured directory');
    }
    const sql = fs.readFileSync(filePath, 'utf8');
    console.log(`▶  ${file}`);
    try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock($1)', [742901]);
        const alreadyApplied = await client.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [file]);
        if (alreadyApplied.rows.length) {
          await client.query('COMMIT');
          console.log('   ↪ already applied by another migration runner');
          continue;
        }
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING', [file]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      console.log(`   ✅ OK`);
    } catch (err) {
      console.error(`   ❌ FAILED: ${err.message}`);
      await pool.end();
      process.exit(1);
    }
  }

  console.log('\n🎉 All migrations complete.');
  await pool.end();
}

main().catch((err) => {
  console.error('❌ Migration runner failed:', err.message);
  process.exit(1);
});
