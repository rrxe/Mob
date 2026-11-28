import { L } from './i18n.js';
import { audio, play, unlock, startMusic, stopMusic, setSfx, setScene } from './audio.js';
import { forestScene, axeTier, TREE_ICON, phase } from './scenes.js';
import { confetti, flyTo, countUp, chipsBurst } from './fx.js';

const tg = window.Telegram?.WebApp;
try { tg?.ready(); tg?.expand(); tg?.setHeaderColor?.('#12271a'); tg?.setBackgroundColor?.('#0a160f'); tg?.disableVerticalSwipes?.(); } catch {}
const qs = new URLSearchParams(location.search);
const initData = tg?.initData || '';
const DEV = qs.get('dev');
const hap = (k = 'light') => { try { tg?.HapticFeedback?.impactOccurred(k); } catch {} };
let lang = localStorage.getItem('lang') || ((tg?.initDataUnsafe?.user?.language_code || 'ar').startsWith('ar') ? 'ar' : 'en');
const t = (k, v = {}) => (L[lang][k] ?? L.en[k] ?? k).replace(/\{(\w+)\}/g, (_, n) => v[n] ?? '');
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => { n = Math.floor(Number(n) || 0); return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'K' : String(n); };
const dur = sec => { sec = Math.max(0, Math.ceil(sec)); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`; };
const CROP_ICONS = { wheat: '🌾', corn: '🌽', carrot: '🥕', tomato: '🍅', strawberry: '🍓', pumpkin: '🎃', watermelon: '🍉', pineapple: '🍍' };
const BUILDING_ICONS = { land: '🧑‍🌾', barn: '🏚️', well: '💧', greenhouse: '🏡' };
let motionEnabled = localStorage.getItem('gv_motion') !== '0';
const bootProgress = (value, label) => { const bar = $('#bootProgress'), pct = $('#bootPercent'), status = $('#bootStatus'), w = $('#bootWalker'); const v = Math.max(0, Math.min(100, value)); if (bar) bar.style.width = v + '%'; if (w?.style) w.style.insetInlineStart = Math.max(4, v) + '%'; if (pct) pct.textContent = String(Math.round(v)).padStart(2, '0') + '%'; if (status && label) status.textContent = label; };
const bootAt0 = Date.now();
const playTone = play;
function effectPoint(el) { try { const r = el?.getBoundingClientRect?.(); if (r) return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; } catch {} return { x: innerWidth / 2, y: innerHeight * .52 }; }
function rewardBurst(point, label = '✨', kind = 'reward') {
  const layer = $('#fx-layer'); if (!layer || !motionEnabled) return;
  const burst = document.createElement('div'); burst.className = 'fx-burst ' + kind; burst.style.left = (point?.x ?? innerWidth / 2) + 'px'; burst.style.top = (point?.y ?? innerHeight / 2) + 'px';
  const symbols = kind === 'wood' ? ['🪵','✦','🍃','✧','🪓','✦'] : kind === 'harvest' ? ['🌿','✦','🍃','✧','🌾','✦'] : kind === 'gems' ? ['💎','✦','✧','💠','✨','✦'] : ['✨','✦','🍃','✧','✦','🌱'];
  burst.innerHTML = `<b class="fx-label">${esc(label)}</b>` + symbols.map((x,i) => `<i style="--i:${i};--dx:${Math.cos(i * 1.047) * (42 + i % 2 * 18)}px;--dy:${Math.sin(i * 1.047) * (42 + i % 2 * 18)}px">${x}</i>`).join('');
  layer.appendChild(burst); setTimeout(() => burst.remove(), 1050);
}
function celebrate(level, gems) {
  const box = $('#celebrate'); if (!box) return;
  box.innerHTML = `<div class="cel-card"><div class="cel-glow"></div><div class="cel-badge"><span>🌿</span><b>${level}</b></div><h2>${t('level_up')}</h2><p>${t('farm_level')} ${level}</p>${gems > 0 ? `<div class="cel-gems">+${gems} 💎</div>` : ''}<small>${t('tap_continue')}</small></div>`;
  box.hidden = false; play('level'); hap('heavy');
  confetti($('#fx-layer'), innerWidth / 2, innerHeight * .4, 46);
  clearTimeout(celebrate.t); celebrate.t = setTimeout(() => { box.hidden = true; }, 3400);
}
const levelGemsBetween = (a, b) => { const c = S?.cfg?.levelGems || { base: 0, step: 0 }; let n = 0; for (let l = a + 1; l <= b; l++) n += c.base + (c.step > 0 ? Math.floor(l / c.step) : 0); return n; };
function farmScene() {
  return `<div class="farm-illustration"><img class="farm-landscape" src="/assets/farm-valley.webp" alt="" loading="eager" decoding="async"><div class="scene-vignette"></div><span class="scene-shimmer shimmer-a">✦</span><span class="scene-shimmer shimmer-b">✧</span><span class="scene-bird bird-a">⌁</span><span class="scene-bird bird-b">⌁</span><span class="scene-floating-leaf">🍃</span></div>`;
}

async function api(method, path, body) {
  const headers = { 'content-type': 'application/json' };
  if (initData) headers.authorization = 'tga ' + initData;
  else if (DEV) headers['x-dev-user'] = DEV;
  const r = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let j = {}; try { j = await r.json(); } catch {}
  if (!r.ok) throw Object.assign(new Error(j.error || 'server'), { code: j.error || 'server' });
  return j;
}
const toast = (msg, ms = 2400) => {
  const el = $('#toast'); if (!el) return;
  el.textContent = msg; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, ms);
};
const errMsg = e => t('e_' + (e.code || 'server'));
let S = null, off = 0, tab = 'farm', busy = false, lastSig = '';
const U = { tt: 'quests', more: 'invite', wd: null, lb: null, plot: 0 };
const serverNow = () => Date.now() + off;

async function refresh(force = false) {
  if (busy && !force) return;
  const firstLoad = !S; busy = true;
  if (firstLoad) bootProgress(24, t('loading_connect'));
  try {
    S = await api('GET', '/api/me');
    off = S.now ? S.now - Date.now() : 0;
    if (firstLoad) bootProgress(86, t('loading_world'));
    // skip the re-render when nothing visible changed (keeps animations and the ad widget from restarting every poll)
    const sig = JSON.stringify(S, (k, v) => (k === 'now' || k === 'online' || k === 'remaining' || k === 'cooldown' ? undefined : v));
    if (firstLoad || force || sig !== lastSig) { lastSig = sig; render(); } else computeDue();
  } catch (e) {
    if (e.code === 'auth') $('#boot').innerHTML = `<div style="padding:28px;text-align:center">${esc(errMsg(e))}</div>`;
    else toast(errMsg(e));
  } finally { busy = false; }
}
async function act(fn, okMsg) {
  const oldLevel = S?.farm?.level || 0;
  try {
    const r = await fn(); hap();
    if (okMsg) toast(typeof okMsg === 'function' ? okMsg(r) : okMsg);
    if (tab === 'wallet') U.wd = null;
    if (tab === 'more' && U.more === 'leaderboard') U.lb = null;
    await refresh(true);
    if (oldLevel && S?.farm?.level > oldLevel) celebrate(S.farm.level, levelGemsBetween(oldLevel, S.farm.level));
    if (tab === 'wallet') loadWithdrawals();
    if (tab === 'more' && U.more === 'leaderboard') loadLeaderboard();
    return r;
  } catch (e) { hap('heavy'); play('error'); toast(errMsg(e)); if (e.code === 'no_farm') location.reload(); return null; }
}

// ---------- app shell ----------
function render() {
  const boot = $('#boot'); if (boot && !boot.hidden) { bootProgress(100, t('loading_ready')); const wait = Math.max(0, 1700 - (Date.now() - bootAt0)); setTimeout(() => { boot.classList.add('leaving'); setTimeout(() => { boot.hidden = true; }, 450); }, wait + 250); }
  $('#app').hidden = false; document.body?.classList?.toggle('reduced-motion', !motionEnabled);
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'; document.documentElement.lang = lang;
  if (S.needsName) { $('#top').innerHTML = ''; $('#tabs').innerHTML = ''; $('#view').innerHTML = createView(); return; }
  try { document.documentElement.setAttribute?.('data-tod', phase()); } catch {}
  setScene(tab === 'forest' ? 'forest' : 'farm');
  $('#top').innerHTML = topHtml(); animateBalances();
  $('#tabs').innerHTML = [['farm', '🌿'], ['forest', '🪓'], ['market', '🧺'], ['tasks', '🧭'], ['wallet', '💎'], ['more', '🤝']]
    .map(([k, icon]) => `<button data-act="tab" data-v="${k}" class="${tab === k ? 'on' : ''}"><span class="tab-icon">${icon}</span><small>${t(k)}</small></button>`).join('');
  renderView();
}
function topHtml() {
  return `<div class="topline"><div class="brand-lockup"><div class="brand-mini">G<span>✦</span></div><div class="grow"><div class="farm-title">${esc(S.name)}</div><div class="top-sub">${t('farm_level')} ${S.farm.level} <i class="online-dot"></i> ${S.online} ${t('online')}</div></div></div><button class="lang-chip" data-act="lang" aria-label="Change language">${lang === 'ar' ? 'EN' : 'عربي'}</button></div>
  <div class="top-balances"><div class="balance coin-balance"><span class="balance-icon">🪙</span><span><b id="b-coins">${fmt(S.farm.coins)}</b><small>${t('coins')}</small></span></div><div class="balance gem-balance"><span class="balance-icon">💎</span><span><b id="b-gems">${fmt(S.gems)}</b><small>${t('gems')}</small></span></div><div class="balance gram-balance"><span class="balance-icon">◈</span><span><b>${Number(S.gram).toFixed(3)}</b><small>GRAM</small></span></div></div>`;
}
let prevBal = null;
function animateBalances() {
  const cur = { coins: S.farm.coins, gems: S.gems };
  if (prevBal) {
    if (cur.coins !== prevBal.coins) countUp($('#b-coins'), prevBal.coins, cur.coins, fmt);
    if (cur.gems !== prevBal.gems) { countUp($('#b-gems'), prevBal.gems, cur.gems, fmt); if (cur.gems > prevBal.gems) $('#b-gems')?.classList?.add?.('pop'); setTimeout(() => $('#b-gems')?.classList?.remove?.('pop'), 700); }
  }
  prevBal = cur;
}
let dueAt = Infinity;
function computeDue() {
  const t0 = serverNow(); let m = Infinity;
  for (const p of S.farm.plots) if (p.crop && p.readyAt > t0) m = Math.min(m, p.readyAt);
  if (S.lumber?.active && S.lumber.readyAt > t0) m = Math.min(m, S.lumber.readyAt);
  dueAt = m;
}
function renderView() {
  if (!S || S.needsName) return;
  const v = $('#view');
  v.classList.remove?.('view-enter'); v.innerHTML = tab === 'farm' ? farmView() : tab === 'forest' ? forestView() : tab === 'market' ? marketView() : tab === 'tasks' ? tasksView() : tab === 'wallet' ? walletView() : moreView();
  computeDue(); if (tab === 'tasks' || tab === 'farm') mountAdTask();
  if (motionEnabled) { void v.offsetWidth; v.classList.add('view-enter'); }
  if (tab === 'wallet' && U.wd === null) loadWithdrawals();
  if (tab === 'more' && U.more === 'leaderboard' && U.lb === null) loadLeaderboard();
  updateCountdowns();
}
function createView() {
  return `<div class="welcome-screen"><div class="welcome-art">${farmScene()}<div class="welcome-stamp">✦ GREEN VALLEY ✦</div></div><div class="welcome-copy"><div class="eyebrow">${t('welcome_eyebrow')}</div><h1>${t('create_title')}</h1><p>${t('create_hint')}</p></div>
  <div class="card create-card"><label class="sm muted" for="farmname">${t('farm_name')}</label><input id="farmname" maxlength="18" minlength="3" placeholder="${t('farm_name')}" style="margin:8px 0 12px"><button class="btn full btn-primary" data-act="create"><span>${t('create')}</span><b>→</b></button><div class="create-note">🌱 ${t('welcome_note')}</div></div></div>`;
}

// ---------- farm ----------
function farmView() {
  const f = S.farm, percent = Math.min(100, f.xp / Math.max(1, f.xpNext) * 100);
  const ripe = f.plots.filter(p => p.crop && p.ready).length;
  const totalGrowing = f.plots.filter(p => p.crop && !p.ready).length;
  let h = `<section class="farm-world"><div class="world-art">${farmScene()}</div><div class="world-top"><span class="world-chip">☀️ ${t('sunny_day')}</span><span class="world-chip world-season">✦ ${t('your_haven')}</span></div><div class="world-bottom"><div><div class="world-kicker">${t('hello')}</div><div class="world-title">${esc(S.name)}</div><div class="world-level">${t('farm_level')} ${f.level} <span>✦</span></div></div><div class="level-seal"><span>🌿</span><b>${f.level}</b><small>LVL</small></div></div><div class="world-xp"><div class="world-xp-meta"><span>${t('next_level')}</span><b dir="ltr">${fmt(f.xp)} / ${fmt(f.xpNext)} XP</b></div><div class="hero-progress"><i style="width:${percent}%"></i></div></div></section>`;
  h += `<div class="farm-stat-strip"><div class="farm-stat"><span class="farm-stat-ico">🌾</span><div><b>${fmt(f.harvested)}</b><small>${t('harvested')}</small></div></div><div class="farm-stat"><span class="farm-stat-ico">🌱</span><div><b>${totalGrowing}</b><small>${t('growing_now')}</small></div></div><div class="farm-stat"><span class="farm-stat-ico">📦</span><div><b>${f.inventoryUsed}<small>/${f.inventoryCap}</small></b><small>${t('storage')}</small></div></div></div>`;
  h += homeAd();
  if (ripe) h += `<button class="ready-banner" data-act="jump-ready"><span class="ready-spark">✦</span><span class="ready-banner-copy"><b>${t('harvest_ready', { n: ripe })}</b><small>${t('harvest_ready_hint')}</small></span><span class="ready-arrow">↗</span></button>`;
  h += adsgramCard();
  h += `<section class="section-block" id="fieldSection"><div class="section-heading"><div><div class="eyebrow">${t('your_land')}</div><h2>${t('field')}</h2><p>${t('field_hint')}</p></div><span class="section-count">${f.plots.length} <small>${t('plots')}</small></span></div><div class="plot-grid field-grid">${f.plots.map(plotCard).join('')}</div></section>`;
  h += `<section class="section-block compact-section"><div class="section-heading"><div><div class="eyebrow">${t('farm_care')}</div><h2>${t('daily_supplies')}</h2></div><span class="section-count">✦ ${t('farm_tools')}</span></div><div class="care-panel"><div class="care-item"><span class="care-illustration water-illustration">💧</span><div class="grow"><b>${t('water')}</b><small>${Math.max(0, f.water.cap - f.water.used)} / ${f.water.cap} ${t('water_left')}</small><div class="mini-meter"><i style="width:${Math.max(0, (f.water.cap - f.water.used) / Math.max(1, f.water.cap) * 100)}%"></i></div></div></div><div class="care-divider"></div><div class="care-item"><span class="care-illustration fert-illustration">🧪</span><div class="grow"><b>${t('fertilizer')}</b><small>${f.fertilizer} ${t('units_available')}</small></div><button class="btn btn-small btn-quiet" data-act="fertbuy">＋ ${S.cfg.fertilizerPrice} 🪙</button></div></div></section>`;
  h += `<section class="section-block compact-section"><div class="section-heading"><div><div class="eyebrow">${t('build_and_grow')}</div><h2>${t('buildings')}</h2></div></div><div class="building-grid">${Object.entries(f.buildings).map(([id, lv]) => buildingCard(id, lv, S.buildings?.[id])).join('')}</div></section>`;
  return h;
}
const stageOf = pct => pct < 30 ? 0 : pct < 62 ? 1 : 2;
const stageIcon = (crop, pct) => ['🌱', '🌿', CROP_ICONS[crop] || '🌱'][stageOf(pct)];
const trio = ic => `<b class="c c1">${ic}</b><b class="c c2">${ic}</b><b class="c c3">${ic}</b>`;
function plotCard(p) {
  const id = String(p.id + 1).padStart(2, '0'), idx = `<span class="plot-index">${id}</span>`;
  if (!p.crop) return `<div class="plot empty plot-empty">${idx}<div class="bed bed-empty"><span class="plus">＋</span><i class="seedling">🌱</i></div><div class="crop-name">${t('empty_plot')}</div><button class="btn btn-plant" data-act="plantdlg" data-plot="${p.id}">${t('plant')} <b>＋</b></button></div>`;
  const crop = S.crops[p.crop], icon = CROP_ICONS[p.crop] || '🌱';
  if (p.ready) return `<div class="plot ready plot-ripe">${idx}<div class="ready-glow"></div><div class="bed bed-ripe"><div class="crop-art crop-ready">${trio(icon)}<i>✦</i></div></div><div class="crop-name">${t(p.crop)}</div><div class="plot-status good"><span class="ready-pulse"></span>${t('ready')}</div><button class="btn btn-harvest" data-act="harvest" data-plot="${p.id}">✂ ${t('harvest')} <b>+${crop.yield}</b></button></div>`;
  const total = Math.max(1, p.readyAt - p.plantedAt), elapsed = Math.max(0, serverNow() - p.plantedAt), pct = Math.min(99, elapsed / total * 100);
  return `<div class="plot plot-growing">${idx}<div class="bed"><div class="crop-art crop-growing-art stage-${stageOf(pct)}" data-crop="${p.crop}" data-pstart="${p.plantedAt}" data-pend="${p.readyAt}" data-st="${stageOf(pct)}">${trio(stageIcon(p.crop, pct))}<i>✧</i></div></div><div class="crop-name">${t(p.crop)}</div><div class="growth-meta"><span>${t('growing')}</span><b data-end="${p.readyAt}">${dur(p.remaining)}</b></div><div class="bar growth-bar"><i data-progress="1" data-start="${p.plantedAt}" data-end="${p.readyAt}" style="width:${pct}%"></i></div><div class="plot-actions">${!p.watered ? `<button class="btn care-action" data-act="water" data-plot="${p.id}" ${S.farm.water.used >= S.farm.water.cap ? 'disabled' : ''}>💧</button>` : '<span class="care-done">💧 ✓</span>'}${!p.fertilized ? `<button class="btn care-action" data-act="fertilize" data-plot="${p.id}" ${S.farm.fertilizer < 1 ? 'disabled' : ''}>🧪</button>` : '<span class="care-done">🧪 ✓</span>'}</div></div>`;
}
function buildingCard(id, level, data) {
  const max = !data || level >= data.max;
  return `<div class="building building-tile"><div class="building-top"><span class="building-art ${id}">${BUILDING_ICONS[id]}</span><span class="lv">${t('level')} ${level}<small>/${data?.max || level}</small></span></div><b>${t(id)}</b><div class="building-desc">${id === 'land' ? `+2 ${t('plots')} ${t('with_upgrade')}` : id === 'barn' ? `${t('storage')}: ${S.farm.inventoryCap}` : id === 'well' ? `${t('water_left')}: ${S.farm.water.cap}` : t('greenhouse_desc')}</div>${max || (id === 'land' && S.farm.plots.length >= 18) ? `<div class="building-max">✦ ${t('max_level')}</div>` : `<div class="building-footer"><span class="sm gold">🪙 ${fmt(data.cost)}</span><button class="btn btn-small" data-act="upgrade" data-v="${id}" ${data.canUpgrade ? '' : 'disabled'}>${t('upgrade')} ↗</button></div>`}</div>`;
}

// ---------- market ----------
function marketView() {
  const f = S.farm;
  let h = `<div class="feature-banner market-banner"><div class="feature-copy"><div class="eyebrow">${t('market_title')}</div><h1>${t('market')}</h1><p>${t('market_hint')}</p><span class="feature-foot">${t('storage')} · ${f.inventoryUsed} / ${f.inventoryCap}</span></div><div class="feature-emoji">🧺<i>✦</i><b>🌽</b></div></div>`;
  h += `<section class="section-block"><div class="section-heading"><div><div class="eyebrow">${t('your_goods')}</div><h2>${t('inventory')}</h2></div><span class="value-chip">🪙 ${fmt(inventoryValue())}</span></div><div class="card premium-card">`;
  const items = Object.entries(S.crops).filter(([id]) => f.inventory[id] > 0);
  h += items.length ? items.map(([id, c]) => `<div class="inventory-row"><div class="big">${CROP_ICONS[id]}</div><div class="grow"><b>${t(id)}</b><div class="sm muted">${t('in_stock')}: ${f.inventory[id]} · 🪙 ${c.price}/${t('sell_price')}</div></div><input id="sell_${id}" type="number" min="1" max="${f.inventory[id]}" value="${f.inventory[id]}" inputmode="numeric"><button class="btn sm" data-act="sell" data-crop="${id}">${t('sell')}</button></div>`).join('') : `<div class="empty-state"><div class="big">🧺</div>${t('no_stock')}</div>`;
  h += '</div></section>';
  h += `<section class="section-block"><div class="section-heading"><div><div class="eyebrow">${t('seed_catalog')}</div><h2>🌱 ${t('choose_crop')}</h2></div></div><div class="crop-list">${Object.entries(S.crops).map(([id, c]) => `<div class="crop-card ${c.unlocked ? '' : 'locked'}"><div class="row sp"><span class="crop-icon">${CROP_ICONS[id]}</span><b>${t(id)}</b></div><div class="crop-details"><span>🌰 ${c.seed}</span><span>⏱ ${dur(c.grow)}</span><span>📦 ×${c.yield}</span><span>🪙 ${c.price}</span></div><div class="sm ${c.unlocked ? 'good' : 'muted'}">${c.unlocked ? t('sell_price') + ': ' + c.price : t('unlock_level', { n: c.level })}</div></div>`).join('')}</div></section>`;
  return h;
}
function inventoryValue() { return Object.entries(S.crops).reduce((n, [id, c]) => n + (S.farm.inventory[id] || 0) * c.price, 0); }

// ---------- forest (lumberjack) ----------
const sleep = ms => new Promise(r => setTimeout(r, ms));
function forestView() {
  const l = S.lumber, f = S.farm;
  if (!l.enabled) return `<div class="card empty-state"><div class="big">🪓</div>${t('lumber_off')}</div>`;
  const tree = l.tree, running = l.active && !l.ready, tier = axeTier(l.level);
  let h = `<section class="forest-world" id="forestWorld"><div class="forest-art ${l.unlocked ? '' : 'dim'}" data-act="chop">${forestScene({ tree, active: running, ready: l.ready, logs: l.logs, progress: running ? Math.min(1, (serverNow() - l.startedAt) / Math.max(1, l.readyAt - l.startedAt)) : 0 })}</div>
  <div class="world-top"><span class="world-chip">🪓 ${t('axe_' + tier)}</span><span class="world-chip">${TREE_ICON[tree]} ${t('tree_' + tree)}</span></div>
  ${l.unlocked ? `<div class="forest-hint" id="chopHint">${l.ready ? '✨ ' + t('lumber_ready_hint') : running ? '👆 ' + t('chop_hint') : t('lumber_idle_hint')}</div><div class="chop-combo" id="comboPill" hidden></div>` : ''}
  <div class="world-bottom forest-bottom"><div><div class="world-kicker">${t('lumber_title')}</div><div class="world-title">${t('lumber_level')} ${l.level}<small dir="ltr"> / ${l.max}</small></div></div><div class="level-seal wood-seal"><span>🪵</span><b>${l.level}</b><small>LVL</small></div></div>
  ${l.unlocked ? `<div class="world-xp"><div class="world-xp-meta"><span>${running ? t('lumber_chopping') : l.ready ? t('lumber_done') : t('lumber_waiting')}</span><b ${running ? `data-end="${l.readyAt}" id="lumberTime"` : ''}>${running ? dur((l.readyAt - serverNow()) / 1000) : l.ready ? '✓' : '—'}</b></div><div class="hero-progress wood-progress"><i ${running ? `data-progress="1" data-start="${l.startedAt}" data-end="${l.readyAt}"` : ''} style="width:${l.ready ? 100 : running ? Math.min(100, (serverNow() - l.startedAt) / Math.max(1, l.readyAt - l.startedAt) * 100) : 0}%"></i></div></div>` : ''}</section>`;
  if (!l.unlocked) return h + `<div class="card lock-card"><div class="big">🔒</div><b>${t('lumber_locked', { n: l.unlockLevel })}</b><div class="sm muted">${t('lumber_locked_hint')}</div></div>`;
  const c = l.cur, chips = `<div class="reward-chips"><span>⏱ ${c.minutes >= 60 ? (c.minutes / 60).toFixed(c.minutes % 60 ? 1 : 0) + t('h') : c.minutes + t('min')}</span><span>🪵 ${c.logs}</span><span>💎 ${c.gems}</span><span>✨ ${c.xp} XP</span></div>`;
  if (l.ready) {
    const adOk = l.adDouble && S.ads.enabled && (S.ads.rewardBlock || DEV) && S.ads.used < S.ads.cap && S.ads.cooldown <= 0;
    h += `<div class="card action-card ready-card"><div class="eyebrow">${t('lumber_ready_title')}</div>${chips}<button class="btn btn-harvest full big-btn" data-act="lclaim">🪵 ${t('lumber_claim')} <b>+${c.logs} · 💎${c.gems}</b></button>${l.adDouble && (S.ads.rewardBlock || DEV) ? `<button class="btn ad-btn full" data-act="lclaim2" ${adOk ? '' : 'disabled'}>📺 ${t('lumber_double')} <b>×2</b></button>${adOk ? '' : `<div class="sm muted center-text">${adWhyNot()}</div>`}` : ''}</div>`;
  } else if (l.active) {
    h += `<div class="card action-card"><div class="eyebrow">${t('lumber_running')}</div>${chips}<div class="sm muted center-text">${t('lumber_running_hint')}</div></div>`;
  } else {
    h += `<div class="card action-card"><div class="eyebrow">${t('lumber_next_cycle')}</div>${chips}<button class="btn btn-primary full" data-act="lstart"><span>🪓 ${t('lumber_start')}</span><b>→</b></button></div>`;
  }
  h += `<div class="farm-stat-strip"><div class="farm-stat"><span class="farm-stat-ico">🪵</span><div><b>${fmt(l.logs)}</b><small>${t('logs')}</small></div></div><div class="farm-stat"><span class="farm-stat-ico">🔁</span><div><b>${fmt(l.cycles)}</b><small>${t('cycles')}</small></div></div><div class="farm-stat"><span class="farm-stat-ico">🪙</span><div><b>${l.logPrice}</b><small>${t('per_log')}</small></div></div></div>`;
  h += `<div class="card sell-logs"><div class="row sp"><div><b>${t('sell_logs')}</b><div class="sm muted">${fmt(l.logs)} ${t('logs')} → 🪙 ${fmt(l.logs * l.logPrice)}</div></div><button class="btn" data-act="lsell" ${l.logs ? '' : 'disabled'}>${t('sell_all')}</button></div></div>`;
  const n = l.next;
  h += `<section class="section-block compact-section"><div class="section-heading"><div><div class="eyebrow">${t('axe_upgrade')}</div><h2>${t('axe_' + tier)}</h2></div><span class="section-count">${t('lumber_level')} ${l.level}</span></div>`;
  h += n ? `<div class="card upgrade-card"><div class="cmp-grid">${[['⏱', t('time'), c.minutes + t('min'), n.minutes + t('min')], ['🪵', t('logs'), c.logs, n.logs], ['💎', t('gems'), c.gems, n.gems]].map(([i, lab, a, b]) => `<div class="cmp"><span>${i}</span><small>${lab}</small><b>${a} <i>→</i> <em>${b}</em></b></div>`).join('')}</div><div class="row sp" style="margin-top:12px"><div class="sm ${f.level >= n.needFarm ? 'muted' : 'bad'}">${f.level >= n.needFarm ? '🪙 ' + fmt(n.cost) : t('need_farm_level', { n: n.needFarm })}</div><button class="btn" data-act="lupgrade" ${n.canUpgrade ? '' : 'disabled'}>${t('upgrade')} ↗ · 🪙 ${fmt(n.cost)}</button></div></div>` : `<div class="card"><div class="building-max">✦ ${t('max_level')}</div></div>`;
  const nodes = []; for (let i = 1; i <= l.max; i++) nodes.push(`<div class="lv-chip ${i < l.level ? 'done' : i === l.level ? 'now' : ''}"><span>${i % 5 === 1 ? TREE_ICON[i >= 22 ? 'redwood' : i >= 16 ? 'maple' : i >= 10 ? 'birch' : i >= 5 ? 'pine' : 'oak'] : '🪵'}</span><b>${i}</b></div>`);
  h += `<div class="lv-road"><div class="lv-track">${nodes.join('')}</div></div></section>`;
  return h;
}
function adWhyNot() {
  const a = S.ads;
  if (!a.rewardBlock && !DEV) return t('ads_not_ready');
  if (a.used >= a.cap) return t('ad_cap_hint');
  if (a.cooldown > 0) return `${t('ad_wait')} <b data-end="${serverNow() + a.cooldown * 1000}">${dur(a.cooldown)}</b>`;
  return '';
}
async function lumberClaim(el, double) {
  const point = effectPoint(el);
  try {
    if (double) await runRewarded('lumber');
    const r = await api('POST', '/api/lumber/claim', { double });
    hap('heavy'); $('.forest-svg')?.classList?.add('is-felling'); play('fall');
    rewardBurst(point, `+${r.logs} 🪵`, 'harvest'); if (r.gems) setTimeout(() => { rewardBurst({ x: point.x, y: point.y - 44 }, `+${r.gems} 💎`, 'gems'); flyTo($('#fx-layer'), point, $('#b-gems'), '💎', Math.min(6, r.gems + 2)); play('gem'); }, 380);
    if (r.doubled) confetti($('#fx-layer'), point.x, point.y, 24);
    await sleep(motionEnabled ? 950 : 0);
    toast(t('lumber_got', { l: r.logs, g: r.gems }), 3000);
    await refresh(true);
    if (r.levels) celebrate(S.farm.level, 0);
  } catch (e) { hap('heavy'); play('error'); toast(errMsg(e)); }
}
let combo = 0, comboTimer = 0, chopCount = 0;
function chop(el, ev) {
  const art = $('.forest-art'); if (!S?.lumber?.unlocked) return;
  const p = ev && Number.isFinite(ev.clientX) ? { x: ev.clientX, y: ev.clientY } : effectPoint(el);
  play('chop'); hap('light');
  if (motionEnabled) { art?.classList?.remove('hit'); void art?.offsetWidth; art?.classList?.add('hit'); chipsBurst($('#fx-layer'), p.x, p.y); }
  combo++; chopCount++; clearTimeout(comboTimer); comboTimer = setTimeout(() => { combo = 0; const c = $('#comboPill'); if (c) c.hidden = true; }, 1600);
  const pill = $('#comboPill'); if (pill && combo > 1) { pill.hidden = false; pill.textContent = `🪓 ×${combo}`; }
  if (chopCount % 20 === 0) { rewardBurst(p, '🪵', 'harvest'); play('coin'); }
}

// ---------- ads (AdsGram) ----------
let adBusy = false, lastInt = Number(localStorage.getItem('gv_lastint') || 0);
const bootAt = Date.now();
async function adsSdk() { for (let i = 0; i < 20 && !window.Adsgram?.init; i++) await sleep(150); return window.Adsgram?.init ? window.Adsgram : null; }
function demoAd(seconds) { // DEV only: stands in for the real ad so the full reward flow can be tested outside Telegram
  return new Promise(res => {
    let left = seconds; openSheet(`<div class="demo-ad"><div class="big">📺</div><h2>Demo ad</h2><p>(dev mode)</p><b id="demoLeft">${left}</b></div>`);
    const iv = setInterval(() => { left--; const e = $('#demoLeft'); if (e) e.textContent = left; if (left <= 0) { clearInterval(iv); closeSheet(); res(true); } }, 1000);
  });
}
// Shows an AdsGram block. needClick: the player must click the ad (open its link), stay away >= 2.5 s and come back (ported from Thekiller).
async function showAdsgram(blockId, needClick) {
  const sdk = await adsSdk(); if (!sdk) return 'unavailable';
  const ctl = sdk.init({ blockId, debug: false }), wa = tg, undo = [];
  let leftEver = false, away = 0, awayStart = null, clickAt = 0, started = false, closed = false, done = false;
  const mark = () => { if (!clickAt) clickAt = Date.now(); };
  const leave = () => { leftEver = true; if (awayStart === null) awayStart = Date.now(); };
  const back = () => { if (awayStart !== null) { away += Date.now() - awayStart; awayStart = null; } };
  const onVis = () => (document.visibilityState === 'hidden' ? leave() : back());
  const onBlur = () => setTimeout(() => { if (document.hasFocus()) { leave(); back(); } else leave(); }, 350);
  const onFocus = () => { if (document.visibilityState !== 'hidden') back(); };
  const wrap = (o, k) => { try { const f = o?.[k]; if (typeof f !== 'function') return; o[k] = function (...x) { mark(); return f.apply(this, x); }; undo.push(() => { o[k] = f; }); } catch {} };
  document.addEventListener('visibilitychange', onVis); window.addEventListener('blur', onBlur); window.addEventListener('focus', onFocus); window.addEventListener('pagehide', leave);
  wrap(wa, 'openLink'); wrap(wa, 'openTelegramLink'); wrap(window, 'open');
  try { wa?.onEvent?.('deactivated', leave); wa?.onEvent?.('activated', back); } catch {}
  const cleanup = () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('blur', onBlur); window.removeEventListener('focus', onFocus); window.removeEventListener('pagehide', leave); undo.forEach(f => f()); try { wa?.offEvent?.('deactivated', leave); wa?.offEvent?.('activated', back); } catch {} };
  try {
    const on = (ev, cb) => { try { ctl.addEventListener?.(ev, cb); } catch {} };
    on('onStart', () => { started = true; }); on('onComplete', () => { closed = true; done = true; }); on('onSkip', () => { closed = true; });
    on('onBannerNotFound', () => { closed = true; }); on('onError', () => { closed = true; });
    const shown = Promise.resolve(ctl.show()).then(r => { if (r?.done) done = true; }, () => {}).then(() => { closed = true; });
    const t0 = Date.now();
    while (!started && !closed && Date.now() - t0 < 15000) await sleep(150);
    if (!started && closed && Date.now() - t0 < 1500) return 'unavailable';
    if (!needClick) { await Promise.race([shown, sleep(60000)]); return done || Date.now() - t0 > 4000 ? 'ok' : 'short'; }
    const end = Date.now() + 15000; let closedAt = 0;
    while (Date.now() < end) { if (awayStart !== null || leftEver || clickAt) break; if (closed) { closedAt ||= Date.now(); if (Date.now() - closedAt > 1500) break; } await sleep(200); }
    if (!(awayStart !== null || leftEver || clickAt)) { await Promise.race([shown, sleep(20000)]); return 'no_click'; }
    const wait0 = Date.now(); while (awayStart !== null && Date.now() - wait0 < 120000) { if (document.visibilityState !== 'hidden' && document.hasFocus()) back(); await sleep(300); }
    if (awayStart !== null) back();
    return away >= 2500 ? 'ok' : 'short';
  } finally { cleanup(); }
}
async function runRewarded(kind) {
  if (adBusy) throw Object.assign(new Error('busy'), { code: 'busy' });
  adBusy = true;
  try {
    const prep = await api('POST', '/api/ad/prepare', { kind });
    const a = S.ads, block = a.rewardBlock || a.intBlock; let res;
    play('ad');
    if (block && await adsSdk()) res = await showAdsgram(block, !!a.clickRequired && !a.rewardBlock);
    else if (DEV) res = (await demoAd(prep.minSeconds + 1)) ? 'ok' : 'short';
    else throw Object.assign(new Error('no_ads'), { code: 'no_ads' });
    if (res === 'unavailable') throw Object.assign(new Error('no_ads'), { code: 'no_ads' });
    if (res === 'no_click') throw Object.assign(new Error('ad_noclick'), { code: 'ad_noclick' });
    if (res !== 'ok') throw Object.assign(new Error('ad_short'), { code: 'ad_short' });
    return await api('POST', '/api/ad/confirm', { id: prep.id });
  } finally { adBusy = false; }
}
async function maybeInterstitial() {
  const a = S?.ads;
  if (!a || !a.enabled || !a.intBlock || !a.intCooldown || adBusy) return;
  if (Date.now() - bootAt < 45000 || Date.now() - lastInt < a.intCooldown * 1000) return;
  const sdk = window.Adsgram?.init ? window.Adsgram : null; if (!sdk) return;
  adBusy = true; lastInt = Date.now(); try { localStorage.setItem('gv_lastint', String(lastInt)); } catch {}
  try { await sdk.init({ blockId: a.intBlock, debug: false }).show(); } catch {} finally { adBusy = false; }
}
let adTaskNode = null, adTaskBlock = '', nativeBusy = false;
function mountAdTask() {
  const slot = $('#adTaskSlot'), block = S?.ads?.taskBlock;
  if (!slot || !slot.appendChild || !block || !S.ads.enabled || typeof document.createElement !== 'function') return;
  if (!adTaskNode || adTaskBlock !== block) {
    adTaskBlock = block; adTaskNode = document.createElement('adsgram-task');
    adTaskNode.setAttribute('data-block-id', block); adTaskNode.setAttribute('data-debug', 'false'); adTaskNode.className = 'at-widget';
    adTaskNode.innerHTML = `<span slot="reward" class="at-reward" dir="ltr">+${S.ads.taskGems} 💎</span><div slot="button" class="at-btn">${t('ad_open')}</div><div slot="claim" class="at-btn is-claim">${t('claim')}</div><div slot="done" class="at-btn is-done">${t('task_done')}</div>`;
    adTaskNode.addEventListener('reward', () => claimNative(0));
    adTaskNode.addEventListener('onBannerNotFound', () => { const c = $('#adTaskCard'); if (c) c.hidden = true; });
    const css = ':host{display:block;width:100%;max-width:100%}*{min-width:0;box-sizing:border-box}[class*="title" i],[class*="name" i],[class*="text" i],[class*="desc" i]{white-space:normal!important;overflow-wrap:anywhere;line-height:1.35}';
    let tries = 0; const iv = setInterval(() => { const r = adTaskNode.shadowRoot; if (r && !r.querySelector('style[data-gv]')) { const st = document.createElement('style'); st.setAttribute('data-gv', ''); st.textContent = css; r.appendChild(st); clearInterval(iv); } if (++tries > 40) clearInterval(iv); }, 400);
  }
  slot.appendChild(adTaskNode);
}
async function claimNative(attempt) {
  if (attempt === 0) { if (nativeBusy) return; nativeBusy = true; }
  try {
    const r = await api('POST', '/api/adsgram/claim');
    if (r.pending === false) { nativeBusy = false; play('gem'); hap('medium'); toast(t('ad_task_got', { n: r.gems })); rewardBurst({ x: innerWidth / 2, y: innerHeight * .5 }, `+${r.gems} 💎`, 'gems'); await refresh(true); return; }
  } catch (e) { if (['ad_cap', 'ads_off'].includes(e.code)) { nativeBusy = false; toast(errMsg(e)); return; } }
  if (attempt >= 15) { nativeBusy = false; return; }
  setTimeout(() => claimNative(attempt + 1), 2000);
}
function openLink(url) {
  try { if (/^https:\/\/t\.me\//i.test(url) && tg?.openTelegramLink) return tg.openTelegramLink(url); if (tg?.openLink) return tg.openLink(url); } catch {}
  window.open(url, '_blank');
}

// ---------- tasks ----------
function homeAd() {
  const a = S.ads; if (!a.enabled || (!a.intBlock && !a.rewardBlock && !DEV)) return '';
  const left = a.cap - a.used, off = left <= 0 || a.cooldown > 0, pct = Math.min(100, a.used / Math.max(1, a.cap) * 100);
  const sub = left <= 0 ? t('ad_cap_hint') : a.cooldown > 0 ? `${t('ad_wait')} <b data-end="${serverNow() + a.cooldown * 1000}">${dur(a.cooldown)}</b>` : a.clickRequired ? t('ad_click_hint') : t('ad_watch_hint');
  return `<button class="home-ad ${off ? 'is-off' : ''}" data-act="adreward" data-kind="gems" ${off ? 'disabled' : ''}><span class="ha-top"><span class="ha-ico">📺</span><span class="ha-txt"><b>${t('watch_earn')}</b><small>${sub}</small></span><span class="ha-rew" dir="ltr">+${a.gems} 💎</span></span><span class="ha-prog"><i style="width:${pct}%"></i></span><span class="ha-count">${a.used}/${a.cap} ${t('today')}</span></button>`;
}
function adsgramCard() {
  const a = S.ads; if (!a.enabled || !a.taskBlock) return '';
  return `<div class="card adsgram-card" id="adTaskCard"><div class="row sp"><div><div class="eyebrow">${t('sponsor')}</div><h3>🎯 ${t('ad_tasks')}</h3></div><span class="reward-pill">💎 ${a.taskGems}</span></div><div class="sm muted" style="margin-bottom:8px">${t('ad_tasks_hint')}</div><div id="adTaskSlot"></div></div>`;
}
function earnCenter() {
  const a = S.ads; if (!a.enabled || (!a.rewardBlock && !DEV)) return '';
  const left = a.cap - a.used, ready = !!a.rewardBlock || !!DEV;
  const dis = !ready || left <= 0 || a.cooldown > 0 ? 'disabled' : '';
  const opts = [['gems', '💎', `+${a.gems}`, t('gems')], ['coins', '🪙', `+${a.coins}`, t('coins')], ['water', '💧', '', t('ad_water')], ['speed', '⚡', `−${a.speedPct}%`, t('ad_speed')]];
  return `<div class="card earn-card"><div class="row sp"><div><div class="eyebrow">${t('earn_more')}</div><h3>📺 ${t('earn_center')}</h3></div><span class="streak-pill">${a.used}/${a.cap}</span></div><div class="sm muted" style="margin-bottom:10px">${t('earn_hint')}</div>
  <div class="earn-grid">${opts.map(([k, i, v, lab]) => `<button class="earn-opt" data-act="adreward" data-kind="${k}" ${dis}><span>${i}</span><b>${v}</b><small>${lab}</small></button>`).join('')}</div>
  ${!ready ? `<div class="sm muted center-text" style="margin-top:9px">${t('ads_not_ready')}</div>` : left <= 0 ? `<div class="sm muted center-text" style="margin-top:9px">${t('ad_cap_hint')}</div>` : a.cooldown > 0 ? `<div class="sm muted center-text" style="margin-top:9px">${t('ad_wait')} <b data-end="${serverNow() + a.cooldown * 1000}">${dur(a.cooldown)}</b></div>` : ''}</div>`;
}
function taskRow(x) {
  const title = lang === 'ar' ? x.title_ar : x.title_en, auto = ['invite', 'level', 'harvest', 'lumber'].includes(x.type);
  const rw = [x.gems ? `💎 ${x.gems}` : '', x.coins ? `🪙 ${x.coins}` : ''].filter(Boolean).join(' · '), url = x.url || (x.chat?.startsWith('@') ? 'https://t.me/' + x.chat.slice(1) : '');
  let right = '';
  if (x.done) right = `<span class="task-done">✓ ${x.repeat === 'daily' ? t('done_today') : t('delivered')}</span>`;
  else if (auto) right = `<button class="btn sm" data-act="taskclaim" data-v="${esc(x.id)}" ${x.ready ? '' : 'disabled'}>${t('claim_reward')}</button>`;
  else if (x.type === 'link') right = x.started ? `<button class="btn sm" data-act="taskclaim" data-v="${esc(x.id)}">${t('claim_reward')}</button>` : `<button class="btn sm btn-quiet" data-act="taskopen" data-v="${esc(x.id)}">${t('open')} ↗</button>`;
  else if (x.type === 'channel') right = `${url ? `<button class="btn sm btn-quiet" data-act="taskopen" data-v="${esc(x.id)}">${t('join')}</button>` : ''}<button class="btn sm" data-act="taskclaim" data-v="${esc(x.id)}">${t('verify')}</button>`;
  const prog = auto && !x.done ? `<div class="progress"><i style="width:${Math.min(100, x.progress / x.target * 100)}%"></i></div><div class="sm muted">${fmt(x.progress)}/${fmt(x.target)} · ${rw}</div>` : `<div class="sm muted">${rw}${x.repeat === 'daily' ? ' · ' + t('daily_tag') : ''}</div>`;
  return `<div class="mission-row task-row ${x.done ? 'is-done' : ''}"><div class="task-ico">${esc(x.icon)}</div><div class="grow"><b>${esc(title)}</b>${prog}</div><div class="task-actions">${right}</div></div>`;
}
function tasksView() {
  const d = S.daily;
  const openQ = S.tasks.filter(x => !x.done).length;
  let h = `<div class="seg task-seg"><button data-act="tasksub" data-v="quests" class="${U.tt === 'quests' ? 'on' : ''}">⭐ ${t('quests_tab')}${openQ ? ` <i class="dot">${openQ}</i>` : ''}</button><button data-act="tasksub" data-v="daily" class="${U.tt === 'daily' ? 'on' : ''}">📅 ${t('daily_tab')}</button></div>`;
  if (U.tt === 'quests') {
    h += earnCenter() + adsgramCard();
    h += S.tasks.length ? `<div class="card task-card"><div class="row sp"><div><div class="eyebrow">${t('special_tasks')}</div><h3>⭐ ${t('quests')}</h3></div><span class="section-count">${S.tasks.filter(x => x.done).length}/${S.tasks.length}</span></div>${S.tasks.map(taskRow).join('')}</div>` : `<div class="card empty-state"><div class="big">⭐</div>${t('no_quests')}</div>`;
    return h;
  }
  h += `<div class="card daily-card"><div class="row sp"><div><div class="eyebrow">${t('come_back_gift')}</div><h3>🎁 ${t('daily_title')}</h3></div><span class="streak-pill">🔥 ${d.streak} ${t('streak')}</span></div><div class="days">${d.days.map((g, i) => { const n = d.days.length, next = (d.streak) % n, completed = d.can ? next : (d.streak - 1) % n + 1; return `<div class="day ${i < completed ? 'done' : (d.can && i === next) ? 'now' : ''}">${i + 1}<br>💎${g}</div>`; }).join('')}</div><button class="btn full" data-act="daily" ${d.can ? '' : 'disabled'}>${d.can ? `${t('claim')} · 💎 ${d.reward}` : t('claimed_today')}</button></div>`;
  h += `<div class="card mission-card"><div class="row sp"><div><div class="eyebrow">${t('small_goals')}</div><h3>✅ ${t('missions')}</h3></div><span class="reward-pill">💎 ${S.missions.reduce((n, x) => n + (x.claimed ? 0 : x.gems), 0)}</span></div>`;
  h += S.missions.map(m => {
    const title = m.id === 'harvest' ? t('harvest_mission', { n: m.target }) : m.id === 'sell' ? t('sell_mission', { n: m.target }) : t('water_mission', { n: m.target });
    const pct = Math.min(100, m.progress / m.target * 100), can = m.progress >= m.target && !m.claimed;
    return `<div class="mission-row"><div class="grow"><b>${title}</b><div class="progress"><i style="width:${pct}%"></i></div><div class="sm muted">${m.progress}/${m.target} · 💎 ${m.gems} · 🪙 ${m.coins}</div></div><button class="btn sm" data-act="mission" data-v="${m.id}" ${can ? '' : 'disabled'}>${m.claimed ? '✓ ' + t('completed') : t('claim_reward')}</button></div>`;
  }).join('') + '</div>';
  h += `<div class="card order-card"><div class="row sp"><div><div class="eyebrow">${t('town_market')}</div><h3>📋 ${t('orders')}</h3></div><span class="section-count">${S.orders.filter(x => x.done).length}/3</span></div><div class="sm muted" style="margin-bottom:6px">${t('orders_hint')}</div>`;
  h += S.orders.map(o => `<div class="order-row"><div class="big">${CROP_ICONS[o.crop]}</div><div class="grow"><b>${t(o.crop)} × ${o.qty}</b><div class="sm muted">${t('order_reward')}: 🪙 ${o.reward} · ✨ ${o.xp} XP${S.cfg.orderGems ? ' · 💎 ' + S.cfg.orderGems : ''}</div></div><button class="btn sm" data-act="order" data-v="${esc(o.id)}" ${o.done || S.farm.inventory[o.crop] < o.qty ? 'disabled' : ''}>${o.done ? '✓ ' + t('delivered') : t('fulfill')}</button></div>`).join('') + '</div>';
  return h;
}

// ---------- wallet ----------
function walletView() {
  return `<div class="wallet-hero"><div class="wallet-orbit orbit-one"></div><div class="wallet-orbit orbit-two"></div><div class="wallet-hero-top"><span>✦ ${t('wallet_title')}</span><span class="wallet-gem-mark">💎</span></div><div class="wallet-balance-label">${t('available_balance')}</div><div class="wallet-gem-total">${fmt(S.gems)} <small>GEMS</small></div><div class="wallet-gram-row"><span>◈ ${Number(S.gram).toFixed(4)} GRAM</span><i>${t('ready_to_convert')}</i></div></div>
  <div class="card wallet-card"><div class="wallet-section-head"><span class="wallet-icon-box">⇄</span><div><h3>${t('exchange')}</h3><small>${t('exchange_hint')}</small></div></div><div class="sm muted" style="margin-bottom:8px">${t('rate', { n: S.cfg.gemsPerGram })}</div><div class="row"><input id="exchangeAmount" type="number" min="1" max="${S.gems}" placeholder="${t('gems_amount')}" inputmode="numeric"><button class="btn" data-act="exchange">${t('convert')}</button></div><div class="sm muted" id="exchangePreview" style="margin-top:7px"></div></div>
  <div class="card wallet-card"><div class="wallet-section-head"><span class="wallet-icon-box gram-icon">◈</span><div><h3>${t('withdraw')}</h3><small>${t('withdraw_subtitle')}</small></div></div><div class="sm muted" style="margin-bottom:9px">${t('wd_note', { c: S.cfg.wdLevel, m: S.cfg.minWithdrawGram })}</div><input id="withdrawAmount" type="number" min="${S.cfg.minWithdrawGram}" step="0.000001" placeholder="${t('wd_amount')}" inputmode="decimal"><input id="withdrawAddress" style="margin-top:8px" placeholder="${t('wd_addr')}" dir="ltr" autocomplete="off"><button class="btn full" style="margin-top:9px" data-act="withdraw">${t('wd_btn')}</button></div>
  <div class="card wallet-card"><h3>🧾 ${t('history')}</h3><div class="list" id="withdrawHistory">…</div></div>`;
}
async function loadWithdrawals() {
  try { U.wd = (await api('GET', '/api/withdrawals')).list; }
  catch { U.wd = []; }
  if (tab === 'wallet') {
    const box = $('#withdrawHistory'); if (box) box.innerHTML = U.wd.length ? U.wd.map(w => `<div><span>◈ ${Number(w.gram).toFixed(4)} GRAM<br><span class="sm muted">${new Date(w.t).toLocaleDateString()}</span></span><b class="${w.status === 'paid' ? 'good' : w.status === 'rejected' ? 'bad' : 'gold'}">${t(w.status)}</b></div>`).join('') : `<div class="muted">${t('no')}</div>`;
  }
}

// ---------- more ----------
function moreView() {
  let h = `<div class="seg">${[['invite', '👥 ' + t('invite')], ['leaderboard', '🏆 ' + t('leaderboard')], ['settings', '⚙️ ' + t('settings')]].map(([k, name]) => `<button data-act="moresub" data-v="${k}" class="${U.more === k ? 'on' : ''}">${name}</button>`).join('')}</div>`;
  if (U.more === 'invite') {
    const r = S.refs;
    h += `<div class="card"><h3>👥 ${t('invite')}</h3><div class="sm muted">${t('invite_hint', { r: r.reward, b: r.bonus })}</div><input readonly value="${esc(r.link)}" dir="ltr" style="margin:12px 0"><div class="row"><button class="btn grow" data-act="share">${t('share')}</button><button class="btn sec" data-act="copy">${t('copy')}</button></div><div class="stats-grid" style="margin-top:12px"><div class="stat"><b>${r.count}</b><small>${t('invited')}</small></div><div class="stat"><b>💎 ${r.earn}</b><small>${t('earned')}</small></div><div class="stat"><b>${r.reward}</b><small>${t('gems')}</small></div></div></div>`;
    h += `<div class="card"><div class="list">${r.list.map(x => `<div><span>${esc(x.n)}</span><span class="sm ${x.paid ? 'good' : 'muted'}">${t('farm_level')} ${x.level} ${x.paid ? '✓' : ''}</span></div>`).join('') || `<div class="muted">${t('no')}</div>`}</div></div>`;
  } else if (U.more === 'leaderboard') {
    h += `<div class="card"><h3>🏆 ${t('leaderboard')}</h3><div class="list" id="leaderboardRows">…</div></div>`;
  } else {
    h += `<div class="settings-panel"><div class="settings-row"><span class="settings-icon">🌐</span><div class="grow"><b>${t('language')}</b><small>${t('language_hint')}</small></div><button class="btn btn-small btn-quiet" data-act="lang">${lang === 'ar' ? 'English' : 'العربية'}</button></div><div class="settings-row"><span class="settings-icon">🔔</span><div class="grow"><b>${t('sound_effects')}</b><small>${t('sound_hint')}</small></div><button class="toggle-pill ${audio.sfx ? 'active' : ''}" data-act="sound" aria-pressed="${audio.sfx}"><i></i><span>${audio.sfx ? t('on') : t('off')}</span></button></div><div class="settings-row"><span class="settings-icon">🎵</span><div class="grow"><b>${t('music')}</b><small>${t('music_hint')}</small></div><button class="toggle-pill ${audio.music ? 'active' : ''}" data-act="music" aria-pressed="${audio.music}"><i></i><span>${audio.music ? t('on') : t('off')}</span></button></div><div class="settings-row"><span class="settings-icon">✨</span><div class="grow"><b>${t('motion_effects')}</b><small>${t('motion_hint')}</small></div><button class="toggle-pill ${motionEnabled ? 'active' : ''}" data-act="motion" aria-pressed="${motionEnabled}"><i></i><span>${motionEnabled ? t('on') : t('off')}</span></button></div><div class="settings-row"><span class="settings-icon">🟢</span><div class="grow"><b>${t('online')}</b><small>${t('community_presence')}</small></div><b class="good">${S.online}</b></div></div><div class="about-brand"><div class="about-mark">G</div><b>GREEN VALLEY</b><span>GROW AT YOUR OWN PACE</span></div>`;
  }
  return h;
}
async function loadLeaderboard() {
  try { U.lb = await api('GET', '/api/leaderboard'); } catch { U.lb = { players: [] }; }
  if (tab === 'more' && U.more === 'leaderboard') {
    const el = $('#leaderboardRows'); if (el) el.innerHTML = U.lb.players.length ? U.lb.players.map((p, i) => `<div><span><b class="gold">${i + 1}.</b> ${esc(p.n)}<br><span class="sm muted">${fmt(p.harvested)} ${t('harvested')}</span></span><b>🌱 ${p.level}</b></div>`).join('') : `<div class="muted">${t('no')}</div>`;
  }
}

// ---------- sheets and actions ----------
function openSheet(html) { $('#sheet .sheet-body').innerHTML = html; $('#sheet').hidden = false; }
const closeSheet = () => { $('#sheet').hidden = true; };
function plantDialog(index) {
  U.plot = index;
  const crops = Object.entries(S.crops);
  openSheet(`<div class="sheet-handle"></div><div class="sheet-heading"><div class="eyebrow">${t('field')} · ${index + 1}</div><h2>🌱 ${t('choose_crop')}</h2><p>${t('seed_hint')}</p></div><div class="sheet-crops">${crops.map(([id, c]) => `<button class="sheet-crop" data-act="plant" data-plot="${index}" data-crop="${id}" ${!c.unlocked || S.farm.coins < c.seed ? 'disabled' : ''}><div class="row sp"><b><span class="seed-icon">${CROP_ICONS[id]}</span> ${t(id)}</b><span class="gold sm">🪙 ${c.seed}</span></div><div class="sm muted" style="margin-top:8px">⏱ ${dur(c.grow)} · 📦 ×${c.yield}</div>${!c.unlocked ? `<div class="sm muted">${t('unlock_level', { n: c.level })}${c.greenhouse ? ' · ' + t('greenhouse_required', { n: c.greenhouse }) : ''}</div>` : ''}</button>`).join('')}</div><button class="btn sec full" style="margin-top:10px" data-act="close">${t('close')}</button>`);
}
const ACT = {
  tab: el => { tab = el.dataset.v; closeSheet(); render(); $('#view').scrollTop = 0; play('tab'); maybeInterstitial(); },
  'jump-ready': () => { $('#fieldSection')?.scrollIntoView?.({ behavior: motionEnabled ? 'smooth' : 'auto', block: 'start' }); },
  sound: () => { setSfx(!audio.sfx); renderView(); },
  music: () => { audio.music ? stopMusic() : startMusic(); renderView(); },
  chop: (el, ev) => chop(el, ev),
  lstart: el => act(() => api('POST', '/api/lumber/start'), t('lumber_started')).then(r => { if (r) { play('start'); rewardBurst(effectPoint(el), '🪓', 'wood'); } }),
  lclaim: el => lumberClaim(el, false),
  lclaim2: el => lumberClaim(el, true),
  lsell: el => { const point = effectPoint(el); return act(() => api('POST', '/api/lumber/sell', { amount: 'all' }), r => t('sold_msg', { n: r.coins })).then(r => { if (r) { rewardBurst(point, `+${r.coins} 🪙`, 'gems'); flyTo($('#fx-layer'), point, $('#b-coins'), '🪙', 5); play('sell'); } }); },
  lupgrade: el => { const point = effectPoint(el); return act(() => api('POST', '/api/lumber/upgrade'), t('axe_upgraded')).then(r => { if (r) { rewardBurst(point, '🪓 ' + t('axe_upgraded'), 'gems'); confetti($('#fx-layer'), point.x, point.y, 18); play('upgrade'); } }); },
  adreward: async el => {
    const point = effectPoint(el), kind = el.dataset.kind;
    try {
      const r = await runRewarded(kind); hap('medium');
      const msg = kind === 'gems' ? `+${r.gems} 💎` : kind === 'coins' ? `+${r.coins} 🪙` : kind === 'water' ? '💧 ✓' : '⚡ ✓';
      rewardBurst(point, msg, kind === 'gems' ? 'gems' : 'plant'); if (kind === 'gems') { flyTo($('#fx-layer'), point, $('#b-gems'), '💎', 4); play('gem'); } else if (kind === 'coins') { flyTo($('#fx-layer'), point, $('#b-coins'), '🪙', 5); play('coin'); } else play('reward');
      toast(t('ad_done')); await refresh(true);
    } catch (e) { play('error'); toast(errMsg(e)); }
  },
  taskopen: async el => {
    const x = S.tasks.find(v => v.id === el.dataset.v); if (!x) return;
    const url = x.url || (x.chat?.startsWith('@') ? 'https://t.me/' + x.chat.slice(1) : '');
    if (x.type === 'link') { try { await api('POST', '/api/task/start', { id: x.id }); } catch (e) { return toast(errMsg(e)); } }
    if (url) openLink(url);
    if (x.type === 'link') await refresh(true);
  },
  taskclaim: el => { const point = effectPoint(el), x = S.tasks.find(v => v.id === el.dataset.v); return act(() => api('POST', '/api/task/claim', { id: el.dataset.v }), r => t('task_got', { g: r.gems, c: r.coins })).then(r => { if (r) { rewardBurst(point, [r.gems ? `+${r.gems} 💎` : '', r.coins ? `+${r.coins} 🪙` : ''].filter(Boolean).join(' '), 'gems'); if (r.gems) flyTo($('#fx-layer'), point, $('#b-gems'), '💎', 4); play(r.gems ? 'gem' : 'coin'); } }); },
  motion: () => { motionEnabled = !motionEnabled; localStorage.setItem('gv_motion', motionEnabled ? '1' : '0'); document.body?.classList?.toggle('reduced-motion', !motionEnabled); render(); },
  lang: () => { lang = lang === 'ar' ? 'en' : 'ar'; localStorage.setItem('lang', lang); render(); },
  tasksub: el => { U.tt = el.dataset.v; renderView(); play('tab'); },
  celebrate: () => { const b = $('#celebrate'); if (b) b.hidden = true; },
  create: () => act(() => api('POST', '/api/create', { name: $('#farmname').value.trim(), ref: qs.get('ref') || (tg?.initDataUnsafe?.start_param || '').replace('ref_', '') })),
  plantdlg: el => plantDialog(Number(el.dataset.plot)),
  plant: el => { const point = effectPoint(el); return act(() => api('POST', '/api/plant', { plot: Number(el.dataset.plot), crop: el.dataset.crop }), t('planted')).then(r => { if (r) { closeSheet(); rewardBurst(point, t('planted'), 'plant'); playTone('plant'); } }); },
  harvest: el => { const point = effectPoint(el); return act(() => api('POST', '/api/harvest', { plot: Number(el.dataset.plot) }), r => t('harvested_msg', { n: r.amount, crop: t(r.crop) })).then(r => { if (r) { rewardBurst(point, `+${r.amount} ${t(r.crop)}`, 'harvest'); playTone('harvest'); if (r.gem) setTimeout(() => { rewardBurst({ x: point.x, y: point.y - 42 }, `+${r.gem} 💎`, 'gems'); flyTo($('#fx-layer'), point, $('#b-gems'), '💎', 3); play('gem'); }, 300); } }); },
  water: el => { const point = effectPoint(el); return act(() => api('POST', '/api/water', { plot: Number(el.dataset.plot) }), t('watered_msg')).then(r => { if (r) rewardBurst(point, '💧 ' + t('watered'), 'plant'); }); },
  fertilize: el => { const point = effectPoint(el); return act(() => api('POST', '/api/fertilize', { plot: Number(el.dataset.plot) }), t('fertilized_msg')).then(r => { if (r) { rewardBurst(point, '🧪 ' + t('fertilized'), 'plant'); playTone('plant'); } }); },
  fertbuy: () => act(() => api('POST', '/api/fertilizer/buy', { amount: 1 }), t('buy_fertilizer')),
  upgrade: el => { const point = effectPoint(el); return act(() => api('POST', '/api/upgrade', { building: el.dataset.v }), t('upgraded_msg')).then(r => { if (r) { rewardBurst(point, '✦ ' + t('upgraded_msg'), 'gems'); playTone('reward'); } }); },
  sell: el => { const id = el.dataset.crop, amount = Number($('#sell_' + id)?.value || 0), point = effectPoint(el); return act(() => api('POST', '/api/sell', { crop: id, amount }), r => t('sold_msg', { n: r.coins })).then(r => { if (r) { rewardBurst(point, `+${r.coins} 🪙`, 'gems'); playTone('sell'); } }); },
  daily: el => { const point = effectPoint(el); return act(() => api('POST', '/api/daily'), r => t('daily_got', { n: r.gems })).then(r => { if (r) { rewardBurst(point, `+${r.gems} 💎`, 'gems'); playTone('reward'); } }); },
  mission: el => { const point = effectPoint(el); return act(() => api('POST', '/api/mission/claim', { id: el.dataset.v }), r => t('mission_got', { n: r.gems })).then(r => { if (r) { rewardBurst(point, `+${r.gems} 💎`, 'gems'); playTone('reward'); } }); },
  order: el => { const point = effectPoint(el); return act(() => api('POST', '/api/order/fulfill', { id: el.dataset.v }), r => t('order_done_msg', { n: r.coins })).then(r => { if (r) { rewardBurst(point, `+${r.coins} 🪙`, 'gems'); playTone('sell'); } }); },
  exchange: el => { const point = effectPoint(el); return act(() => api('POST', '/api/exchange', { gems: Number($('#exchangeAmount').value) }), r => t('exchange_done', { n: r.gram })).then(r => { if (r) { rewardBurst(point, `+${Number(r.gram).toFixed(4)} GRAM`, 'gems'); playTone('reward'); } }); },
  withdraw: () => act(() => api('POST', '/api/withdraw', { gram: Number($('#withdrawAmount').value), address: $('#withdrawAddress').value.trim() }), t('withdrawal_sent')).then(r => { if (r) U.wd = null; }),
  moresub: el => { U.more = el.dataset.v; U.lb = null; renderView(); },
  copy: async () => { try { await navigator.clipboard.writeText(S.refs.link); toast(t('copied')); } catch { $('#view input[readonly]')?.select(); } },
  share: () => { const url = `https://t.me/share/url?url=${encodeURIComponent(S.refs.link)}&text=${encodeURIComponent('🌱 Green Valley')}`; tg?.openTelegramLink ? tg.openTelegramLink(url) : window.open(url, '_blank'); },
  close: () => closeSheet(),
};
const QUIET = new Set(['moresub', 'close', 'plantdlg', 'lang', 'copy', 'share', 'jump-ready']);
document.addEventListener('click', e => {
  unlock();
  if (e.target.classList.contains('sheet-bg')) return closeSheet();
  const el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
  const fn = ACT[el.dataset.act]; if (fn) { hap(); if (QUIET.has(el.dataset.act)) play('tap'); fn(el, e); }
});
document.addEventListener('input', e => {
  if (e.target.id === 'exchangeAmount' && S) {
    const gems = Math.max(0, Math.floor(Number(e.target.value) || 0));
    const preview = $('#exchangePreview'); if (preview) preview.textContent = gems ? `≈ ${(gems / S.cfg.gemsPerGram).toFixed(6)} GRAM` : '';
  }
});
function updateCountdowns() {
  $$('[data-end]').forEach(el => { if (el.dataset.progress) return; const left = Math.max(0, Math.ceil((Number(el.dataset.end) - serverNow()) / 1000)); el.textContent = left <= 0 ? t('ready') : dur(left); });
  $$('[data-progress]').forEach(el => { const start = Number(el.dataset.start), end = Number(el.dataset.end), total = Math.max(1, end - start), pct = Math.max(0, Math.min(100, (serverNow() - start) / total * 100)); el.style.width = pct + '%'; });
}
setInterval(() => {
  updateCountdowns();
  if (S && !S.needsName && serverNow() >= dueAt + 400) { dueAt = Infinity; play('coin'); refresh(true); }
  { const sv = $('.forest-svg'), l = S?.lumber; if (sv?.style && l?.active && !l.ready) sv.style.setProperty('--p', Math.min(1, (serverNow() - l.startedAt) / Math.max(1, l.readyAt - l.startedAt)).toFixed(3)); }
  $$('.crop-growing-art[data-pstart]').forEach(el => { const pct = (serverNow() - Number(el.dataset.pstart)) / Math.max(1, Number(el.dataset.pend) - Number(el.dataset.pstart)) * 100, st = stageOf(pct); if (el.dataset.st !== String(st)) { el.dataset.st = String(st); el.classList.remove('stage-0', 'stage-1', 'stage-2'); el.classList.add('stage-' + st); el.querySelectorAll('.c').forEach(c => { c.textContent = stageIcon(el.dataset.crop, pct); }); } });
}, 1000);
setInterval(() => { if (tab === 'forest' && S?.lumber?.active && !S.lumber.ready && document.visibilityState !== 'hidden') play('chopSoft'); }, 1200);
setInterval(() => { if (document.visibilityState !== 'hidden' && !(document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName || ''))) refresh(); }, 15000);
bootProgress(8, t('loading_start'));
{ const tg2 = $('#bootTag'); if (tg2) tg2.textContent = t('splash_tag'); const tips = t('tips').split('|'); let ti = 0; const tp = $('#bootTip'); const show = () => { if (tp && !$('#boot')?.hidden) { tp.textContent = '💡 ' + tips[ti++ % tips.length]; tp.style.animation = 'none'; void tp.offsetWidth; tp.style.animation = ''; } }; show(); setInterval(show, 2300); }
refresh(true);
