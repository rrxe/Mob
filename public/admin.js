const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
async function api(m, p, b) {
  const r = await fetch('/api/admin' + p, { method: m, headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && p !== '/login') { show(false); throw new Error('unauthorized'); }
  if (!r.ok) throw new Error(j.error || r.status);
  return j;
}
let tab = 'stats';
const TABS = [['stats', '📊 الإحصائيات'], ['wd', '💸 السحوبات'], ['players', '👩‍🌾 المزارعون'], ['ads', '📺 الإعلانات'], ['tasks', '⭐ المهام'], ['settings', '⚙️ الاقتصاد']];
const SETTING_LABELS = {
  gems_per_gram: 'سعر التحويل: جواهر لكل 1 GRAM', min_withdraw_gram: 'الحد الأدنى للسحب (GRAM)', withdraw_min_castle: 'مستوى المزرعة الأدنى للسحب',
  daily_gems: 'مكافآت تسجيل الدخول اليومية (مصفوفة)', ref_gems: 'جواهر دعوة صديق عند بلوغه المستوى 5', ref_bonus: 'مكافأة الصديق المدعو عند بلوغه المستوى 5', ach_gems: 'مكافآت إنجازات مستويات المزرعة (JSON)',
  initial_coins: 'عملات البداية للمزرعة الجديدة', initial_plots: 'عدد الحقول عند بداية اللعبة', storage_base: 'سعة المخزن الأساسية', storage_per_barn: 'زيادة سعة المخزن لكل مستوى',
  water_base: 'عدد مرات الري اليومية الأساسية', water_per_well: 'زيادة الري اليومي لكل مستوى بئر', fertilizer_price: 'سعر السماد بعملات المزرعة',
  water_speed_percent: 'تسريع النمو عند الري (%)', fertilizer_speed_percent: 'تسريع النمو عند التسميد (%)', mission_harvest_target: 'هدف تحدي الحصاد اليومي', mission_sell_target: 'هدف تحدي البيع اليومي', mission_water_target: 'هدف تحدي الري اليومي',
  mission_harvest_gems: 'جواهر تحدي الحصاد', mission_sell_gems: 'جواهر تحدي البيع', mission_water_gems: 'جواهر تحدي الري', maintenance: 'تشغيل وضع الصيانة',
  levelup_gems: 'جواهر عن كل مستوى مزرعة جديد', levelup_gems_step: 'جوهرة إضافية كل كم مستوى (0 = إيقاف)', harvest_gem_chance: 'فرصة سقوط جوهرة عند الحصاد (%)', harvest_gem_amount: 'عدد الجواهر الساقطة عند الحصاد',
  order_gems: 'جواهر عن كل طلب سوق مكتمل', order_all_bonus_gems: 'مكافأة إكمال طلبات اليوم الثلاثة', missions_all_bonus_gems: 'مكافأة استلام تحديات اليوم الثلاثة',
  lumber_enabled: 'تشغيل قطع الأشجار', lumber_unlock_level: 'مستوى المزرعة لفتح الغابة', lumber_base_minutes: 'مدة الدورة بالدقائق (المستوى 1)', lumber_min_minutes: 'أقصر مدة للدورة (دقائق)', lumber_minutes_per_level: 'دقائق تُخصم لكل مستوى فأس',
  lumber_logs_base: 'الأخشاب الأساسية لكل دورة', lumber_logs_per_level: 'أخشاب إضافية لكل مستوى', lumber_log_price: 'سعر الخشبة بالعملات', lumber_gems_base: 'جواهر الدورة (المستوى 1)', lumber_gems_per_level: 'زيادة الجواهر لكل مستوى (مثال 0.34)',
  lumber_upgrade_base: 'سعر تطوير الفأس الأول (عملات)', lumber_upgrade_growth: 'معامل زيادة سعر التطوير (1 - 3)', lumber_ad_double: 'السماح بمضاعفة الجائزة بإعلان',
  ad_click_required: 'اشتراط الضغط على الإعلان (زر الرئيسية)', lumber_farm_gap: 'السماح بتقدم الفأس على مستوى المزرعة بكم مستوى', ads_enabled: 'تشغيل الإعلانات', adsgram_task_reward_gems: 'جواهر مهمة AdsGram الواحدة', ad_reward_gems: 'جواهر الإعلان المكافِئ', ad_reward_coins: 'عملات الإعلان المكافِئ', ad_speed_percent: 'نسبة تسريع المحاصيل بالإعلان (%)',
  ad_min_seconds: 'أقل مدة مشاهدة يقبلها السيرفر (ثوان)', ad_cooldown_seconds: 'الانتظار بين إعلان وآخر (ثوان)', ad_daily_cap: 'الحد اليومي للإعلانات لكل لاعب', ad_interstitial_cooldown: 'الفاصل بين الإعلانات البينية (ثوان، 0 = إيقاف)'
};
const GROUPS = [
  ['🌱 المزرعة والتقدم', ['initial_coins', 'initial_plots', 'storage_base', 'storage_per_barn', 'water_base', 'water_per_well', 'fertilizer_price', 'water_speed_percent', 'fertilizer_speed_percent']],
  ['💎 كسب الجواهر', ['levelup_gems', 'levelup_gems_step', 'harvest_gem_chance', 'harvest_gem_amount', 'order_gems', 'order_all_bonus_gems', 'missions_all_bonus_gems', 'daily_gems', 'ach_gems', 'ref_gems', 'ref_bonus']],
  ['✅ التحديات اليومية', ['mission_harvest_target', 'mission_sell_target', 'mission_water_target', 'mission_harvest_gems', 'mission_sell_gems', 'mission_water_gems']],
  ['🪓 قطع الأشجار', ['lumber_enabled', 'lumber_unlock_level', 'lumber_farm_gap', 'lumber_base_minutes', 'lumber_min_minutes', 'lumber_minutes_per_level', 'lumber_logs_base', 'lumber_logs_per_level', 'lumber_log_price', 'lumber_gems_base', 'lumber_gems_per_level', 'lumber_upgrade_base', 'lumber_upgrade_growth', 'lumber_ad_double']],
  ['📺 مكافآت الإعلانات', ['ads_enabled', 'ad_click_required', 'adsgram_task_reward_gems', 'ad_reward_gems', 'ad_reward_coins', 'ad_speed_percent', 'ad_min_seconds', 'ad_cooldown_seconds', 'ad_daily_cap', 'ad_interstitial_cooldown']],
  ['◈ المحفظة والسحب', ['gems_per_gram', 'min_withdraw_gram', 'withdraw_min_castle']],
  ['🛠 النظام', ['maintenance']],
];
const BLOCKS = [
  ['adsgram_task_block_id', '🎯 كتلة المهام (Task)', 'task-12345', 'تظهر كبطاقة مهام الرعاة في الصفحة الرئيسية وفي تبويب المهام. الجائزة (جوهرة واحدة افتراضياً) تُضبط من الاقتصاد. ضع الرقم فقط أو task-12345.'],
  ['adsgram_interstitial_block_id', '🖼 كتلة الإعلان البيني (Interstitial)', 'int-12345', 'يُستخدم لزر «شاهد إعلاناً واربح جوهرة» في الرئيسية (يجب الضغط على الإعلان) ويظهر تلقائياً أحياناً بين التبويبات. ضع الرقم فقط أو int-12345.'],
];
// Mirror of the server formulas so the admin sees exactly what players get per level.
function lumberTable(S) {
  const rows = []; for (let lv = 1; lv <= 25; lv++) {
    const mins = Math.max(S.lumber_min_minutes, S.lumber_base_minutes - (lv - 1) * S.lumber_minutes_per_level), logs = Math.round(S.lumber_logs_base + (lv - 1) * S.lumber_logs_per_level + Math.pow(lv, 1.35)), gems = Math.max(0, Math.floor(S.lumber_gems_base + (lv - 1) * S.lumber_gems_per_level + 1e-9)), cost = Math.round(S.lumber_upgrade_base * Math.pow(S.lumber_upgrade_growth, lv - 1));
    const per = Math.round(gems / (mins / 60) * 100) / 100, day = Math.round(gems * (24 * 60 / mins) * 10) / 10;
    rows.push(`<tr><td>${lv}</td><td>${mins >= 60 ? (mins / 60).toFixed(mins % 60 ? 1 : 0) + ' س' : mins + ' د'}</td><td>💎 ${gems}</td><td>${logs}</td><td>${per}</td><td>${day}</td><td>${lv < 25 ? cost : '—'}</td></tr>`);
  }
  return `<div class="card" style="overflow-x:auto"><b>📈 جدول المستويات (يتغير فور تعديل القيم أعلاه)</b><div class="sm mu" style="margin:4px 0 8px">الجواهر/يوم = لو شغّل اللاعب الدورات متتالية بلا توقف. الأخيرة = سعر الترقية للمستوى التالي.</div><table class="lvtbl"><tr><th>مستوى</th><th>المدة</th><th>الجواهر</th><th>أخشاب</th><th>💎/ساعة</th><th>💎/يوم</th><th>ترقية</th></tr>${rows.join('')}</table></div>`;
}
const ICONS = ['⭐', '👥', '🌱', '🪓', '🔗', '📣', '🎁', '💎', '🎮', '📺'];
const TYPE_LABELS = { link: '🔗 فتح رابط (بوت / موقع / أي شيء) وانتظار', channel: '📣 الانضمام لقناة تيليجرام (يتحقق البوت فعلياً)', invite: '👥 دعوة عدد من الأصدقاء', level: '🌱 الوصول لمستوى مزرعة', harvest: '🌾 حصاد عدد محاصيل', lumber: '🪓 إكمال دورات قطع أشجار' };
function show(ok) { $('#login').hidden = ok; $('#panel').hidden = !ok; if (ok) load(); }
function nav() { $('#nav').innerHTML = TABS.map(([k, n]) => `<button data-t="${k}" class="${tab === k ? 'on' : ''}">${n}</button>`).join('') + '<button data-t="out">خروج</button>'; }
$('#nav').addEventListener('click', async e => {
  const k = e.target.dataset.t; if (!k) return;
  if (k === 'out') { await api('POST', '/logout', {}); return show(false); }
  tab = k; load();
});
$('#go').onclick = async () => { try { await api('POST', '/login', { password: $('#pw').value }); $('#pw').value = ''; show(true); } catch (e) { $('#lerr').textContent = ({ bad_password: 'كلمة المرور غير صحيحة', locked: 'محاولات كثيرة، انتظر 15 دقيقة', admin_disabled: 'حدد ADMIN_PASSWORD أولاً' })[e.message] || e.message; } };
$('#pw').addEventListener('keydown', e => { if (e.key === 'Enter') $('#go').click(); });

async function load() {
  nav(); const out = $('#out'); out.innerHTML = '…';
  try {
    if (tab === 'stats') {
      const s = await api('GET', '/stats');
      out.innerHTML = `<div class="card"><h3>🌱 Green Valley — ملخص اللعبة</h3><div class="grid2">${[['المزارعون', s.farms], ['متصل الآن', s.online], ['نشط آخر 24 ساعة', s.active24], ['متوسط المستوى', s.averageLevel], ['الجواهر لدى اللاعبين', s.gems], ['GRAM لدى اللاعبين', s.gram], ['عملات المزارع', s.coins], ['محاصيل تم حصادها', s.harvested]].map(([a, b]) => `<div class="opt"><span class="sm mu">${a}</span><b>${Number(b).toLocaleString()}</b></div>`).join('')}</div></div>`;
    } else if (tab === 'wd') {
      const st = window.wdStatus || 'pending';
      const { list } = await api('GET', '/withdrawals?status=' + st);
      out.innerHTML = `<div class="seg">${['pending', 'paid', 'rejected'].map(x => `<button data-s="${x}" class="${st === x ? 'on' : ''}">${x}</button>`).join('')}</div>` +
        (list.map(w => `<div class="card"><div class="row sp"><b>◈ ${w.gram} GRAM</b><span class="sm mu">${new Date(w.created_at).toLocaleString()}</span></div><div class="sm mu">Player ID: ${esc(w.tid)}</div><div class="mono sm">${esc(w.address)}</div>${w.tx_hash ? `<div class="mono sm ok">${esc(w.tx_hash)}</div>` : ''}${w.note ? `<div class="sm bad">${esc(w.note)}</div>` : ''}
        ${w.status === 'pending' ? `<input data-tx="${w.id}" placeholder="TX hash (اختياري)" style="margin-top:8px" dir="ltr"><div class="row" style="margin-top:8px"><button class="btn grow" data-ap="${w.id}">✅ تم الدفع</button><button class="btn red" data-rj="${w.id}">رفض + إرجاع</button></div>` : ''}</div>`).join('') || '<div class="card mu">لا يوجد</div>');
      out.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { window.wdStatus = b.dataset.s; load(); });
      out.querySelectorAll('[data-ap]').forEach(b => b.onclick = async () => { if (!confirm('تأكد أنك دفعت المبلغ فعلاً')) return; await api('POST', '/withdrawal', { id: b.dataset.ap, action: 'approve', tx: out.querySelector(`[data-tx="${b.dataset.ap}"]`).value }); load(); });
      out.querySelectorAll('[data-rj]').forEach(b => b.onclick = async () => { const note = prompt('سبب الرفض (يظهر للاعب)') ?? null; if (note === null) return; await api('POST', '/withdrawal', { id: b.dataset.rj, action: 'reject', note }); load(); });
    } else if (tab === 'players') {
      out.innerHTML = `<div class="card"><div class="row"><input id="q" placeholder="اسم المزرعة / @username / ID"><button class="btn" id="sq">بحث</button></div></div><div id="pl"></div>`;
      const run = async () => {
        const { list } = await api('GET', '/players?q=' + encodeURIComponent($('#q').value));
        $('#pl').innerHTML = list.map(p => `<div class="card"><div class="row sp"><b>🌿 ${esc(p.name)}</b><span class="sm mu">${esc(p.tid)} ${p.tg ? '@' + esc(p.tg) : ''}</span></div>
        <div class="sm mu">مستوى ${p.level} · 🪙 ${p.coins} · 🌾 ${p.harvested} · 💎 ${p.gems} (كسب ${p.earned}) · ◈ ${p.gram} · دعا ${p.refs}</div>
        <div class="row" style="margin-top:8px"><input data-g="${p.tid}" type="number" placeholder="± جواهر"><input data-m="${p.tid}" type="number" step="any" placeholder="± GRAM"><button class="btn sm" data-adj="${p.tid}">تعديل</button></div>
        <button class="btn sm ${p.banned ? '' : 'red'}" style="margin-top:8px" data-ban="${p.tid}" data-v="${p.banned ? 0 : 1}">${p.banned ? 'فك الحظر' : 'حظر'}</button></div>`).join('') || '<div class="card mu">لا نتائج</div>';
        $('#pl').querySelectorAll('[data-adj]').forEach(b => b.onclick = async () => { const id = b.dataset.adj; try { await api('POST', '/adjust', { tid: id, gems: Number($(`[data-g="${id}"]`).value) || 0, gram: Number($(`[data-m="${id}"]`).value) || 0 }); run(); } catch (e) { alert(e.message); } });
        $('#pl').querySelectorAll('[data-ban]').forEach(b => b.onclick = async () => { await api('POST', '/ban', { tid: b.dataset.ban, banned: b.dataset.v === '1' }); run(); });
      };
      $('#sq').onclick = run; $('#q').addEventListener('keydown', e => { if (e.key === 'Enter') run(); });
    } else if (tab === 'ads') {
      const [{ settings }, info] = await Promise.all([api('GET', '/settings'), api('GET', '/ads-info')]);
      const url = `${info.origin}/api/adsgram/reward?userid=[userId]&secret=YOUR_SECRET`;
      out.innerHTML = `<div class="card"><div class="row sp"><h3 style="margin:0">📺 إعلانات AdsGram</h3><select data-k="ads_enabled" style="width:auto"><option value="true" ${settings.ads_enabled ? 'selected' : ''}>مفعّلة</option><option value="false" ${!settings.ads_enabled ? 'selected' : ''}>متوقفة</option></select></div><div class="sm mu" style="margin-top:6px">ضع معرّفات الكتل (Block IDs) من لوحة AdsGram. التغيير يصل للاعبين خلال ثوان بدون إعادة نشر. اترك الحقل فارغاً لإخفاء ذلك النوع من الإعلانات.</div></div>` +
        BLOCKS.map(([k, name, ph, hint]) => `<div class="card"><b>${name}</b><div class="sm mu" style="margin:4px 0 8px">${hint}</div><div class="row"><input data-k="${k}" value="${esc(settings[k])}" placeholder="${ph}" dir="ltr" autocomplete="off"><button class="btn sm" data-save="${k}">حفظ</button></div></div>`).join('') +
        `<div class="card"><b>🔐 رابط المكافأة (Reward URL) لكتلة المهام</b><div class="sm mu" style="margin:4px 0 8px">ضعه في إعدادات كتلة المهام داخل AdsGram، واستبدل YOUR_SECRET بقيمة <span class="mono">ADSGRAM_REWARD_SECRET</span> من متغيرات البيئة في Dokploy.</div><div class="mono sm" style="background:#0d1b12;border:1px solid var(--line);border-radius:10px;padding:9px">${esc(url)}</div><div class="sm ${info.rewardSecretSet ? 'ok' : 'bad'}" style="margin-top:8px">${info.rewardSecretSet ? '✔ ADSGRAM_REWARD_SECRET مضبوط على السيرفر' : '✖ ADSGRAM_REWARD_SECRET غير مضبوط — مهام AdsGram لن تُصرف جواهر حتى تضيفه'}</div></div>` +
        `<div class="card"><b>🎚 حدود ومكافآت الإعلانات</b><div class="sm mu" style="margin:4px 0 8px">تعديلها يتم من تبويب «الاقتصاد» → قسم مكافآت الإعلانات.</div></div>`;
      out.querySelectorAll('[data-save]').forEach(b => b.onclick = async () => { const k = b.dataset.save, el = out.querySelector(`[data-k="${k}"]`); try { await api('POST', '/settings', { key: k, value: el.value.trim() }); const v = (await api('GET', '/settings')).settings[k]; el.value = v; b.textContent = '✔'; setTimeout(() => b.textContent = 'حفظ', 1200); } catch (e) { alert(e.message === 'bad_block' ? 'معرّف غير صحيح: اكتب الرقم فقط أو الصيغة المطلوبة' : e.message); } });
      out.querySelector('[data-k="ads_enabled"]').onchange = async e => { try { await api('POST', '/settings', { key: 'ads_enabled', value: e.target.value === 'true' }); } catch (x) { alert(x.message); } };
    } else if (tab === 'tasks') {
      const { list } = await api('GET', '/tasks'); window.taskList = list.map(x => ({ ...x }));
      drawTasks(out);
    } else {
      const { settings, defaults } = await api('GET', '/settings');
      const card = k => { const v = settings[k], isJ = typeof defaults[k] === 'object'; return `<div class="card"><div><b>${SETTING_LABELS[k] || k}</b><div class="mono sm mu">${k}</div></div><div class="row" style="margin-top:8px">${typeof defaults[k] === 'boolean' ? `<select data-k="${k}"><option value="true" ${v ? 'selected' : ''}>true</option><option value="false" ${!v ? 'selected' : ''}>false</option></select>` : `<input data-k="${k}" ${isJ ? '' : 'type="number" step="any"'} value='${esc(isJ ? JSON.stringify(v) : v)}' dir="ltr">`}<button class="btn sm" data-save="${k}">حفظ</button></div></div>`; };
      const shown = new Set(GROUPS.flatMap(g => g[1])), rest = Object.keys(defaults).filter(k => !shown.has(k) && !/block_id$/.test(k));
      out.innerHTML = `<div class="card sm mu">اضبط اقتصاد المزرعة ومكافآت الجواهر وقطع الأشجار والإعلانات. التغييرات تطبق على العمليات الجديدة مباشرة. مكافآت الجواهر ليست دخلاً مضموناً: وازنها مع عائد الإعلانات وميزانية السحب.</div>` +
        [...GROUPS, ...(rest.length ? [['📦 أخرى', rest]] : [])].map(([title, keys]) => `<h3 class="adm-group">${title}</h3>${keys.filter(k => k in defaults).map(card).join('')}${title.includes('قطع الأشجار') ? lumberTable(settings) : ''}`).join('');
      out.querySelectorAll('[data-save]').forEach(b => b.onclick = async () => {
        const k = b.dataset.save, el = out.querySelector(`[data-k="${k}"]`); let v;
        try { v = typeof defaults[k] === 'boolean' ? el.value === 'true' : typeof defaults[k] === 'object' ? JSON.parse(el.value) : typeof defaults[k] === 'string' ? el.value : Number(el.value); await api('POST', '/settings', { key: k, value: v }); b.textContent = '✔'; setTimeout(() => b.textContent = 'حفظ', 1200); }
        catch (e) { alert('قيمة غير صالحة: ' + e.message); }
      });
    }
  } catch (e) { if (e.message !== 'unauthorized') out.innerHTML = `<div class="card bad">${esc(e.message)}</div>`; }
}
function drawTasks(out) {
  const L = window.taskList, types = Object.keys(TYPE_LABELS);
  const field = (i, k, label, ph = '', type = 'text', w = '') => `<label class="adm-f ${w}"><span class="sm mu">${label}</span><input data-i="${i}" data-f="${k}" type="${type}" value="${esc(L[i][k] ?? '')}" placeholder="${ph}" ${type === 'number' ? 'min="0"' : 'dir="auto"'}></label>`;
  out.innerHTML = `<div class="card"><div class="row sp"><h3 style="margin:0">⭐ مهام اللاعبين</h3><button class="btn sm" id="addTask">＋ مهمة جديدة</button></div><div class="sm mu" style="margin-top:6px">أضف مهام تظهر مباشرة في تبويب المهام. مهام القناة يتحقق منها البوت فعلياً (يجب أن يكون البوت مشرفاً في القناة). لا تنسَ الضغط على «حفظ الكل».</div></div>` +
    L.map((x, i) => `<div class="card task-edit ${x.active === false ? 'off' : ''}"><div class="row sp"><b>${esc(x.icon || '⭐')} ${esc(x.title_ar || x.title_en || 'مهمة جديدة')}</b><span class="mono sm mu">${esc(x.id || 'جديد')}</span></div>
      <label class="adm-f"><span class="sm mu">النوع</span><select data-i="${i}" data-f="type">${types.map(t => `<option value="${t}" ${x.type === t ? 'selected' : ''}>${TYPE_LABELS[t]}</option>`).join('')}</select></label>
      <div class="adm-grid">${field(i, 'title_ar', 'العنوان بالعربية')}${field(i, 'title_en', 'Title (English)')}</div>
      <div class="adm-grid">${x.type === 'link' ? field(i, 'url', 'الرابط (https://…)', 'https://', 'text') : ''}${x.type === 'channel' ? field(i, 'chat', 'القناة (@channel أو رابط t.me)', '@channel') + field(i, 'url', 'رابط الدعوة (اختياري للقنوات الخاصة)', 'https://t.me/…') : ''}${['invite', 'level', 'harvest', 'lumber'].includes(x.type) ? field(i, 'target', 'الهدف (العدد المطلوب)', '', 'number') : ''}${x.type === 'link' ? field(i, 'wait', 'ثواني الانتظار قبل الاستلام', '', 'number') : ''}</div>
      <div class="adm-grid">${field(i, 'gems', '💎 جواهر', '', 'number')}${field(i, 'coins', '🪙 عملات', '', 'number')}</div>
      <div class="adm-grid"><label class="adm-f"><span class="sm mu">التكرار</span><select data-i="${i}" data-f="repeat"><option value="once" ${x.repeat !== 'daily' ? 'selected' : ''}>مرة واحدة</option><option value="daily" ${x.repeat === 'daily' ? 'selected' : ''}>كل يوم</option></select></label><label class="adm-f"><span class="sm mu">الأيقونة</span><select data-i="${i}" data-f="icon">${ICONS.map(c => `<option ${x.icon === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label></div>
      <div class="row" style="margin-top:10px"><label class="row sm" style="gap:6px"><input type="checkbox" data-i="${i}" data-f="active" ${x.active === false ? '' : 'checked'} style="width:auto"> مفعّلة</label><span class="grow"></span><button class="btn sm red" data-del="${i}">حذف</button></div></div>`).join('') +
    `<button class="btn full" id="saveTasks" style="margin-top:6px">💾 حفظ الكل</button><div id="tmsg" class="sm" style="margin-top:8px"></div>`;
  const sync = () => out.querySelectorAll('[data-f]').forEach(el => { const i = +el.dataset.i, f = el.dataset.f; L[i][f] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) || 0 : el.value; });
  out.querySelectorAll('select[data-f="type"]').forEach(el => el.onchange = () => { sync(); drawTasks(out); });
  $('#addTask').onclick = () => { sync(); L.unshift({ type: 'link', icon: '⭐', title_ar: '', title_en: '', url: '', wait: 10, gems: 1, coins: 0, repeat: 'once', active: true, target: 1 }); drawTasks(out); };
  out.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { if (!confirm('حذف هذه المهمة؟')) return; sync(); L.splice(+b.dataset.del, 1); drawTasks(out); });
  $('#saveTasks').onclick = async () => { sync(); const m = $('#tmsg'); try { const r = await api('POST', '/tasks', { list: L }); window.taskList = r.list.map(x => ({ ...x })); m.className = 'sm ok'; m.textContent = '✔ تم الحفظ (' + r.list.length + ' مهمة)'; setTimeout(() => drawTasks(out), 700); } catch (e) { m.className = 'sm bad'; m.textContent = e.message === 'bad_task' ? 'تأكد: عنوان لكل مهمة، رابط https صحيح لمهام الرابط، واسم قناة صحيح لمهام القناة' : e.message; } };
}
api('GET', '/session').then(() => show(true)).catch(() => show(false));
