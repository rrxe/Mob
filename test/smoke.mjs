// HTTP smoke test for the Green Valley farming simulator.
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const PORT = 3111, BASE = `http://127.0.0.1:${PORT}`, DB = '/tmp/green-valley-smoke.json';
try { fs.unlinkSync(DB); } catch {}
const srv = spawn('node', ['server/index.js'], { env: { ...process.env, PORT, DEV_AUTH: '1', DEV_DB_FILE: DB, ADMIN_PASSWORD: 'pw', BOT_USERNAME: 'TestBot', BOT_TOKEN: '' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('server start timeout')), 5000); srv.stdout.on('data', d => { if (String(d).includes('listening')) { clearTimeout(timer); resolve(); } }); });
const call = async (uid, method, path, body) => {
  await new Promise(r => setTimeout(r, 170));
  const r = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json', 'x-dev-user': uid }, body: body ? JSON.stringify(body) : undefined });
  return { s: r.status, j: await r.json() };
};
let pass = 0; const ok = (v, m) => { assert.ok(v, m); pass++; console.log(' ✓', m); };
try {
  let r = await call('1', 'GET', '/api/me'); ok(r.j.needsName, 'new user sees farm creation');
  r = await call('1', 'POST', '/api/create', { name: 'Sunny Farm' });
  ok(r.s === 200 && r.j.name === 'Sunny Farm' && r.j.farm.plots.length === 6, 'create a new farm with starter plots');
  r = await call('1', 'POST', '/api/plant', { plot: 0, crop: 'wheat' }); ok(r.s === 200 && r.j.readyAt > Date.now(), 'planting starts crop growth');
  r = await call('1', 'POST', '/api/plant', { plot: 0, crop: 'wheat' }); ok(r.j.error === 'plot_busy', 'cannot plant an occupied plot');
  r = await call('1', 'POST', '/api/water', { plot: 0 }); ok(r.s === 200, 'watering accelerates the crop');
  r = await call('1', 'POST', '/api/fertilize', { plot: 0 }); ok(r.s === 200, 'fertilizer accelerates growth');
  r = await call('1', 'POST', '/api/fertilize', { plot: 0 }); ok(r.j.error === 'already_fertilized', 'fertilizer can only be applied once per crop');
  r = await call('1', 'POST', '/api/daily'); ok(r.j.gems === 1 && r.j.streak === 1, 'daily login reward grants gems');
  r = await call('1', 'POST', '/api/daily'); ok(r.j.error === 'claimed', 'daily reward can only be claimed once');
  r = await call('1', 'POST', '/api/exchange', { gems: 1 }); ok(r.j.gram === 0.001, 'gems convert to GRAM using the configured rate');
  r = await call('1', 'POST', '/api/withdraw', { gram: 0.001, address: 'invalid' }); ok(r.j.error === 'wd_castle', 'withdrawal requires the configured farm level');
  r = await call('1', 'POST', '/api/upgrade', { building: 'land' }); ok(r.s === 200, 'land expansion upgrades the field');
  r = await call('1', 'GET', '/api/me'); ok(r.j.farm.plots.length === 8 && r.j.buildings.land.level === 2, 'land upgrade adds two plots');
  r = await call('1', 'GET', '/api/leaderboard'); ok(r.j.players[0].n === 'Sunny Farm', 'leaderboard ranks farms');
  r = await call('2', 'POST', '/api/create', { name: 'Green Acres', ref: '1' }); ok(r.s === 200, 'referral account creation works');
  r = await call('1', 'POST', '/api/attack', { x: 1, y: 1 }); ok(r.s === 404, 'old war endpoint is removed');
  r = await call('1', 'POST', '/api/lumber/start'); ok(r.s === 200 && r.j.readyAt > Date.now(), 'lumberjack works from farm level 1');
  r = await call('1', 'POST', '/api/ad/prepare', { kind: 'gems' }); ok(r.s === 200 && r.j.minSeconds > 0, 'ad session can be prepared');
  r = await call('1', 'POST', '/api/ad/confirm', { id: r.j.id }); ok(r.j.error === 'ad_short', 'ad confirm is rejected when watched too briefly');
  r = await call('1', 'POST', '/api/task/claim', { id: 'welcome_level5' }); ok(r.j.error === 'task_not_ready', 'level quest needs the level');
  r = await call('1', 'GET', '/api/me'); ok(r.j.lumber && r.j.ads && Array.isArray(r.j.tasks) && r.j.tasks.length >= 3, 'state carries lumber, ads and quests');
  const noAuth = await fetch(BASE + '/api/me'); ok(noAuth.status === 401, 'API requires Telegram or dev authentication');
  let a = await fetch(BASE + '/api/admin/stats'); ok(a.status === 401, 'admin requires login');
  a = await fetch(BASE + '/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'pw' }) });
  const ck = a.headers.get('set-cookie').split(';')[0]; ok(a.status === 200, 'admin login works');
  const adm = (m, p, b) => fetch(BASE + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async x => ({ s: x.status, j: await x.json() }));
  a = await adm('GET', '/api/admin/stats'); ok(a.j.farms === 2 && a.j.players === 2, 'admin statistics report farms');
  a = await adm('POST', '/api/admin/adjust', { tid: '1', gems: 50 }); ok(a.j.ok, 'admin can adjust gem balance');
  a = await adm('POST', '/api/admin/settings', { key: 'gems_per_gram', value: 500 }); ok(a.j.ok, 'admin can tune exchange rate');
  a = await adm('POST', '/api/admin/settings', { key: 'unknown', value: 1 }); ok(a.j.error === 'bad_key', 'unknown admin setting is rejected');
  a = await adm('GET', '/api/admin/tasks'); ok(Array.isArray(a.j.list), 'admin can list tasks');
  a = await adm('POST', '/api/admin/settings', { key: 'adsgram_reward_block_id', value: '777' }); ok(a.j.ok, 'admin can save an AdsGram block id');
  a = await adm('POST', '/api/admin/settings', { key: 'adsgram_task_block_id', value: 'abc' }); ok(a.j.error === 'bad_block', 'invalid block id is rejected');
  a = await fetch(BASE + '/api/adsgram/reward?userid=11111&secret=x'); ok(a.status === 503 || a.status === 403, 'AdsGram callback is closed without the secret');
  console.log(`\n${pass} checks passed`);
} catch (e) { console.error('\nFAILED:', e.stack || e); process.exitCode = 1; }
finally { srv.kill('SIGTERM'); }
