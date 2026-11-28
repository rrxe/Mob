// Telegram helpers (zero dependencies): initData verification, Bot API calls, /start handler via long polling.
import crypto from 'node:crypto';

const token = () => String(process.env.BOT_TOKEN || '').trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));

export function verifyInitData(initData) {
  if (!initData || typeof initData !== 'string' || !token()) return null;
  try {
    const params = new URLSearchParams(initData);
    const received = String(params.get('hash') || '').toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(received)) return null;
    params.delete('hash');
    const check = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n');
    const secret = crypto.createHmac('sha256', 'WebAppData').update(token()).digest();
    const expected = crypto.createHmac('sha256', secret).update(check).digest();
    const got = Buffer.from(received, 'hex');
    if (got.length !== expected.length || !crypto.timingSafeEqual(got, expected)) return null;
    const authDate = Number(params.get('auth_date') || 0), nowS = Math.floor(Date.now() / 1000);
    const maxAge = Math.max(300, Math.min(Number(process.env.INIT_DATA_MAX_AGE_SECONDS || 86400), 604800));
    if (!authDate || authDate > nowS + 60 || nowS - authDate > maxAge) return null;
    const u = JSON.parse(params.get('user') || 'null');
    if (!u?.id || !/^\d+$/.test(String(u.id))) return null;
    return { id: String(u.id), username: u.username || null, firstName: u.first_name || '', lang: u.language_code || '', startParam: params.get('start_param') || '' };
  } catch { return null; }
}

export async function tgApi(method, body = {}) {
  if (!token()) return null;
  const r = await fetch(`https://api.telegram.org/bot${token()}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) throw new Error(`telegram ${method}: ${j.description || r.status}`);
  return j.result;
}

// serialized sender (Telegram allows ~30 msg/s overall)
const queue = [];
let sending = false;
export function notify(tid, text) {
  if (!token()) return;
  queue.push({ tid, text });
  if (!sending) drain();
}
async function drain() {
  sending = true;
  while (queue.length) {
    const { tid, text } = queue.shift();
    try { await tgApi('sendMessage', { chat_id: tid, text }); } catch (e) { /* user blocked the bot etc. */ }
    await sleep(60);
  }
  sending = false;
}

export async function startBot() {
  if (!token()) { console.warn('BOT_TOKEN not set: bot disabled (dev mode).'); return; }
  const url = (process.env.WEB_APP_URL || '').replace(/\/$/, '');
  try {
    await tgApi('deleteWebhook', {});
    if (url) await tgApi('setChatMenuButton', { menu_button: { type: 'web_app', text: '🌱 Farm', web_app: { url } } });
    await tgApi('setMyCommands', { commands: [{ command: 'start', description: 'Play Green Valley / العب المزرعة' }] });
  } catch (e) { console.error('bot setup', e.message); }
  let offset = 0;
  (async function loop() {
    for (;;) {
      try {
        const updates = await tgApi('getUpdates', { offset, timeout: 25, allowed_updates: ['message'] });
        for (const u of updates) { offset = u.update_id + 1; handle(u).catch(e => console.error('handle', e.message)); }
      } catch (e) { console.error('poll', e.message); await sleep(4000); }
    }
  })();
  async function handle(u) {
    const m = u.message;
    if (!m?.text || !m.text.startsWith('/start')) return;
    const payload = (m.text.split(' ')[1] || '').trim();
    const ref = /^ref_(\d{1,20})$/.exec(payload)?.[1];
    const link = url ? `${url}/${ref ? `?ref=${ref}` : ''}` : '';
    await tgApi('sendMessage', {
      chat_id: m.chat.id,
      text: '🌱 GREEN VALLEY\n\nازرع محاصيلك، طوّر مزرعتك، احصد وبع منتجاتك، واجمع 💎 يمكن تحويلها إلى GRAM.\nGrow crops, upgrade your farm, harvest and sell produce, and earn 💎 that can be converted to GRAM.',
      reply_markup: link ? { inline_keyboard: [[{ text: '🌱 ابدأ الزراعة / Start farming', web_app: { url: link } }]] } : undefined,
    });
  }
}
