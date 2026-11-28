// Green Valley — authoritative farming world. All coin, crop and gem changes are server-side.
import crypto from 'node:crypto';
import * as G from './game.js';
import * as db from './db.js';

export class Err extends Error { constructor(code, status = 400) { super(code); this.code = code; this.status = status; } }
const now = () => Date.now();
const lname = s => String(s || '').trim().toLowerCase();
const int = (v, lo = 0, hi = 1e9) => { const n = Number(v); if (!Number.isInteger(n) || n < lo || n > hi) throw new Err('bad_input'); return n; };
const roundGram = n => Math.round(n * 1e6) / 1e6;
const NAME_RE = /^[\p{L}\p{N} _-]{3,18}$/u;

export const W = { players: new Map(), names: new Map(), S: { ...G.DEFAULTS }, tasks: [], dirtyP: new Set(), ledgerQ: [], notify: () => {}, lb: { t: 0, v: null },
  // Injected by index.js (real Telegram check). Tests replace it with a stub.
  verifyChannel: async () => { throw new Err('verify_unavailable', 503); }, rand: Math.random };
const busy = new Set();
const mut = p => W.dirtyP.add(p.tid);
const flushNow = async p => { mut(p); await flush(); };

function normalizePlayer(p) {
  p.tg ||= { u: null, f: '' };
  p.gems = Math.max(0, Number(p.gems) || 0);
  p.gram = Math.max(0, Number(p.gram) || 0);
  p.gemsEarned = Math.max(0, Number(p.gemsEarned) || 0);
  p.refs = Math.max(0, Number(p.refs) || 0);
  p.refEarn = Math.max(0, Number(p.refEarn) || 0);
  p.refPaid = !!p.refPaid;
  p.banned = !!p.banned;
  delete p._wd;
  p.daily ||= { last: '', streak: 0 };
  p.ach ||= {};
  p.farm ||= G.freshFarm(W.S, Number(p.created) || now());
  const f = p.farm;
  f.level = Math.max(1, Number(f.level) || 1);
  f.xp = Math.max(0, Number(f.xp) || 0);
  f.coins = Math.max(0, Number(f.coins ?? W.S.initial_coins) || 0);
  f.plots = Array.isArray(f.plots) ? f.plots : G.freshFarm(W.S).plots;
  f.plots.forEach((plot, i) => { plot.id = i; plot.crop ||= null; plot.plantedAt ||= 0; plot.readyAt ||= 0; plot.watered = !!plot.watered; plot.fertilized = !!plot.fertilized; });
  f.buildings ||= { land: 1, barn: 1, well: 1, greenhouse: 0 };
  for (const id of Object.keys(G.BUILDINGS)) f.buildings[id] = Math.max(0, Number(f.buildings[id]) || 0);
  f.inventory ||= {};
  for (const id of Object.keys(G.CROPS)) f.inventory[id] = Math.max(0, Number(f.inventory[id]) || 0);
  f.fertilizer = Math.max(0, Number(f.fertilizer) || 0);
  f.harvested = Math.max(0, Number(f.harvested) || 0);
  f.dailyWater ||= { day: G.dayKey(), used: 0 };
  f.missions ||= { day: G.dayKey(), progress: { harvest: 0, sell: 0, water: 0 }, claimed: {} };
  f.orders ||= { day: G.dayKey(), list: [] };
  f.achievements ||= {};
  const l = (p.lumber && typeof p.lumber === 'object') ? p.lumber : (p.lumber = {});
  l.level = Math.min(G.LUMBER_MAX, Math.max(1, Number(l.level) || 1));
  l.active = !!l.active; l.startedAt = Number(l.startedAt) || 0; l.readyAt = Number(l.readyAt) || 0;
  l.logs = Math.max(0, Number(l.logs) || 0); l.cycles = Math.max(0, Number(l.cycles) || 0); l.notified = !!l.notified;
  const tk = (p.tasks && typeof p.tasks === 'object') ? p.tasks : (p.tasks = {});
  tk.done ||= {}; tk.started ||= {}; tk.pendingAd = Math.max(0, Number(tk.pendingAd) || 0);
  const a = (p.ads && typeof p.ads === 'object') ? p.ads : (p.ads = {});
  a.day ||= G.dayKey(); a.count = Math.max(0, Number(a.count) || 0); a.nt = Math.max(0, Number(a.nt) || 0); a.last = Number(a.last) || 0; a.total = Math.max(0, Number(a.total) || 0);
  a.session ||= null; a.token ||= null;
  p.created ||= now(); p.seen ||= now(); p.t ||= now();
  return p;
}

export async function init() {
  const loaded = await db.loadAll();
  W.S = { ...G.DEFAULTS, ...Object.fromEntries(Object.entries(loaded.settings || {}).filter(([k]) => k in G.DEFAULTS)) };
  W.tasks = Array.isArray(loaded.settings?.tasks) ? loaded.settings.tasks.map(cleanTask).filter(Boolean) : DEFAULT_TASKS.map(x => ({ ...x }));
  for (const raw of loaded.players || []) {
    const needsFarmMigration = !raw.farm || typeof raw.farm !== 'object' || Array.isArray(raw.farm);
    const p = normalizePlayer(raw);
    if (!p.tid || !p.kname) continue;
    W.players.set(String(p.tid), p);
    W.names.set(lname(p.kname), String(p.tid));
    if (needsFarmMigration) mut(p);
  }
  for (const p of W.players.values()) ensureDay(p, now());
  console.log(`world: ${W.players.size} farms loaded`);
}

export async function flush() {
  if (W.dirtyP.size) {
    const list = [...W.dirtyP].map(id => W.players.get(id)).filter(Boolean);
    W.dirtyP.clear();
    for (const p of list) p._power = G.score(p);
    try { await db.savePlayers(list); }
    catch (e) { console.error('save players', e.message); list.forEach(p => W.dirtyP.add(p.tid)); }
  }
  if (W.ledgerQ.length) {
    const rows = W.ledgerQ.splice(0);
    try { await db.addLedger(rows); }
    catch (e) { console.error('ledger', e.message); W.ledgerQ.unshift(...rows); }
  }
}

