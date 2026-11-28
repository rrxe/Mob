import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as world from './world.js';
import * as db from './db.js';
import * as tg from './telegram.js';
import { DEFAULTS } from './game.js';

const { W, Err } = world;
const PORT = Number(process.env.PORT || 3000);
const PUBLIC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
const DEV = process.env.DEV_AUTH === '1';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_SECRET = process.env.ADMIN_SESSION_SECRET || process.env.BOT_TOKEN || 'dev-secret';
const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map(s => s.trim()).filter(Boolean);

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon' };
const SEC = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'cache-control': 'no-store',
  'content-security-policy': "default-src 'self'; script-src 'self' https://telegram.org https://sad.adsgram.ai; style-src 'self' 'unsafe-inline' https://sad.adsgram.ai; img-src 'self' data: https:; media-src 'self' blob: https:; frame-src https://*.adsgram.ai; connect-src 'self' https://*.adsgram.ai" };
function send(res, status, body, headers = {}) {
  const isObj = typeof body === 'object' && !Buffer.isBuffer(body);
  res.writeHead(status, { ...SEC, ...(isObj ? { 'content-type': 'application/json' } : {}), ...headers });
  res.end(isObj ? JSON.stringify(body) : body);
}
async function readJson(req, max = 8192) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > max) throw new Err('too_big', 413); chunks.push(c); }
  if (!size) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new Err('bad_json'); }
}
const clientIp = req => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'x';
const buckets = new Map();
function limited(id) {
  const t = Date.now(), b = buckets.get(id) || { n: 12, t };
  b.n = Math.min(12, b.n + (t - b.t) / 1000 * 6); b.t = t;
  if (b.n < 1) { buckets.set(id, b); return true; }
  b.n -= 1; buckets.set(id, b); return false;
}
setInterval(() => { const t = Date.now(); for (const [k, b] of buckets) if (t - b.t > 60000) buckets.delete(k); }, 60000).unref();

function authUser(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('tga ')) { const u = tg.verifyInitData(h.slice(4).trim()); if (u) return u; }
  if (DEV && req.headers['x-dev-user']) {
    const id = String(req.headers['x-dev-user']).replace(/\D/g, '').slice(0, 15);
    if (id) return { id, username: 'dev' + id, firstName: 'Dev' + id, lang: 'en', startParam: String(req.headers['x-dev-start'] || '') };
  }
  return null;
}

// ---------- game API ----------
const P = {};
P['GET /api/me'] = c => c.p ? world.view(c.p) : { needsName: true, maintenance: W.S.maintenance };
P['POST /api/create'] = async c => {
  const ref = (/^ref_(\d{1,20})$/.exec(c.u.startParam || '')?.[1]) || String(c.body.ref || '').replace(/\D/g, '');
  await world.createFarm(c.u.id, c.u, { name: c.body.name, ref });
  return world.view(W.players.get(c.u.id));
};
P['POST /api/plant'] = c => world.plant(c.p, c.body);
P['POST /api/water'] = c => world.water(c.p, c.body);
P['POST /api/fertilize'] = c => world.fertilize(c.p, c.body);
P['POST /api/fertilizer/buy'] = c => world.buyFertilizer(c.p, c.body);
P['POST /api/harvest'] = c => world.harvest(c.p, c.body);
P['POST /api/sell'] = c => world.sell(c.p, c.body);
P['POST /api/upgrade'] = c => world.upgrade(c.p, c.body);
P['POST /api/daily'] = c => world.daily(c.p);
P['POST /api/mission/claim'] = c => world.claimMission(c.p, c.body);
P['POST /api/order/fulfill'] = c => world.fulfillOrder(c.p, c.body);
P['POST /api/exchange'] = c => world.exchange(c.p, c.body.gems);
P['POST /api/withdraw'] = async c => {
  const w = await world.withdraw(c.p, c.body);
  for (const id of ADMIN_IDS) tg.notify(id, `💸 New withdrawal: ${w.gram} GRAM from ${c.p.kname} (${c.p.tid})`);
  return { ok: true };
};
P['GET /api/withdrawals'] = async c => ({ list: (await db.listWithdrawals({ tid: c.p.tid, limit: 20 })).map(w => ({ id: w.id, gram: w.gram, address: w.address, status: w.status, tx: w.tx_hash, note: w.note, t: w.created_at })) });
P['POST /api/lumber/start'] = c => world.lumberStart(c.p);
P['POST /api/lumber/claim'] = c => world.lumberClaim(c.p, c.body);
P['POST /api/lumber/upgrade'] = c => world.lumberUpgrade(c.p);
P['POST /api/lumber/sell'] = c => world.lumberSell(c.p, c.body);
P['POST /api/ad/prepare'] = c => world.adPrepare(c.p, c.body);
P['POST /api/ad/confirm'] = c => world.adConfirm(c.p, c.body);
P['POST /api/adsgram/claim'] = c => world.adsgramClaim(c.p);
P['POST /api/task/start'] = c => world.taskStart(c.p, c.body);
P['POST /api/task/claim'] = c => world.taskClaim(c.p, c.body);
P['GET /api/leaderboard'] = () => world.leaderboard();
P['POST /api/lang'] = () => ({ ok: true });

