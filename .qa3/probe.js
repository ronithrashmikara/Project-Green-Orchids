const BASE = process.env.BASE || 'http://localhost:5000';
const fs = require('fs');
const path = require('path');
const jar = path.join(__dirname, 'ck.txt');

async function csrf() {
  const r = await fetch(`${BASE}/api/csrf-token`);
  const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
  const lines = sc.map(c => c.split(';')[0]);
  const xsrf = [...lines].reverse().find(l => l.startsWith('xsrf_token='))?.split('=').slice(1).join('=') || '';
  fs.writeFileSync(jar, [...lines.filter(l => !l.startsWith('xsrf_token=')), `xsrf_token=${xsrf}`].filter(Boolean).join('\n'));
  return xsrf;
}
function headers(token) {
  const cookie = fs.readFileSync(jar, 'utf8').split('\n').filter(Boolean).join('; ');
  const xsrf = cookie.match(/xsrf_token=([^;]+)/)?.[1] || '';
  const h = { 'Content-Type': 'application/json', 'Origin': 'http://localhost:3100', 'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-Token': xsrf, Cookie: cookie };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}
async function login(email, password) {
  const xsrf = await csrf();
  const r = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: headers(), body: JSON.stringify({ email, password }) });
  const j = await r.json();
  if (!j.data) throw new Error('login failed ' + r.status + ' ' + JSON.stringify(j).slice(0, 140));
  return j.data.accessToken || j.data.token;
}
async function call(method, p, body, token, raw = false) {
  const r = await fetch(BASE + p, { method, headers: headers(token), body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  return { status: r.status, ct: r.headers.get('content-type') || '', body: raw ? t.slice(0, 300) : t.slice(0, 220) };
}
module.exports = { csrf, call, login };
