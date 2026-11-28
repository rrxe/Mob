// Unit-level rules test: fast-forward crop timers without waiting in real time.
process.env.DEV_DB_FILE = '/tmp/green-valley-rules.json';
import fs from 'node:fs'; try { fs.unlinkSync(process.env.DEV_DB_FILE); } catch {}
import assert from 'node:assert/strict';
const world = await import('../server/world.js');
const { W } = world;
await world.init();
let checks = 0; const ok = (v, msg) => { assert.ok(v, msg); checks++; console.log(' ✓', msg); };
const a = await world.createFarm('101', { username: 'a', firstName: 'A' }, { name: 'Amber Fields' });
const b = await world.createFarm('102', { username: 'b', firstName: 'B' }, { name: 'Blue Orchard', ref: '101' });
ok(a.farm.level === 1 && a.farm.plots.length === 6, 'fresh farm starts at level 1 with six plots');
ok(b.ref === '101', 'referral is recorded');
world.plant(a, { plot: 0, crop: 'wheat' });
const planted = a.farm.plots[0]; planted.readyAt = Date.now() - 1;
const harvested = world.harvest(a, { plot: 0 });
ok(harvested.amount === 4 && a.farm.inventory.wheat === 4, 'ripe wheat can be harvested into inventory');
const oldCoins = a.farm.coins;
const sold = world.sell(a, { crop: 'wheat', amount: 4 });
ok(sold.coins === 20 && a.farm.coins === oldCoins + 20 && a.farm.inventory.wheat === 0, 'selling crops pays farm coins');
world.plant(a, { plot: 1, crop: 'wheat' });
const plot = a.farm.plots[1]; const before = plot.readyAt;
world.water(a, { plot: 1 });
ok(plot.watered && plot.readyAt < before && a.farm.missions.progress.water === 1, 'watering speeds growth and advances daily mission');
world.fertilize(a, { plot: 1 });
ok(plot.fertilized && a.farm.fertilizer === 2 && plot.readyAt < before, 'fertilizer is consumed and speeds growth');
world.upgrade(a, { building: 'land' });
ok(a.farm.plots.length === 8 && a.farm.buildings.land === 2, 'land expansion adds two plots');
a.farm.missions.progress.harvest = W.S.mission_harvest_target;
const mission = world.claimMission(a, { id: 'harvest' });
ok(mission.gems === W.S.mission_harvest_gems, 'completed daily mission awards gems');
const day = world.daily(a);
ok(day.streak === 1 && a.gems >= day.gems, 'daily reward adds gems');
world.exchange(a, 1);
ok(Math.abs(a.gram - 0.001) < 1e-9, 'gem exchange credits GRAM');
// High XP is used to exercise all milestone rewards and referral completion.
b.farm.xp = 1_000_000;
world.plant(b, { plot: 0, crop: 'wheat' }); b.farm.plots[0].readyAt = Date.now() - 1;
world.harvest(b, { plot: 0 });
ok(b.farm.level > 5 && b.refPaid && a.refs === 1 && a.refEarn === W.S.ref_gems, 'level milestone triggers one-time referral reward');
const address = 'EQ' + 'A'.repeat(46);
b.farm.level = W.S.withdraw_min_castle; b.gram = 2;
const request = await world.withdraw(b, { gram: 1, address });
ok(request.status === 'pending' && b.gram === 1, 'withdrawal deducts balance and creates pending request');
try { await world.withdraw(b, { gram: 1, address }); ok(false, 'duplicate pending withdrawal blocked'); } catch (e) { ok(e.code === 'wd_pending', 'duplicate pending withdrawal blocked'); }
await world.reviewWithdrawal(request.id, false, { note: 'unit test' });
ok(b.gram === 2, 'rejected withdrawal refunds GRAM');
await world.flush();
console.log(`\n${checks} farm rules passed`);
process.exit(0);
