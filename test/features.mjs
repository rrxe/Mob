// Rules test for the Lumberjack, ads sessions, AdsGram callback and admin-managed tasks.
process.env.DEV_DB_FILE = '/tmp/green-valley-features.json';
process.env.ADSGRAM_REWARD_SECRET = 'topsecret';
import fs from 'node:fs'; try { fs.unlinkSync(process.env.DEV_DB_FILE); } catch {}
import assert from 'node:assert/strict';
const world = await import('../server/world.js');
const { W } = world;
await world.init();
let checks = 0; const ok = (v, msg) => { assert.ok(v, msg); checks++; console.log(' ✓', msg); };
const fails = (fn, code, msg) => { try { fn(); } catch (e) { ok(e.code === code, msg); return; } ok(false, msg); };
const p = await world.createFarm('50001', { username: 'a', firstName: 'A' }, { name: 'Wood Farm' });

// --- lumberjack ---
W.S.lumber_unlock_level = 3; fails(() => world.lumberStart(p), 'lumber_locked', 'lumberjack respects an admin unlock level'); W.S.lumber_unlock_level = 1;
p.farm.level = 3; p.farm.coins = 100000;
const s1 = world.lumberStart(p);
ok(s1.readyAt > Date.now() && p.lumber.active, 'starting a cycle sets a ready time');
fails(() => world.lumberStart(p), 'lumber_busy', 'cannot start while a cycle is running');
fails(() => world.lumberClaim(p), 'lumber_not_ready', 'cannot claim before the timer ends');
p.lumber.readyAt = Date.now() - 1;
const gemsBefore = p.gems, r = world.lumberClaim(p);
ok(r.gems === 2 && r.logs === world.view(p).lumber.cur.logs && p.lumber.logs === r.logs && p.gems === gemsBefore + r.gems && !p.lumber.active && p.lumber.cycles === 1, 'claim pays logs and gems and ends the cycle');
const coins0 = p.farm.coins, sold = world.lumberSell(p, { amount: 'all' });
ok(sold.coins === r.logs * W.S.lumber_log_price && p.farm.coins === coins0 + sold.coins && p.lumber.logs === 0, 'logs sell for coins');
const up = world.lumberUpgrade(p);
ok(up.level === 2 && p.lumber.level === 2, 'axe upgrade costs coins and raises the level');
p.farm.level = 1; p.lumber.level = 3; fails(() => world.lumberUpgrade(p), 'building_level', 'axe level cannot run too far ahead of the farm level');
ok(G_minutes(2) < G_minutes(1) && G_minutes(1) === 180, 'level 1 is a 3 hour cycle and higher levels cut faster');
function G_minutes(lv) { return Math.max(W.S.lumber_min_minutes, W.S.lumber_base_minutes - (lv - 1) * W.S.lumber_minutes_per_level); }

// --- ad sessions (server measures the watch time itself) ---
W.S.ad_min_seconds = 8; W.S.ad_cooldown_seconds = 0;
fails(() => world.adPrepare(p, { kind: 'nope' }), 'bad_input', 'unknown ad kind rejected');
let ses = world.adPrepare(p, { kind: 'gems' });
fails(() => world.adConfirm(p, { id: ses.id }), 'ad_short', 'confirming an ad too early is rejected');
ses = world.adPrepare(p, { kind: 'gems' }); p.ads.session.t -= 20000;
const g0 = p.gems, ad = world.adConfirm(p, { id: ses.id });
ok(ad.gems === W.S.ad_reward_gems && p.gems === g0 + ad.gems, 'a watched ad pays gems once');
fails(() => world.adConfirm(p, { id: ses.id }), 'ad_session', 'an ad session cannot be reused');
W.S.ad_daily_cap = 2; p.ads.count = 2; fails(() => world.adPrepare(p, { kind: 'gems' }), 'ad_cap', 'daily ad cap is enforced'); W.S.ad_daily_cap = 12; p.ads.count = 0;
// lumber x2 via ad
world.lumberStart(p); p.lumber.readyAt = Date.now() - 1;
fails(() => world.lumberClaim(p, { double: true }), 'ad_session', 'x2 claim needs a watched ad');
ses = world.adPrepare(p, { kind: 'lumber' }); p.ads.session.t -= 20000; world.adConfirm(p, { id: ses.id });
const dbl = world.lumberClaim(p, { double: true });
ok(dbl.doubled && dbl.logs === 2 * world.view(p).lumber.cur.logs, 'watching an ad doubles the lumber reward');

