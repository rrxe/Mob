// Persistence: Supabase REST (production) or a local JSON file (dev, when SUPABASE_* is not set).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const URL_ = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
export const remote = Boolean(URL_ && KEY);
const FILE = process.env.DEV_DB_FILE || './data/dev.json';

async function rest(p, { method = 'GET', body, prefer } = {}) {
  const r = await fetch(`${URL_}/rest/v1/${p}`, {
    method,
    headers: { apikey: KEY, authorization: `Bearer ${KEY}`, 'content-type': 'application/json', ...(prefer ? { prefer } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`supabase ${r.status}: ${txt.slice(0, 300)}`);
  return txt ? JSON.parse(txt) : null;
}
async function pageAll(table, select, order) {
  const out = [];
  for (let off = 0; ; off += 1000) {
    const rows = await rest(`${table}?select=${select}&order=${order}.asc&limit=1000&offset=${off}`);
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

// ---- file mode ----
let mem = { players: {}, alliances: {}, settings: {}, withdrawals: [], ledger: [] };
let writeTimer = null;
function fileLoad() { try { mem = { ...mem, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; } catch { /* first run */ } }
function fileSave() {
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(mem)); } catch (e) { console.error('file save', e.message); }
  }, 300);
}

export async function loadAll() {
  if (remote) {
    const [players, settings] = await Promise.all([
      pageAll('rl_players', 'data', 'tid'), pageAll('rl_settings', 'key,value', 'key'),
    ]);
    return { players: players.map(r => r.data), alliances: [], settings: Object.fromEntries(settings.map(r => [r.key, r.value])) };
  }
  fileLoad();
  return { players: Object.values(mem.players), alliances: Object.values(mem.alliances), settings: mem.settings };
}
export async function savePlayers(list) {
  if (!list.length) return;
  if (remote) {
    await rest('rl_players?on_conflict=tid', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal',
      body: list.map(p => ({ tid: p.tid, kname: p.kname, region: p.region, power: p._power || 0, data: p, updated_at: new Date().toISOString() })) });
  } else { for (const p of list) mem.players[p.tid] = p; fileSave(); }
}
export async function saveAlliances(list) {
  if (!list.length) return;
  if (remote) {
    await rest('rl_alliances?on_conflict=id', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal',
      body: list.map(a => ({ id: a.id, name: a.name, data: a, updated_at: new Date().toISOString() })) });
  } else { for (const a of list) mem.alliances[a.id] = a; fileSave(); }
}
export async function deleteAlliance(id) {
  if (remote) await rest(`rl_alliances?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
  else { delete mem.alliances[id]; fileSave(); }
}
export async function saveSetting(key, value) {
  if (remote) await rest('rl_settings?on_conflict=key', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: [{ key, value }] });
  else { mem.settings[key] = value; fileSave(); }
}
export async function addLedger(rows) {
  if (!rows.length) return;
  if (remote) await rest('rl_ledger', { method: 'POST', prefer: 'return=minimal', body: rows });
  else { mem.ledger.push(...rows); fileSave(); }
}
export async function createWithdrawal(row) {
  if (remote) { const r = await rest('rl_withdrawals', { method: 'POST', prefer: 'return=representation', body: [row] }); return r[0]; }
  const r = { id: crypto.randomUUID(), status: 'pending', created_at: new Date().toISOString(), ...row };
  mem.withdrawals.push(r); fileSave(); return r;
}
export async function listWithdrawals({ status, tid, limit = 50 } = {}) {
  if (remote) {
    let q = `rl_withdrawals?select=*&order=created_at.desc&limit=${limit}`;
    if (status) q += `&status=eq.${encodeURIComponent(status)}`;
    if (tid) q += `&tid=eq.${encodeURIComponent(tid)}`;
    return rest(q);
  }
  return mem.withdrawals.filter(w => (!status || w.status === status) && (!tid || w.tid === tid)).slice().reverse().slice(0, limit);
}
export async function getWithdrawal(id) {
  if (remote) { const r = await rest(`rl_withdrawals?select=*&id=eq.${encodeURIComponent(id)}`); return r[0] || null; }
  return mem.withdrawals.find(w => w.id === id) || null;
}
export async function updateWithdrawal(id, patch) {
  if (remote) { const r = await rest(`rl_withdrawals?id=eq.${encodeURIComponent(id)}&status=eq.pending`, { method: 'PATCH', prefer: 'return=representation', body: patch }); return r[0] || null; }
  const w = mem.withdrawals.find(x => x.id === id && x.status === 'pending');
  if (!w) return null;
  Object.assign(w, patch); fileSave(); return w;
}
