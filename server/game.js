// Green Valley — authoritative farming economy definitions.
export const CROPS = {
  wheat:      { seed: 10, grow: 90,    yield: 4,  price: 5,  xp: 2, level: 1, greenhouse: 0, icon: '🌾' },
  corn:       { seed: 20, grow: 300,   yield: 5,  price: 8,  xp: 3, level: 2, greenhouse: 0, icon: '🌽' },
  carrot:     { seed: 36, grow: 720,   yield: 7,  price: 9,  xp: 3, level: 3, greenhouse: 0, icon: '🥕' },
  tomato:     { seed: 65, grow: 1800,  yield: 8,  price: 13, xp: 4, level: 5, greenhouse: 0, icon: '🍅' },
  strawberry: { seed: 120,grow: 3600,  yield: 10, price: 19, xp: 5, level: 7, greenhouse: 1, icon: '🍓' },
  pumpkin:    { seed: 210,grow: 7200,  yield: 14, price: 23, xp: 6, level: 9, greenhouse: 2, icon: '🎃' },
  watermelon: { seed: 350,grow: 10800, yield: 18, price: 30, xp: 8, level: 12,greenhouse: 3, icon: '🍉' },
  pineapple:  { seed: 560,grow: 14400, yield: 22, price: 39, xp: 10,level: 15,greenhouse: 4, icon: '🍍' },
};

export const BUILDINGS = {
  land:       { max: 7, base: 280, growth: 1.72 },
  barn:       { max: 10,base: 220, growth: 1.68 },
  well:       { max: 8, base: 250, growth: 1.70 },
  greenhouse: { max: 5, base: 480, growth: 1.78 },
};

export const DEFAULTS = {
  gems_per_gram: 1000,
  min_withdraw_gram: 1,
  withdraw_min_castle: 5, // kept for existing admin settings; now means minimum farm level
  daily_gems: [1, 1, 2, 2, 3, 3, 5],
  ref_gems: 20,
  ref_bonus: 5,
  ach_gems: { 3: 5, 5: 10, 8: 20, 10: 35, 15: 60, 20: 100 },
  initial_coins: 650,
  initial_plots: 6,
  storage_base: 180,
  storage_per_barn: 140,
  water_base: 3,
  water_per_well: 2,
  fertilizer_price: 45,
  water_speed_percent: 15,
  fertilizer_speed_percent: 25,
  mission_harvest_target: 18,
  mission_sell_target: 30,
  mission_water_target: 4,
  mission_harvest_gems: 3,
  mission_sell_gems: 3,
  mission_water_gems: 2,
  maintenance: false,
  // --- better gem earning (all values editable from /admin) ---
  levelup_gems: 1,            // gems for every farm level gained
  levelup_gems_step: 5,       // extra +1 gem per this many levels (0 = off)
  harvest_gem_chance: 4,      // % chance of a gem drop on each harvest
  harvest_gem_amount: 1,
  order_gems: 1,              // gems for each completed market order
  order_all_bonus_gems: 3,    // bonus when all 3 daily orders are done
  missions_all_bonus_gems: 4, // bonus when all 3 daily missions are claimed
  // --- Lumberjack (tree cutting) ---
  lumber_enabled: true,
  lumber_unlock_level: 1,
  lumber_base_minutes: 180,   // cycle length at level 1 (3 hours)
  lumber_min_minutes: 60,     // fastest cycle
  lumber_minutes_per_level: 5,
  lumber_logs_base: 10,
  lumber_logs_per_level: 4,
  lumber_log_price: 4,        // coins per log
  lumber_gems_base: 2,         // gems for one cycle at level 1
  lumber_gems_per_level: 0.6, // gems = floor(base + (level-1) * this)
  lumber_upgrade_base: 250,
  lumber_farm_gap: 2,         // axe level may be at most (farm level + gap)
  lumber_upgrade_growth: 1.55,
  lumber_ad_double: true,     // watch an ad to double the cycle reward
  // --- Ads (AdsGram) ---
  ads_enabled: true,
  adsgram_task_block_id: '',        // e.g. task-12345
  adsgram_reward_block_id: '',      // rewarded video, e.g. 12345
  adsgram_interstitial_block_id: '',// e.g. int-12345
  adsgram_task_reward_gems: 1,
  ad_reward_gems: 1,
  ad_click_required: true,    // home "watch an ad": player must click the ad and come back
  ad_reward_coins: 150,
  ad_min_seconds: 5,
  ad_cooldown_seconds: 60,
  ad_speed_percent: 20,       // 'speed up' ad boost for all growing crops
  ad_daily_cap: 12,
  ad_interstitial_cooldown: 240, // seconds between automatic interstitials (0 = never)
};

// Lumberjack: level -> numbers (server-authoritative, also shown to the player)
export const LUMBER_MAX = 25;
export const lumberMinutes = (lv, S) => Math.max(S.lumber_min_minutes, S.lumber_base_minutes - (lv - 1) * S.lumber_minutes_per_level);
export const lumberLogs = (lv, S) => Math.round(S.lumber_logs_base + (lv - 1) * S.lumber_logs_per_level + Math.pow(lv, 1.35));
export const lumberGems = (lv, S) => Math.max(0, Math.floor(S.lumber_gems_base + (lv - 1) * S.lumber_gems_per_level + 1e-9));
export const lumberXp = lv => 12 + lv * 5;
export const lumberUpgradeCost = (lv, S) => Math.round(S.lumber_upgrade_base * Math.pow(S.lumber_upgrade_growth, lv - 1));
export const TREES = ['oak', 'pine', 'birch', 'maple', 'redwood']; // cosmetic, unlocked by level (1,5,10,16,22)
export const treeFor = lv => (lv >= 22 ? 'redwood' : lv >= 16 ? 'maple' : lv >= 10 ? 'birch' : lv >= 5 ? 'pine' : 'oak');

export const dayKey = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);
const EARLY_XP = [40, 90, 180, 330]; // levels 1->2 ... 4->5 are quick so new players feel progress in the first minutes
export const xpNeeded = level => EARLY_XP[level - 1] ?? Math.round(100 + 85 * Math.pow(Math.max(1, level), 1.32));
export const buildingCost = (id, nextLevel) => Math.round(BUILDINGS[id].base * Math.pow(BUILDINGS[id].growth, nextLevel - 1));
export const storageCap = (farm, settings) => settings.storage_base + farm.buildings.barn * settings.storage_per_barn;
export const waterCap = (farm, settings) => settings.water_base + farm.buildings.well * settings.water_per_well;
export const inventoryCount = inv => Object.values(inv || {}).reduce((n, v) => n + (Number(v) || 0), 0);
export const score = p => Math.round((p.farm?.level || 1) * 1000 + (p.farm?.xp || 0) + (p.farm?.harvested || 0) * 2);

export function freshFarm(settings, now = Date.now()) {
  return {
    level: 1,
    xp: 0,
    coins: settings.initial_coins,
    plots: Array.from({ length: settings.initial_plots }, (_, i) => ({ id: i, crop: null, plantedAt: 0, readyAt: 0, watered: false, fertilized: false })),
    buildings: { land: 1, barn: 1, well: 1, greenhouse: 0 },
    inventory: Object.fromEntries(Object.keys(CROPS).map(k => [k, 0])),
    fertilizer: 3,
    harvested: 0,
    dailyWater: { day: dayKey(now), used: 0 },
    missions: { day: dayKey(now), progress: { harvest: 0, sell: 0, water: 0 }, claimed: {} },
    orders: { day: dayKey(now), list: [] },
    achievements: {},
  };
}
