#!/usr/bin/env node
// Prepares an isolated `..._test` database (migrate + seed, both idempotent)
// and runs the API's node:test integration suite against it. Never touches
// the real dev database — the child processes below get DATABASE_URL
// rewritten to a `_test` suffix regardless of what's in apps/api/.env.
const path = require('path');
const { spawnSync } = require('child_process');

require('dotenv').config({ path: path.resolve(__dirname, '..', 'apps', 'api', '.env') });

const baseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/project_green';
const testUrl = baseUrl.replace(/\/[^/?]+(\?.*)?$/, '/project_green_test$1');

const env = { ...process.env, DATABASE_URL: testUrl, NODE_ENV: 'test' };

function run(args, opts = {}) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', env, ...opts });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`\n🧪 Test database: ${testUrl}`);

console.log('\n📦 Applying migrations (no-op if already applied)...');
run([path.resolve(__dirname, 'migrate.js')]);

console.log('\n🌱 Seeding known fixture data...');
run([path.resolve(__dirname, 'seed.js')]);

console.log('\n🧪 Running API integration tests...\n');
// Concurrency 1: test files share seeded fixtures (buyer1's cart, specific product stock
// levels, etc.) rather than each spinning up fully isolated data, so two files mutating the
// same rows at once would be flaky. Sequential is slower but deterministic.
run(['--test', '--test-concurrency=1', 'src/modules/**/*.test.js'], { cwd: path.resolve(__dirname, '..', 'apps', 'api') });

console.log('\n✅ All test suites passed.');