function giveGems(p, amount, kind, ref = null) {
  const n = int(Math.floor(Number(amount) || 0), 0, 1e7);
  if (!n) return;
  p.gems += n; p.gemsEarned += n;
  W.ledgerQ.push({ tid: p.tid, delta: n, kind, ref: ref == null ? null : String(ref) });
  mut(p);
}
function spendGems(p, amount, kind, ref = null) {
  if (p.gems < amount) throw new Err('no_gems');
  p.gems -= amount;
  W.ledgerQ.push({ tid: p.tid, delta: -amount, kind, ref: ref == null ? null : String(ref) });
  mut(p);
}
function missionProgress(p, key, amount) {
  const m = p.farm.missions;
  m.progress[key] = Math.min(1e9, (m.progress[key] || 0) + amount);
}
function hashText(s) {
  let h = 2166136261;
  for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function makeOrders(p, day) {
  const unlocked = Object.entries(G.CROPS).filter(([, c]) => p.farm.level >= c.level && p.farm.buildings.greenhouse >= c.greenhouse);
  const list = [];
  for (let i = 0; i < 3; i++) {
    const h = hashText(`${p.tid}:${day}:${i}`);
    const [crop, cfg] = unlocked[h % unlocked.length];
    const qty = 4 + ((h >>> 7) % 8) + Math.floor(p.farm.level / 3);
    list.push({ id: `${day}-${i}`, crop, qty, reward: Math.round(qty * cfg.price * 1.45 + 35 + p.farm.level * 8), xp: qty * cfg.xp, done: false });
  }
  return { day, list };
}
function ensureDay(p, t = now()) {
  const day = G.dayKey(t), f = p.farm;
  if (f.dailyWater.day !== day) f.dailyWater = { day, used: 0 };
  if (f.missions.day !== day) f.missions = { day, progress: { harvest: 0, sell: 0, water: 0 }, claimed: {} };
  if (f.orders.day !== day || !Array.isArray(f.orders.list) || !f.orders.list.length) f.orders = makeOrders(p, day);
}
export function touch(p, t = now()) { ensureDay(p, t); p.seen = t; }

function totalInventory(p) { return G.inventoryCount(p.farm.inventory); }
function addCoins(p, n) { p.farm.coins = Math.min(2_000_000_000, p.farm.coins + Math.max(0, Math.floor(n))); }
function payCoins(p, n) { n = Math.max(0, Math.floor(n)); if (p.farm.coins < n) throw new Err('no_coins'); p.farm.coins -= n; }
function gainXp(p, n) {
  const f = p.farm; f.xp += Math.max(0, Math.floor(n));
  let gained = 0;
  while (f.level < 50 && f.xp >= G.xpNeeded(f.level)) {
    f.xp -= G.xpNeeded(f.level); f.level++; gained++;
    const step = W.S.levelup_gems_step, g = W.S.levelup_gems + (step > 0 ? Math.floor(f.level / step) : 0);
    if (g > 0) giveGems(p, g, 'level_up', `level_${f.level}`);
  }
  if (gained) checkAchievements(p);
  return gained;
}
function checkAchievements(p) {
  const f = p.farm;
  for (const [level, gems] of Object.entries(W.S.ach_gems || {})) {
    const l = Number(level), key = `farm_${l}`;
    if (f.level >= l && !f.achievements[key]) { f.achievements[key] = true; giveGems(p, gems, 'farm_level', `level_${l}`); }
  }
  if (f.level >= 5 && p.ref && !p.refPaid) {
    const r = W.players.get(String(p.ref));
    if (r && r.tid !== p.tid) {
      p.refPaid = true;
      giveGems(r, W.S.ref_gems, 'referral', p.tid); r.refs++; r.refEarn += W.S.ref_gems; mut(r);
      giveGems(p, W.S.ref_bonus, 'referral_bonus', r.tid);
      W.notify(r.tid, `🎉 وصلت مزرعة ${p.kname} إلى المستوى 5 — حصلت على ${W.S.ref_gems} 💎\nYour invited farmer ${p.kname} reached level 5 — you earned ${W.S.ref_gems} 💎`);
    }
  }
}
function cropUnlocked(p, id) {
  if (!Object.hasOwn(G.CROPS, id)) return false;
  const c = G.CROPS[id];
  return !!c && p.farm.level >= c.level && p.farm.buildings.greenhouse >= c.greenhouse;
}
function plotOf(p, index) {
  index = int(index, 0, 100);
  const plot = p.farm.plots[index];
  if (!plot) throw new Err('bad_plot');
  return plot;
}

// ---------- account creation ----------
export async function createFarm(tid, tg, { name, ref }) {
  tid = String(tid);
  if (W.players.has(tid)) throw new Err('exists');
  name = String(name || '').trim().replace(/\s+/g, ' ');
  if (!NAME_RE.test(name)) throw new Err('bad_name');
  if (W.names.has(lname(name))) throw new Err('name_taken');
  const t = now();
  const p = normalizePlayer({
    tid, kname: name, region: 0, tg: { u: tg.username || null, f: tg.firstName || '' },
    created: t, t, seen: t, gems: 0, gram: 0, gemsEarned: 0,
    daily: { last: '', streak: 0 }, ach: {}, refs: 0, refEarn: 0, refPaid: false,
    ref: null, banned: false, farm: G.freshFarm(W.S, t),
  });
  ref = String(ref || '');
  if (ref && ref !== tid && W.players.has(ref)) p.ref = ref;
  W.players.set(tid, p); W.names.set(lname(name), tid);
  ensureDay(p, t);
  await flushNow(p);
  return p;
}

// ---------- farming actions ----------
export function plant(p, { plot: index, crop }) {
  touch(p);
  const plot = plotOf(p, index), id = String(crop || ''), cfg = Object.hasOwn(G.CROPS, id) ? G.CROPS[id] : null;
  if (!cfg || !cropUnlocked(p, id)) throw new Err('crop_locked');
  if (plot.crop) throw new Err('plot_busy');
  payCoins(p, cfg.seed);
  const greenhouseBonus = Math.min(0.2, p.farm.buildings.greenhouse * 0.035);
  const growMs = Math.max(15, Math.round(cfg.grow * (1 - greenhouseBonus) * 1000));
  const t = now();
  Object.assign(plot, { crop: id, plantedAt: t, readyAt: t + growMs, watered: false, fertilized: false });
  mut(p);
  return { readyAt: plot.readyAt };
}
export function water(p, { plot: index }) {
  touch(p);
  const plot = plotOf(p, index), f = p.farm;
  if (!plot.crop) throw new Err('empty_plot');
  if (plot.readyAt <= now()) throw new Err('already_ready');
  if (plot.watered) throw new Err('already_watered');
  if (f.dailyWater.used >= G.waterCap(f, W.S)) throw new Err('water_empty');
  const remain = plot.readyAt - now();
  const pct = Math.min(60, Math.max(0, W.S.water_speed_percent)) / 100;
  plot.readyAt = Math.max(now() + 1000, plot.readyAt - Math.round(remain * pct));
  plot.watered = true; f.dailyWater.used++;
  missionProgress(p, 'water', 1);
  mut(p);
  return { readyAt: plot.readyAt };
}
export function buyFertilizer(p, { amount = 1 }) {
  touch(p);
  amount = int(amount, 1, 50);
  if (p.farm.fertilizer + amount > 100) throw new Err('fertilizer_limit');
  payCoins(p, amount * W.S.fertilizer_price);
  p.farm.fertilizer += amount; mut(p);
  return { fertilizer: p.farm.fertilizer };
}
export function fertilize(p, { plot: index }) {
  touch(p);
  const plot = plotOf(p, index);
  if (!plot.crop) throw new Err('empty_plot');
  if (plot.readyAt <= now()) throw new Err('already_ready');
  if (plot.fertilized) throw new Err('already_fertilized');
  if (p.farm.fertilizer < 1) throw new Err('no_fertilizer');
  const remain = plot.readyAt - now();
  const pct = Math.min(60, Math.max(0, W.S.fertilizer_speed_percent)) / 100;
  plot.readyAt = Math.max(now() + 1000, plot.readyAt - Math.round(remain * pct));
  plot.fertilized = true; p.farm.fertilizer--;
  mut(p);
  return { readyAt: plot.readyAt };
}
export function harvest(p, { plot: index }) {
  touch(p);
  const plot = plotOf(p, index), f = p.farm;
  if (!plot.crop) throw new Err('empty_plot');
  if (plot.readyAt > now()) throw new Err('not_ready');
  const id = plot.crop, cfg = G.CROPS[id], qty = cfg.yield;
  if (totalInventory(p) + qty > G.storageCap(f, W.S)) throw new Err('storage_full');
  f.inventory[id] = (f.inventory[id] || 0) + qty;
  f.harvested += qty;
  missionProgress(p, 'harvest', qty);
  const levels = gainXp(p, qty * cfg.xp);
  let gem = 0;
  if (W.S.harvest_gem_chance > 0 && W.S.harvest_gem_amount > 0 && W.rand() * 100 < W.S.harvest_gem_chance) { gem = W.S.harvest_gem_amount; giveGems(p, gem, 'harvest_drop', id); }
  Object.assign(plot, { crop: null, plantedAt: 0, readyAt: 0, watered: false, fertilized: false });
  mut(p);
  return { crop: id, amount: qty, levels, gem };
}
export function sell(p, { crop, amount }) {
  touch(p);
  const id = String(crop || ''), cfg = Object.hasOwn(G.CROPS, String(crop || '')) ? G.CROPS[id] : null;
  if (!cfg) throw new Err('bad_input');
  const have = p.farm.inventory[id] || 0;
  amount = amount === 'all' ? have : int(amount, 1, 1e7);
  if (amount > have) throw new Err('no_stock');
  p.farm.inventory[id] -= amount;
  const coins = amount * cfg.price;
  addCoins(p, coins);
  missionProgress(p, 'sell', amount);
  gainXp(p, Math.floor(amount / 5));
  mut(p);
  return { coins, amount };
}
export function upgrade(p, { building }) {
  touch(p);
  const id = String(building || ''), def = Object.hasOwn(G.BUILDINGS, String(building || '')) ? G.BUILDINGS[id] : null;
  if (!def) throw new Err('bad_input');
  const current = p.farm.buildings[id];
  const next = current + 1;
  if (current >= def.max) throw new Err('building_max');
  const cost = G.buildingCost(id, next);
  if (p.farm.level < Math.max(1, next - (id === 'greenhouse' ? 0 : 1))) throw new Err('building_level');
  if (id === 'land' && p.farm.plots.length >= 18) throw new Err('building_max');
  payCoins(p, cost);
  p.farm.buildings[id] = next;
  if (id === 'land') {
    for (let i = 0; i < 2; i++) p.farm.plots.push({ id: p.farm.plots.length, crop: null, plantedAt: 0, readyAt: 0, watered: false, fertilized: false });
  }
  mut(p);
  return { building: id, level: next };
}

// ---------- daily rewards, missions and market orders ----------
export function daily(p) {
  touch(p);
  const today = G.dayKey(), yesterday = G.dayKey(now() - 86400000);
  if (p.daily.last === today) throw new Err('claimed');
  const streak = p.daily.last === yesterday ? p.daily.streak + 1 : 1;
  const arr = W.S.daily_gems;
  const gems = arr[(streak - 1) % arr.length];
  p.daily = { last: today, streak };
  giveGems(p, gems, 'daily', `day_${streak}`);
  mut(p);
  return { gems, streak };
}
const MISSION_DEFS = [
  { id: 'harvest', target: 'mission_harvest_target', reward: 'mission_harvest_gems', coins: 90 },
  { id: 'sell', target: 'mission_sell_target', reward: 'mission_sell_gems', coins: 110 },
  { id: 'water', target: 'mission_water_target', reward: 'mission_water_gems', coins: 70 },
];
export function claimMission(p, { id }) {
  touch(p);
  const def = MISSION_DEFS.find(x => x.id === id);
  if (!def) throw new Err('bad_input');
  const m = p.farm.missions;
  if (m.claimed[id]) throw new Err('claimed');
  if ((m.progress[id] || 0) < W.S[def.target]) throw new Err('mission_not_ready');
  m.claimed[id] = true;
  addCoins(p, def.coins);
  let gems = W.S[def.reward];
  giveGems(p, gems, 'daily_mission', `${m.day}_${id}`);
  let bonus = 0;
  if (MISSION_DEFS.every(x => m.claimed[x.id]) && !m.bonus) { m.bonus = true; bonus = W.S.missions_all_bonus_gems; giveGems(p, bonus, 'missions_bonus', m.day); }
  mut(p);
  return { gems, coins: def.coins, bonus };
}
export function fulfillOrder(p, { id }) {
  touch(p);
  const order = p.farm.orders.list.find(x => x.id === String(id));
  if (!order) throw new Err('order_missing');
  if (order.done) throw new Err('order_done');
  if ((p.farm.inventory[order.crop] || 0) < order.qty) throw new Err('no_stock');
  p.farm.inventory[order.crop] -= order.qty;
  order.done = true;
  addCoins(p, order.reward);
  const levels = gainXp(p, order.xp);
  let gems = W.S.order_gems, bonus = 0;
  if (gems > 0) giveGems(p, gems, 'order', order.id);
  if (p.farm.orders.list.every(x => x.done) && !p.farm.orders.bonus) { p.farm.orders.bonus = true; bonus = W.S.order_all_bonus_gems; giveGems(p, bonus, 'orders_bonus', p.farm.orders.day); }
  mut(p);
  return { coins: order.reward, levels, gems, bonus };
}

// ---------- Lumberjack (tree cutting) ----------
const lumberOn = p => {
  if (!W.S.lumber_enabled) throw new Err('lumber_off');
  if (p.farm.level < W.S.lumber_unlock_level) throw new Err('lumber_locked');
  return p.lumber;
};
export function lumberStart(p) {
  touch(p); const l = lumberOn(p);
  if (l.active) throw new Err('lumber_busy');
  const t = now();
  Object.assign(l, { active: true, startedAt: t, readyAt: t + G.lumberMinutes(l.level, W.S) * 60000, notified: false });
  mut(p);
  return { readyAt: l.readyAt };
}
export function lumberClaim(p, { double } = {}) {
  touch(p); const l = lumberOn(p);
  if (!l.active) throw new Err('lumber_idle');
  if (l.readyAt > now()) throw new Err('lumber_not_ready');
  let mult = 1;
  if (double) {
    if (!W.S.lumber_ad_double || !W.S.ads_enabled) throw new Err('bad_input');
    useAdToken(p, 'lumber'); mult = 2;
  }
  const logs = G.lumberLogs(l.level, W.S) * mult, gems = G.lumberGems(l.level, W.S) * mult, xp = G.lumberXp(l.level) * mult;
  Object.assign(l, { active: false, startedAt: 0, readyAt: 0, notified: false });
  l.logs += logs; l.cycles++;
  if (gems > 0) giveGems(p, gems, 'lumber', `cycle_${l.cycles}`);
  const levels = gainXp(p, xp);
  mut(p);
  return { logs, gems, xp, levels, doubled: mult === 2 };
}
export function lumberUpgrade(p) {
  touch(p); const l = lumberOn(p);
  if (l.level >= G.LUMBER_MAX) throw new Err('building_max');
  const next = l.level + 1;
  if (p.farm.level + W.S.lumber_farm_gap < next) throw new Err('building_level');
  payCoins(p, G.lumberUpgradeCost(l.level, W.S));
  l.level = next; mut(p);
  return { level: next, tree: G.treeFor(next) };
}
export function lumberSell(p, { amount } = {}) {
  touch(p); const l = lumberOn(p);
  const n = amount === 'all' || amount == null ? l.logs : int(amount, 1, 1e9);
  if (n < 1 || n > l.logs) throw new Err('no_stock');
  l.logs -= n;
  const coins = n * W.S.lumber_log_price;
  addCoins(p, coins); missionProgress(p, 'sell', n); mut(p);
  return { coins, amount: n };
}
export function lumberTick() { // called every minute: one "your logs are ready" message per cycle
  const t = now();
  for (const p of W.players.values()) {
    const l = p.lumber;
    if (!l.active || l.notified || l.readyAt > t || p.banned) continue;
    l.notified = true; mut(p);
    W.notify(p.tid, '🪓 انتهى قطع الأشجار! الأخشاب جاهزة للاستلام 🌲\nYour lumber cycle is done — collect your logs and gems!');
  }
}

// ---------- Ads (AdsGram) ----------
const AD_KINDS = ['gems', 'coins', 'water', 'speed', 'lumber'];
const adDay = p => { const a = p.ads, d = G.dayKey(); if (a.day !== d) { a.day = d; a.count = 0; a.nt = 0; } return a; };
export function adPrepare(p, { kind } = {}) {
  touch(p);
  if (!W.S.ads_enabled) throw new Err('ads_off');
  kind = String(kind || '');
  if (!AD_KINDS.includes(kind)) throw new Err('bad_input');
  const a = adDay(p);
  if (a.count >= W.S.ad_daily_cap) throw new Err('ad_cap');
  if (now() - a.last < W.S.ad_cooldown_seconds * 1000) throw new Err('ad_cooldown');
  if (kind === 'lumber') { const l = lumberOn(p); if (!l.active || l.readyAt > now()) throw new Err('lumber_not_ready'); }
  if (kind === 'speed' && !p.farm.plots.some(x => x.crop && x.readyAt > now())) throw new Err('nothing_growing');
  a.session = { id: crypto.randomUUID(), kind, t: now() };
  mut(p);
  return { id: a.session.id, minSeconds: W.S.ad_min_seconds };
}
export function adConfirm(p, { id } = {}) {
  touch(p);
  const a = adDay(p), s = a.session;
  if (!s || s.id !== String(id)) throw new Err('ad_session');
  a.session = null;
  const elapsed = (now() - s.t) / 1000;
  if (elapsed < W.S.ad_min_seconds) { mut(p); throw new Err('ad_short'); }
  if (elapsed > 900) { mut(p); throw new Err('ad_session'); }
  a.count++; a.total++; a.last = now();
  const out = { kind: s.kind, gems: 0, coins: 0 };
  const f = p.farm;
  if (s.kind === 'gems') { out.gems = W.S.ad_reward_gems; giveGems(p, out.gems, 'ad', 'reward'); }
  else if (s.kind === 'coins') { out.coins = W.S.ad_reward_coins; addCoins(p, out.coins); }
  else if (s.kind === 'water') { f.dailyWater.used = 0; }
  else if (s.kind === 'speed') {
    const pct = Math.min(60, Math.max(0, W.S.ad_speed_percent)) / 100, t = now();
    for (const x of f.plots) if (x.crop && x.readyAt > t) x.readyAt = Math.max(t + 1000, x.readyAt - Math.round((x.readyAt - t) * pct));
  } else if (s.kind === 'lumber') a.token = { kind: 'lumber', t: now() };
  mut(p);
  return out;
}
function useAdToken(p, kind) {
  const k = p.ads.token;
  if (!k || k.kind !== kind || now() - k.t > 600000) throw new Err('ad_session');
  p.ads.token = null;
}
// AdsGram server-to-server callback for the native Task block (secret from env ADSGRAM_REWARD_SECRET).
const sha = v => crypto.createHash('sha256').update(String(v)).digest();
export function adsgramReward(query) {
  const secret = String(process.env.ADSGRAM_REWARD_SECRET || '');
  if (!secret) return { status: 503, error: 'not_configured' };
  const given = String(query.secret || '');
  if (!given || !crypto.timingSafeEqual(sha(given), sha(secret))) return { status: 403, error: 'forbidden' };
  const tid = String(query.userid ?? query.userId ?? '');
  if (!/^\d{5,20}$/.test(tid)) return { status: 400, error: 'bad_user' };
  const p = W.players.get(tid);
  if (!p) return { status: 404, error: 'no_player' };
  p.tasks.pendingAd = Math.min(5, p.tasks.pendingAd + 1); mut(p);
  return { status: 200, ok: true };
}
export function adsgramClaim(p) {
  touch(p);
  if (!W.S.ads_enabled) throw new Err('ads_off');
  const a = adDay(p);
  if (p.tasks.pendingAd < 1) return { pending: true, gems: 0 };
  if (a.nt >= 30) throw new Err('ad_cap');
  p.tasks.pendingAd--; a.nt++;
  const gems = W.S.adsgram_task_reward_gems;
  if (gems > 0) giveGems(p, gems, 'adsgram_task', null);
  mut(p);
  return { pending: false, gems };
}

// ---------- Admin-managed tasks ----------
export const TASK_TYPES = ['link', 'channel', 'invite', 'level', 'harvest', 'lumber'];
export const DEFAULT_TASKS = [
  { id: 'welcome_invite3', type: 'invite', title_ar: 'ادعُ 3 أصدقاء', title_en: 'Invite 3 friends', icon: '👥', url: '', chat: '', target: 3, wait: 0, gems: 5, coins: 250, repeat: 'once', active: true },
  { id: 'welcome_level5', type: 'level', title_ar: 'ارفع مزرعتك إلى المستوى 5', title_en: 'Reach farm level 5', icon: '🌱', url: '', chat: '', target: 5, wait: 0, gems: 3, coins: 150, repeat: 'once', active: true },
  { id: 'welcome_logs', type: 'lumber', title_ar: 'أكمل 3 دورات قطع أشجار', title_en: 'Finish 3 lumber cycles', icon: '🪓', url: '', chat: '', target: 3, wait: 0, gems: 4, coins: 200, repeat: 'once', active: true },
];
const clean = (v, n) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);
const num = (v, lo, hi, d = 0) => { v = Math.floor(Number(v)); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
export function cleanTask(x) {
  if (!x || typeof x !== 'object') return null;
  const type = TASK_TYPES.includes(x.type) ? x.type : null;
  if (!type) return null;
  const id = /^[a-z0-9_-]{3,32}$/i.test(String(x.id || '')) ? String(x.id) : 't' + crypto.randomBytes(4).toString('hex');
  let url = clean(x.url, 300), chat = clean(x.chat, 80);
  if (url && !/^https:\/\/[^\s]+$/i.test(url)) url = '';
  if (chat) { chat = chat.replace(/^https?:\/\/t\.me\//i, '@').replace(/\/+$/, ''); if (!/^(@[A-Za-z][A-Za-z0-9_]{3,31}|-100\d{5,15})$/.test(chat)) chat = ''; }
  const t = { id, type, title_ar: clean(x.title_ar, 80), title_en: clean(x.title_en, 80), icon: clean(x.icon, 4) || '⭐', url, chat,
    target: num(x.target, 1, 1e6, 1), wait: num(x.wait, 0, 600, 0), gems: num(x.gems, 0, 1e5), coins: num(x.coins, 0, 1e7), repeat: x.repeat === 'daily' ? 'daily' : 'once', active: x.active !== false };
  if (!t.title_ar && !t.title_en) return null;
  if (!t.title_ar) t.title_ar = t.title_en; if (!t.title_en) t.title_en = t.title_ar;
  if (type === 'link' && !t.url) return null;
  if (type === 'channel' && !t.chat) return null;
  return t;
}
export async function adminSaveTasks(list) {
  if (!Array.isArray(list) || list.length > 40) throw new Err('bad_type');
  const seen = new Set(), out = [];
  for (const raw of list) { const t = cleanTask(raw); if (!t) throw new Err('bad_task'); if (seen.has(t.id)) t.id = 't' + crypto.randomBytes(4).toString('hex'); seen.add(t.id); out.push(t); }
  W.tasks = out; await db.saveSetting('tasks', out);
  return out;
}
const taskDoneNow = (p, t) => { const d = p.tasks.done[t.id]; return t.repeat === 'daily' ? d === G.dayKey() : !!d; };
function taskProgress(p, t) {
  if (t.type === 'invite') return p.refs;
  if (t.type === 'level') return p.farm.level;
  if (t.type === 'harvest') return p.farm.harvested;
  if (t.type === 'lumber') return p.lumber.cycles;
  return 0;
}
export function tasksView(p) {
  const tnow = now();
  return W.tasks.filter(t => t.active).map(t => {
    const done = taskDoneNow(p, t), progress = Math.min(taskProgress(p, t), t.target), st = Number(p.tasks.started[t.id]) || 0;
    const auto = ['invite', 'level', 'harvest', 'lumber'].includes(t.type);
    return { id: t.id, type: t.type, icon: t.icon, title_ar: t.title_ar, title_en: t.title_en, url: t.url, chat: t.chat, target: auto ? t.target : 0, progress: auto ? progress : 0,
      wait: t.wait, gems: t.gems, coins: t.coins, repeat: t.repeat, done,
      ready: !done && (auto ? progress >= t.target : (t.type === 'link' ? st > 0 && tnow - st >= t.wait * 1000 : true)), started: st > 0 && !done };
  });
}
export function taskStart(p, { id } = {}) {
  touch(p);
  const t = W.tasks.find(x => x.active && x.id === String(id));
  if (!t) throw new Err('task_missing');
  if (taskDoneNow(p, t)) throw new Err('claimed');
  p.tasks.started[t.id] = now(); mut(p);
  return { wait: t.wait };
}
export async function taskClaim(p, { id } = {}) {
  touch(p);
  const t = W.tasks.find(x => x.active && x.id === String(id));
  if (!t) throw new Err('task_missing');
  const key = p.tid + ':' + t.id;
  if (busy.has(key)) throw new Err('busy');
  busy.add(key);
  try {
    if (taskDoneNow(p, t)) throw new Err('claimed');
    if (['invite', 'level', 'harvest', 'lumber'].includes(t.type)) { if (taskProgress(p, t) < t.target) throw new Err('task_not_ready'); }
    else if (t.type === 'link') {
      const st = Number(p.tasks.started[t.id]) || 0;
      if (!st) throw new Err('task_not_started');
      if (now() - st < t.wait * 1000) throw new Err('task_wait');
    } else if (t.type === 'channel') {
      if (!(await W.verifyChannel(t.chat, p.tid))) throw new Err('not_joined');
      if (taskDoneNow(p, t)) throw new Err('claimed');
    }
    p.tasks.done[t.id] = t.repeat === 'daily' ? G.dayKey() : true;
    delete p.tasks.started[t.id];
    if (t.gems > 0) giveGems(p, t.gems, 'task', t.id);
    if (t.coins > 0) addCoins(p, t.coins);
    mut(p);
    return { gems: t.gems, coins: t.coins };
  } finally { busy.delete(key); }
}

// ---------- gems -> GRAM and withdrawals ----------
export function exchange(p, amount) {
  touch(p);
  amount = int(amount, 1, 1e9);
  if (!Number.isFinite(W.S.gems_per_gram) || W.S.gems_per_gram <= 0) throw new Err('bad_rate');
  const gram = roundGram(amount / W.S.gems_per_gram);
  if (gram <= 0) throw new Err('bad_input');
  spendGems(p, amount, 'exchange', String(gram));
  p.gram = roundGram(p.gram + gram);
  mut(p);
  return { gram };
}
const ADDR_RE = /^(EQ|UQ|kQ|0Q)[A-Za-z0-9_-]{46}$/;
export async function withdraw(p, { gram, address }) {
  touch(p);
  gram = Number(gram); address = String(address || '').trim();
  if (!Number.isFinite(gram) || gram <= 0) throw new Err('bad_input');
  gram = roundGram(gram);
  if (p.farm.level < W.S.withdraw_min_castle) throw new Err('wd_castle');
  if (gram < W.S.min_withdraw_gram) throw new Err('wd_min');
  if (gram > p.gram) throw new Err('no_gram');
  if (!ADDR_RE.test(address)) throw new Err('bad_address');
  if (p._wd) throw new Err('busy');
  p._wd = true;
  try {
    const pending = await db.listWithdrawals({ tid: p.tid, status: 'pending', limit: 1 });
    if (pending.length) throw new Err('wd_pending');
    p.gram = roundGram(p.gram - gram);
    await flushNow(p);
    try { return await db.createWithdrawal({ tid: p.tid, gram, address }); }
    catch (e) { p.gram = roundGram(p.gram + gram); mut(p); throw new Err('server', 500); }
  } finally { delete p._wd; }
}
export async function reviewWithdrawal(id, approve, { tx, note } = {}) {
  const w = await db.getWithdrawal(id);
  if (!w) throw new Err('not_found', 404);
  if (w.status !== 'pending') throw new Err('already_done');
  const patch = approve ? { status: 'paid', tx_hash: tx || null, reviewed_at: new Date().toISOString() }
    : { status: 'rejected', note: note || null, reviewed_at: new Date().toISOString() };
  const updated = await db.updateWithdrawal(id, patch);
  if (!updated) throw new Err('already_done');
  const p = W.players.get(String(w.tid));
  if (!approve && p) { p.gram = roundGram(p.gram + Number(w.gram)); await flushNow(p); }
  W.notify(w.tid, approve ? `✅ تم دفع ${w.gram} GRAM${tx ? '\nTX: ' + tx : ''}\nYour ${w.gram} GRAM withdrawal was paid.` : `❌ تم رفض السحب وأُعيد الرصيد${note ? ': ' + note : ''}\nWithdrawal rejected, balance returned.`);
  return updated;
}

// ---------- ranking and client state ----------
export function leaderboard() {
  const t = now();
  if (W.lb.v && t - W.lb.t < 5000) return W.lb.v;
  const players = [...W.players.values()].map(p => ({ n: p.kname, level: p.farm.level, harvested: p.farm.harvested, score: G.score(p) }))
    .sort((a, b) => b.score - a.score).slice(0, 50);
  W.lb = { t, v: { players } };
  return W.lb.v;
}
export function refLink(tid) {
  const bot = process.env.BOT_USERNAME || '', short = process.env.MINIAPP_SHORTNAME || '';
  return short ? `https://t.me/${bot}/${short}?startapp=ref_${tid}` : `https://t.me/${bot}?start=ref_${tid}`;
}
function missionView(p) {
  const m = p.farm.missions;
  return MISSION_DEFS.map(d => ({ id: d.id, progress: m.progress[d.id] || 0, target: W.S[d.target], gems: W.S[d.reward], coins: d.coins, claimed: !!m.claimed[d.id] }));
}
export function view(p) {
  const t = now(); touch(p, t);
  const f = p.farm, invCap = G.storageCap(f, W.S), crops = {};
  for (const [id, c] of Object.entries(G.CROPS)) crops[id] = { ...c, unlocked: cropUnlocked(p, id) };
  const plots = f.plots.map(x => ({ ...x, remaining: x.crop ? Math.max(0, Math.ceil((x.readyAt - t) / 1000)) : 0, ready: !!x.crop && x.readyAt <= t }));
  const buildings = {};
  for (const [id, def] of Object.entries(G.BUILDINGS)) {
    const next = f.buildings[id] + 1;
    buildings[id] = { level: f.buildings[id], max: def.max, cost: f.buildings[id] >= def.max ? 0 : G.buildingCost(id, next), canUpgrade: f.buildings[id] < def.max && !(id === 'land' && f.plots.length >= 18) && f.coins >= G.buildingCost(id, next) && f.level >= Math.max(1, next - (id === 'greenhouse' ? 0 : 1)) };
  }
  const today = G.dayKey(), yesterday = G.dayKey(t - 86400000);
  const streak = p.daily.last === today || p.daily.last === yesterday ? p.daily.streak : 0;
  const dailyNext = streak + 1;
  const refList = [...W.players.values()].filter(x => x.ref === p.tid).map(x => ({ n: x.kname, level: x.farm.level, paid: x.refPaid })).slice(0, 50);
  return {
    now: t, needsName: false, tid: p.tid, name: p.kname,
    farm: { level: f.level, xp: f.xp, xpNext: G.xpNeeded(f.level), coins: f.coins, plots, buildings: f.buildings, inventory: f.inventory,
      inventoryUsed: totalInventory(p), inventoryCap: invCap, fertilizer: f.fertilizer, harvested: f.harvested,
      water: { used: f.dailyWater.used, cap: G.waterCap(f, W.S) } },
    crops, buildings, missions: missionView(p), orders: f.orders.list,
    gems: p.gems, gram: p.gram,
    daily: { can: p.daily.last !== today, streak, reward: W.S.daily_gems[(dailyNext - 1) % W.S.daily_gems.length], days: W.S.daily_gems },
    refs: { count: p.refs, earn: p.refEarn, link: refLink(p.tid), list: refList, reward: W.S.ref_gems, bonus: W.S.ref_bonus },
    cfg: { orderGems: W.S.order_gems, levelGems: { base: W.S.levelup_gems, step: W.S.levelup_gems_step }, gemsPerGram: W.S.gems_per_gram, minWithdrawGram: W.S.min_withdraw_gram, wdLevel: W.S.withdraw_min_castle, fertilizerPrice: W.S.fertilizer_price, maintenance: W.S.maintenance },
    online: [...W.players.values()].filter(x => t - x.seen < 120000).length,
    lumber: lumberView(p, t),
    tasks: tasksView(p),
    ads: adsView(p, t),
  };
}
function lumberView(p, t) {
  const l = p.lumber, S = W.S, lv = l.level, next = lv + 1, atMax = lv >= G.LUMBER_MAX, cost = atMax ? 0 : G.lumberUpgradeCost(lv, S);
  return {
    enabled: S.lumber_enabled, unlockLevel: S.lumber_unlock_level, unlocked: p.farm.level >= S.lumber_unlock_level,
    level: lv, max: G.LUMBER_MAX, tree: G.treeFor(lv), active: l.active, startedAt: l.startedAt, readyAt: l.readyAt,
    ready: l.active && l.readyAt <= t, logs: l.logs, cycles: l.cycles, logPrice: S.lumber_log_price, adDouble: S.lumber_ad_double && S.ads_enabled,
    cur: { minutes: G.lumberMinutes(lv, S), logs: G.lumberLogs(lv, S), gems: G.lumberGems(lv, S), xp: G.lumberXp(lv) },
    next: atMax ? null : { minutes: G.lumberMinutes(next, S), logs: G.lumberLogs(next, S), gems: G.lumberGems(next, S), cost, needFarm: Math.max(1, next - S.lumber_farm_gap), canUpgrade: p.farm.coins >= cost && p.farm.level + S.lumber_farm_gap >= next },
  };
}
function adsView(p, t) {
  const S = W.S, a = adDay(p);
  return {
    enabled: S.ads_enabled, taskBlock: S.adsgram_task_block_id, rewardBlock: S.adsgram_reward_block_id, intBlock: S.adsgram_interstitial_block_id,
    used: a.count, cap: S.ad_daily_cap, cooldown: Math.max(0, Math.ceil((a.last + S.ad_cooldown_seconds * 1000 - t) / 1000)), minSeconds: S.ad_min_seconds,
    gems: S.ad_reward_gems, coins: S.ad_reward_coins, clickRequired: S.ad_click_required, speedPct: S.ad_speed_percent, taskGems: S.adsgram_task_reward_gems, intCooldown: S.ad_interstitial_cooldown,
    nativeLeft: Math.max(0, 30 - a.nt),
  };
}

// ---------- administration ----------
// AdsGram block IDs: task-123 / int-123 / plain numeric for rewarded video. A bare number is accepted for task/int too.
const BLOCK_KINDS = { adsgram_task_block_id: 'task', adsgram_interstitial_block_id: 'int', adsgram_reward_block_id: '' };
export function normalizeBlock(key, value) {
  const kind = BLOCK_KINDS[key], raw = String(value ?? '').trim().replace(/\s+/g, '').toLowerCase();
  if (!raw) return '';
  const out = kind && /^\d{1,12}$/.test(raw) ? `${kind}-${raw}` : raw;
  const ok = kind ? new RegExp(`^${kind}-\\d{1,12}$`).test(out) : /^\d{1,12}$/.test(out);
  if (!ok) throw new Err('bad_block');
  return out;
}
export async function setSetting(key, value) {
  if (!Object.hasOwn(G.DEFAULTS, key)) throw new Err('bad_key');
  const d = G.DEFAULTS[key];
  if (value === null || typeof value !== typeof d || Array.isArray(value) !== Array.isArray(d)) throw new Err('bad_type');
  if (typeof d === 'number' && (!Number.isFinite(value) || value < 0)) throw new Err('bad_type');
  if (['gems_per_gram', 'min_withdraw_gram', 'initial_coins', 'initial_plots', 'storage_base', 'storage_per_barn'].includes(key) && value <= 0) throw new Err('bad_type');
  if (key === 'initial_plots' && (!Number.isInteger(value) || value > 18)) throw new Err('bad_type');
  if (['initial_coins', 'storage_base', 'storage_per_barn', 'fertilizer_price', 'water_base', 'water_per_well', 'mission_harvest_target', 'mission_sell_target', 'mission_water_target'].includes(key) && !Number.isInteger(value)) throw new Err('bad_type');
  if (Array.isArray(d) && (!value.length || value.length > 31 || value.some(x => !Number.isInteger(x) || x < 0 || x > 1e7))) throw new Err('bad_type');
  if (d && typeof d === 'object' && !Array.isArray(d)) {
    if (Object.keys(value).some(k => !/^\d+$/.test(k) || Number(k) < 2 || Number(k) > 50 || !Number.isInteger(value[k]) || value[k] < 0 || value[k] > 1e7)) throw new Err('bad_type');
  }
  if (['ref_gems', 'ref_bonus', 'mission_harvest_gems', 'mission_sell_gems', 'mission_water_gems'].includes(key) && !Number.isInteger(value)) throw new Err('bad_type');
  if (key === 'withdraw_min_castle' && (!Number.isInteger(value) || value < 1 || value > 50)) throw new Err('bad_type');
  if (['water_speed_percent', 'fertilizer_speed_percent', 'ad_speed_percent'].includes(key) && value > 60) throw new Err('bad_type');
  if (['levelup_gems', 'levelup_gems_step', 'harvest_gem_amount', 'order_gems', 'order_all_bonus_gems', 'missions_all_bonus_gems', 'lumber_unlock_level', 'lumber_farm_gap', 'lumber_base_minutes', 'lumber_min_minutes', 'lumber_minutes_per_level',
    'lumber_logs_base', 'lumber_logs_per_level', 'lumber_log_price', 'lumber_gems_base', 'lumber_upgrade_base', 'adsgram_task_reward_gems', 'ad_reward_gems', 'ad_reward_coins', 'ad_min_seconds', 'ad_cooldown_seconds', 'ad_daily_cap', 'ad_interstitial_cooldown'].includes(key)
    && (!Number.isInteger(value) || value > 1e7)) throw new Err('bad_type');
  if (key === 'harvest_gem_chance' && value > 100) throw new Err('bad_type');
  if (['lumber_base_minutes', 'lumber_min_minutes', 'lumber_upgrade_base', 'lumber_log_price', 'ad_daily_cap', 'ad_min_seconds'].includes(key) && value < 1) throw new Err('bad_type');
  if (key === 'lumber_unlock_level' && (value < 1 || value > 50)) throw new Err('bad_type');
  if (key === 'lumber_upgrade_growth' && (value < 1 || value > 3)) throw new Err('bad_type');
  if (key === 'lumber_gems_per_level' && value > 20) throw new Err('bad_type');
  if (key === 'ad_min_seconds' && value > 120) throw new Err('bad_type');
  if (['ad_cooldown_seconds', 'ad_interstitial_cooldown'].includes(key) && value > 3600) throw new Err('bad_type');
  if (key in BLOCK_KINDS) value = normalizeBlock(key, value);
  W.S[key] = value;
  await db.saveSetting(key, value);
}
export function adminStats() {
  const t = now(), ps = [...W.players.values()];
  return { players: ps.length, farms: ps.length, online: ps.filter(p => t - p.seen < 120000).length,
    active24: ps.filter(p => t - p.seen < 86400000).length, alliances: 0,
    gems: ps.reduce((s, p) => s + p.gems, 0), gram: roundGram(ps.reduce((s, p) => s + p.gram, 0)),
    coins: ps.reduce((s, p) => s + p.farm.coins, 0), harvested: ps.reduce((s, p) => s + p.farm.harvested, 0),
    averageLevel: ps.length ? Math.round(ps.reduce((s, p) => s + p.farm.level, 0) / ps.length * 10) / 10 : 0,
    lumberjacks: ps.filter(p => p.lumber.cycles > 0 || p.lumber.active).length, lumberCycles: ps.reduce((s, p) => s + p.lumber.cycles, 0),
    adsToday: ps.reduce((s, p) => s + (p.ads.day === G.dayKey() ? p.ads.count : 0), 0), adsTotal: ps.reduce((s, p) => s + p.ads.total, 0),
    tasksActive: W.tasks.filter(x => x.active).length, tasksDone: ps.reduce((s, p) => s + Object.keys(p.tasks.done).length, 0) };
}
export function adminFind(q) {
  q = String(q || '').trim().toLowerCase(); if (!q) return [];
  const out = [];
  for (const p of W.players.values()) {
    if (p.tid === q || p.kname.toLowerCase().includes(q) || (p.tg.u || '').toLowerCase() === q.replace('@', '')) {
      out.push({ tid: p.tid, name: p.kname, tg: p.tg.u, level: p.farm.level, score: G.score(p), coins: p.farm.coins,
        harvested: p.farm.harvested, gems: p.gems, gram: p.gram, banned: p.banned, ref: p.ref, refs: p.refs, earned: p.gemsEarned, lumber: p.lumber.level, cycles: p.lumber.cycles, ads: p.ads.total });
      if (out.length >= 20) break;
    }
  }
  return out;
}
export function adminAdjust(tid, { gems = 0, gram = 0 }) {
  const p = W.players.get(String(tid)); if (!p) throw new Err('not_found', 404);
  gems = Math.trunc(Number(gems) || 0); gram = Number(gram) || 0;
  if (p.gems + gems < 0 || p.gram + gram < -1e-9) throw new Err('negative');
  if (gems) { p.gems += gems; W.ledgerQ.push({ tid: p.tid, delta: gems, kind: 'admin', ref: null }); }
  if (gram) p.gram = roundGram(p.gram + gram);
  mut(p);
}
export function adminBan(tid, banned) { const p = W.players.get(String(tid)); if (!p) throw new Err('not_found', 404); p.banned = !!banned; mut(p); }
