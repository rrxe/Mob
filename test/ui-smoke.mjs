// Minimal DOM smoke test that renders all Green Valley screens.
import { spawn } from 'node:child_process';
const PORT = 3112, DB = '/tmp/green-valley-ui.json';
import fs from 'node:fs'; try { fs.unlinkSync(DB); } catch {}
const srv = spawn('node', ['server/index.js'], { env: { ...process.env, PORT, DEV_AUTH: '1', DEV_DB_FILE: DB, BOT_USERNAME: 'TestBot' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('server start timeout')), 5000); srv.stdout.on('data', d => { if (String(d).includes('listening')) { clearTimeout(timer); resolve(); } }); });
process.on('exit', () => srv.kill());
const els = {}, handlers = {};
const mk = id => els[id] ||= { id, _h: '', hidden: false, dataset: {}, style: {}, classList: { toggle() {}, add() {}, contains: () => false }, value: '', scrollTop: 0, scrollHeight: 0, clientHeight: 0, clientWidth: 300, scrollLeft: 0,
  set innerHTML(v) { this._h = v; }, get innerHTML() { return this._h; }, set textContent(v) { this._h = v; }, get textContent() { return this._h; }, contains: () => false, addEventListener() {}, remove() {}, closest() { return null; }, getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }), getBoundingClientRect: () => ({ left: 0, top: 0 }), blur() {}, select() {} };
globalThis.window = globalThis; globalThis.devicePixelRatio = 1;
globalThis.localStorage = { getItem: () => 'en', setItem() {} };
globalThis.location = { search: '?dev=77', reload() {} };
Object.defineProperty(globalThis, 'navigator', { value: { clipboard: { writeText: async () => {} } }, configurable: true });
const mkEl = () => { const e = mk('#__' + Math.random()); e.appendChild = () => {}; e.setAttribute = () => {}; e.animate = () => ({}); return e; };
globalThis.document = { createElement: mkEl, hidden: false, visibilityState: 'visible', activeElement: null, documentElement: {}, querySelector: s => /^#[\w-]+$/.test(s) ? mk(s) : null, querySelectorAll: () => [], addEventListener: (type, fn) => (handlers[type] ||= []).push(fn) };
globalThis.setInterval = () => 0;
const realFetch = fetch; globalThis.fetch = (u, o) => realFetch('http://127.0.0.1:' + PORT + u, o);
const art = await fetch('/assets/farm-valley.webp');
console.log('bundled art asset:', art.status === 200 && (art.headers.get('content-type') || '').includes('image/webp'));
const errors = []; process.on('unhandledRejection', e => errors.push(e)); process.on('uncaughtException', e => errors.push(e));
await import('../public/app.js');
const wait = ms => new Promise(r => setTimeout(r, ms));
const click = (act, data = {}) => handlers.click.forEach(fn => { try { fn({ target: { classList: { contains: () => false }, closest: () => ({ dataset: { act, ...data }, disabled: false }) } }); } catch (e) { errors.push(e); } });
await wait(400);
const view = () => els['#view']._h;
console.log('create screen:', view().includes('id="farmname"'));
mk('#farmname').value = 'UI Farm'; click('create'); await wait(700);
console.log('farm screen:', view().includes('plot-grid') && view().includes('farm-world') && view().includes('farm-landscape'), '| header:', els['#top']._h.includes('UI Farm'));
const tabs = [['forest', ['forest-world', 'lock-card']], ['market', ['crop-card', 'market-banner']], ['tasks', ['mission-row', 'order-row', 'daily-card']], ['wallet', ['exchangeAmount', 'wallet-hero']], ['more', ['invite']]];
for (const [name, snippets] of tabs) { click('tab', { v: name }); await wait(200); console.log(name + ' screen:', snippets.every(x => view().includes(x))); }
click('tab', { v: 'tasks' }); await wait(150); console.log('tasks has earn centre + quests:', view().includes('earn-card') && view().includes('task-row'));
click('tab', { v: 'more' }); click('moresub', { v: 'settings' }); await wait(120); console.log('effects settings rendered:', view().includes('sound_effects') || view().includes('toggle-pill')); click('moresub', { v: 'leaderboard' }); await wait(250); console.log('leaderboard rendered:', view().includes('leaderboardRows'));
console.log(errors.length ? 'ERRORS:\n' + errors.map(e => e.stack || e).join('\n') : 'no runtime errors');
srv.kill('SIGTERM'); process.exit(errors.length ? 1 : 0);