// ---------- admin API ----------
const sign = exp => crypto.createHmac('sha256', ADMIN_SECRET).update(String(exp)).digest('hex');
const tEq = (a, b) => { const x = crypto.createHash('sha256').update(String(a)).digest(), y = crypto.createHash('sha256').update(String(b)).digest(); return crypto.timingSafeEqual(x, y); };
function cookie(req, name) { for (const part of (req.headers.cookie || '').split(';')) { const i = part.indexOf('='); if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim(); } return ''; }
function isAdmin(req) { const [exp, sig] = cookie(req, 'rl_admin').split('.'); return Boolean(exp && sig && Number(exp) > Date.now() && tEq(sig, sign(exp))); }
const attempts = new Map(), A = {};
A['POST /api/admin/login'] = (c, req, res) => {
  if (!ADMIN_PASSWORD) throw new Err('admin_disabled', 503);
  const ip = clientIp(req), t = Date.now(), a = attempts.get(ip) || { n: 0, since: t, until: 0 };
  if (a.until > t) throw new Err('locked', 429);
  if (t - a.since > 15 * 60000) { a.n = 0; a.since = t; }
  if (typeof c.body.password !== 'string' || !tEq(c.body.password.slice(0, 256), ADMIN_PASSWORD)) {
    if (++a.n >= 8) a.until = t + 15 * 60000;
    attempts.set(ip, a); throw new Err('bad_password', 401);
  }
  attempts.delete(ip);
  const exp = t + 8 * 3600000, secure = req.headers['x-forwarded-proto'] === 'https';
  res.setHeader('Set-Cookie', `rl_admin=${exp}.${sign(exp)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${secure ? '; Secure' : ''}`);
  return { ok: true };
};
A['POST /api/admin/logout'] = (c, req, res) => { res.setHeader('Set-Cookie', 'rl_admin=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'); return { ok: true }; };
A['GET /api/admin/session'] = () => ({ ok: true });
A['GET /api/admin/stats'] = () => world.adminStats();
A['GET /api/admin/withdrawals'] = async c => ({ list: await db.listWithdrawals({ status: c.q.get('status') || undefined, limit: 100 }) });
A['POST /api/admin/withdrawal'] = async c => ({ row: await world.reviewWithdrawal(String(c.body.id), c.body.action === 'approve', { tx: String(c.body.tx || '').slice(0, 120), note: String(c.body.note || '').slice(0, 200) }) });
A['GET /api/admin/players'] = c => ({ list: world.adminFind(c.q.get('q')) });
A['POST /api/admin/adjust'] = c => { world.adminAdjust(c.body.tid, c.body); return { ok: true }; };
A['POST /api/admin/ban'] = c => { world.adminBan(c.body.tid, c.body.banned); return { ok: true }; };
A['GET /api/admin/tasks'] = () => ({ list: W.tasks, types: world.TASK_TYPES });
A['POST /api/admin/tasks'] = async c => ({ list: await world.adminSaveTasks(c.body.list) });
A['GET /api/admin/ads-info'] = (c, req) => ({ rewardSecretSet: Boolean(process.env.ADSGRAM_REWARD_SECRET), origin: (process.env.WEB_APP_URL || '').replace(/\/$/, '') || `https://${req.headers.host}`, botReady: Boolean(process.env.BOT_TOKEN) });
A['GET /api/admin/settings'] = () => ({ settings: W.S, defaults: DEFAULTS });
A['POST /api/admin/settings'] = async c => { await world.setSetting(String(c.body.key), c.body.value); return { ok: true }; };