// --- AdsGram server callback ---
ok(world.adsgramReward({ userid: '50001', secret: 'wrong' }).status === 403, 'AdsGram callback rejects a wrong secret');
ok(world.adsgramReward({ userid: '50001', secret: 'topsecret' }).ok, 'AdsGram callback with the right secret records a pending reward');
const g1 = p.gems, c1 = world.adsgramClaim(p);
ok(c1.gems === W.S.adsgram_task_reward_gems && p.gems === g1 + c1.gems, 'player claims the pending AdsGram reward');
ok(world.adsgramClaim(p).pending === true, 'nothing left to claim afterwards');

// --- block ids from admin ---
await world.setSetting('adsgram_task_block_id', '59461'); ok(W.S.adsgram_task_block_id === 'task-59461', 'bare numeric task block id is normalised');
await world.setSetting('adsgram_interstitial_block_id', 'int-59439'); ok(W.S.adsgram_interstitial_block_id === 'int-59439', 'interstitial block id saved');
await world.setSetting('adsgram_reward_block_id', '12345'); ok(W.S.adsgram_reward_block_id === '12345', 'rewarded block id saved');
let bad = false; try { await world.setSetting('adsgram_task_block_id', 'int-1'); } catch (e) { bad = e.code === 'bad_block'; } ok(bad, 'a block id of the wrong kind is rejected');
ok(world.view(p).ads.taskBlock === 'task-59461', 'player view carries the current block ids');

// --- admin tasks ---
await world.adminSaveTasks([
  { id: 'join_news', type: 'channel', title_ar: 'انضم لقناتنا', title_en: 'Join our channel', chat: 'https://t.me/GreenValleyNews', gems: 3, coins: 100, repeat: 'once' },
  { id: 'visit_site', type: 'link', title_ar: 'زر الموقع', title_en: 'Visit site', url: 'https://example.com', wait: 5, gems: 2, repeat: 'daily' },
  { id: 'lvl10', type: 'level', title_ar: 'مستوى 10', title_en: 'Level 10', target: 10, gems: 6 },
]);
ok(W.tasks.length === 3 && W.tasks[0].chat === '@GreenValleyNews', 'admin saves tasks and normalises the channel link');
try { await world.adminSaveTasks([{ type: 'link', title_en: 'x', url: 'javascript:alert(1)' }]); ok(false, 'unsafe task url rejected'); } catch (e) { ok(e.code === 'bad_task', 'unsafe task url rejected'); }
ok(world.tasksView(p).length === 3, 'player sees the active tasks');
await world.taskStart(p, { id: 'visit_site' });
try { await world.taskClaim(p, { id: 'visit_site' }); ok(false, 'link task waits'); } catch (e) { ok(e.code === 'task_wait', 'link task cannot be claimed before the wait time'); }
p.tasks.started.visit_site -= 6000;
const tg0 = p.gems; await world.taskClaim(p, { id: 'visit_site' });
ok(p.gems === tg0 + 2, 'link task pays gems after the wait');
try { await world.taskClaim(p, { id: 'visit_site' }); ok(false, 'once per day'); } catch (e) { ok(e.code === 'claimed', 'daily task cannot be claimed twice in a day'); }
W.verifyChannel = async () => false;
try { await world.taskClaim(p, { id: 'join_news' }); ok(false, 'must join'); } catch (e) { ok(e.code === 'not_joined', 'channel task checks real membership'); }
W.verifyChannel = async () => true;
await world.taskClaim(p, { id: 'join_news' }); ok(p.tasks.done.join_news === true, 'channel task pays once membership is verified');
try { await world.taskClaim(p, { id: 'lvl10' }); ok(false, 'level task'); } catch (e) { ok(e.code === 'task_not_ready', 'level task needs the level'); }

// --- better gem earning ---
W.S.harvest_gem_chance = 100;
p.farm.coins = 1000; world.plant(p, { plot: 3, crop: 'wheat' }); p.farm.plots[3].readyAt = Date.now() - 1;
const hg = p.gems, hv = world.harvest(p, { plot: 3 });
ok(hv.gem === W.S.harvest_gem_amount && p.gems >= hg + hv.gem, 'harvest can drop bonus gems');
const lv0 = p.gems; p.farm.xp = 1e6; world.plant(p, { plot: 4, crop: 'wheat' }); p.farm.plots[4].readyAt = Date.now() - 1; world.harvest(p, { plot: 4 });
ok(p.gems - lv0 >= W.S.levelup_gems, 'every farm level-up pays gems');
await world.flush();
console.log(`\n${checks} feature rules passed`);
process.exit(0);
