// Verify that legacy kingdom records keep wallet/referral data during farm migration.
import fs from 'node:fs';
const file = '/tmp/green-valley-migration.json';
const old = {
  players: { '900': { tid: '900', kname: 'Legacy Realm', region: 2, tg: { u: 'olduser', f: 'Old' },
    created: Date.now() - 100000, t: Date.now(), seen: Date.now(), gems: 4321, gram: 1.2345, gemsEarned: 5000,
    daily: { last: '', streak: 0 }, refs: 3, refEarn: 60, refPaid: true, ref: null, banned: false,
    b: { castle: 8, farm: 7 }, troops: { inf: 100 }, tech: {}, res: {}, ach: {} } },
  alliances: {}, settings: {}, withdrawals: [], ledger: []
};
fs.writeFileSync(file, JSON.stringify(old));
process.env.DEV_DB_FILE = file;
const world = await import('../server/world.js');
await world.init();
const p = world.W.players.get('900');
if (!p || p.gems !== 4321 || p.gram !== 1.2345 || p.gemsEarned !== 5000 || p.refs !== 3 || !p.refPaid) throw new Error('legacy wallet/referral data was not preserved');
if (!p.farm || p.farm.level !== 1 || p.farm.plots.length !== 6 || p.farm.coins <= 0) throw new Error('legacy player did not receive a starter farm');
await world.flush();
if (world.W.dirtyP.size) throw new Error('legacy farm migration was not flushed');
console.log(' ✓ legacy player wallet, referral and ban state preserved');
console.log(' ✓ legacy player receives a fresh farm profile');
fs.unlinkSync(file);