function serveStatic(req, res, url) {
  const p = url.pathname === '/' ? '/index.html' : url.pathname === '/admin' ? '/admin.html' : url.pathname;
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, { error: 'not_found' });
  send(res, 200, fs.readFileSync(file), { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname === '/health') return send(res, 200, { ok: true, players: W.players.size });
    if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, url);
    const key = `${req.method} ${url.pathname}`;
    if (url.pathname === '/api/adsgram/reward' && (req.method === 'GET' || req.method === 'POST')) {
      const r = world.adsgramReward(Object.fromEntries(url.searchParams));
      return send(res, r.status, r.ok ? { ok: true } : { error: r.error });
    }
    if (req.method === 'POST') {
      const origin = req.headers.origin;
      if (origin) { try { if (new URL(origin).host !== req.headers.host) throw 0; } catch { return send(res, 403, { error: 'origin' }); } }
    }
    if (url.pathname.startsWith('/api/admin/')) {
      const h = A[key]; if (!h) return send(res, 404, { error: 'not_found' });
      if (key !== 'POST /api/admin/login' && !isAdmin(req)) return send(res, 401, { error: 'unauthorized' });
      return send(res, 200, await h({ body: req.method === 'POST' ? await readJson(req, key === 'POST /api/admin/tasks' ? 65536 : 8192) : {}, q: url.searchParams }, req, res));
    }
    const h = P[key]; if (!h) return send(res, 404, { error: 'not_found' });
    const u = authUser(req);
    if (!u) return send(res, 401, { error: 'auth' });
    if (limited(u.id)) return send(res, 429, { error: 'slow_down' });
    const p = W.players.get(u.id);
    if (p?.banned) return send(res, 403, { error: 'banned' });
    if (req.method === 'POST' && W.S.maintenance) return send(res, 503, { error: 'maintenance' });
    const needsP = !['GET /api/me', 'POST /api/create', 'POST /api/lang', 'GET /api/leaderboard'].includes(key);
    if (needsP && !p) return send(res, 409, { error: 'no_farm' });
    const body = req.method === 'POST' ? await readJson(req) : {};
    return send(res, 200, await h({ p, u, body, q: url.searchParams }));
  } catch (e) {
    if (e instanceof Err) return send(res, e.status, { error: e.code });
    console.error('unhandled', req.method, req.url, e);
    return send(res, 500, { error: 'server' });
  }
});

async function main() {
  if (!db.remote) console.warn(`⚠ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set -> using local file ${process.env.DEV_DB_FILE || './data/dev.json'} (NOT for production)`);
  if (!ADMIN_PASSWORD) console.warn('ADMIN_PASSWORD not set: /admin login disabled.');
  await world.init(); W.notify = tg.notify;
  W.verifyChannel = async (chat, tid) => {
    if (!process.env.BOT_TOKEN) throw new Err('verify_unavailable', 503);
    try { const m = await tg.tgApi('getChatMember', { chat_id: chat, user_id: Number(tid) }); return ['member', 'administrator', 'creator'].includes(m.status) || (m.status === 'restricted' && m.is_member === true); }
    catch (e) { console.error('verifyChannel', chat, e.message); throw new Err('verify_unavailable', 503); }
  };
  setInterval(() => world.lumberTick(), 60000).unref();
  setInterval(() => world.flush(), 3000).unref();
  server.listen(PORT, () => console.log(`Green Valley listening on :${PORT}`));
  tg.startBot();
  const stop = async () => { console.log('shutting down...'); server.close(); await world.flush(); process.exit(0); };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
}
main().catch(e => { console.error('fatal', e); process.exit(1); });
export { server };
