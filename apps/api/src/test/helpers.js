// Shared test harness for the API's node:test integration suite.
//
// Every test file requires this module first. It points the whole app at an
// isolated `..._test` database (never the real dev DB) before anything else
// gets a chance to require config/env.js or config/db.js, both of which read
// process.env once at module-load time and are require-cached — so this
// reassignment MUST happen before the first `require('../index')` anywhere
// in the process.
const path = require('path');

if (!process.env.__PG_TEST_ENV_SET__) {
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
  const base = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/project_green';
  process.env.DATABASE_URL = base.replace(/\/[^/?]+(\?.*)?$/, '/project_green_test$1');
  process.env.NODE_ENV = 'test';
  process.env.__PG_TEST_ENV_SET__ = '1';
}

function getApp() {
  return require('../index');
}

function getPool() {
  return require('../config/db').pool;
}

async function startServer() {
  const app = getApp();
  const server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}/api`,
    pool: getPool(),
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function req(baseUrl, method, urlPath, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let fetchBody;
  if (form) {
    fetchBody = form;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    fetchBody = JSON.stringify(body);
  }
  const res = await fetch(`${baseUrl}${urlPath}`, { method, headers, body: fetchBody });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
  return { status: res.status, data };
}

const CREDS = {
  admin: { email: 'admin@example.invalid', password: 'Staff@1234' },
  finance: { email: 'finance@example.invalid', password: 'Staff@1234' },
  inventory: { email: 'inventory@example.invalid', password: 'Staff@1234' },
  delivery: { email: 'delivery@example.invalid', password: 'Staff@1234' },
  buyer1: { email: 'buyer1@example.invalid', password: 'Buyer@1234' },
  buyer2: { email: 'buyer2@example.invalid', password: 'Buyer@1234' },
};

async function login(baseUrl, roleKey) {
  const creds = CREDS[roleKey];
  const { status, data } = await req(baseUrl, 'POST', '/auth/login', { body: creds });
  if (status !== 200 || !data?.accessToken) {
    throw new Error(`login failed for ${roleKey}: ${status} ${JSON.stringify(data)}`);
  }
  return data.accessToken;
}

module.exports = { startServer, req, login, CREDS };
