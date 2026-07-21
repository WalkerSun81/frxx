const { getAllRows } = require('../db/init');

const MAP_RULES = [
  { mapId: 1, name: '青云村外', unlockRealm: 1, layers: 20, bossLayer: 20 },
  { mapId: 2, name: '落霞山脉', unlockRealm: 2, layers: 20, bossLayer: 20 },
  { mapId: 3, name: '幽冥谷', unlockRealm: 3, layers: 20, bossLayer: 20 },
  { mapId: 4, name: '天剑宗', unlockRealm: 5, layers: 20, bossLayer: 20 },
  { mapId: 5, name: '万妖山', unlockRealm: 6, layers: 20, bossLayer: 20 },
  { mapId: 6, name: '雷泽秘境', unlockRealm: 7, layers: 20, bossLayer: 20 },
  { mapId: 7, name: '金丹秘境', unlockRealm: 9, layers: 30, bossLayer: 30 },
];

function getProgression(roleId, realmLevel = 0) {
  const rows = getAllRows('SELECT map_id, max_layer FROM t_map_progress WHERE role_id = ?', [roleId]);
  const progress = new Map(rows.map((row) => [Number(row.map_id), Number(row.max_layer) || 0]));
  let totalCleared = 0;
  let milestoneCount = 0;
  let bossClears = 0;

  for (const map of MAP_RULES) {
    const cleared = progress.get(map.mapId) || 0;
    totalCleared += cleared;
    milestoneCount += Math.floor(cleared / 5);
    if (cleared >= map.bossLayer) bossClears++;
  }

  const multiplier = Number((1 + milestoneCount * 0.08 + bossClears * 0.12).toFixed(2));
  const activeMap = MAP_RULES.find((map) => realmLevel >= map.unlockRealm && (progress.get(map.mapId) || 0) < map.layers)
    || MAP_RULES.filter((map) => realmLevel >= map.unlockRealm).pop()
    || MAP_RULES[0];
  const currentLayer = progress.get(activeMap.mapId) || 0;
  const nextLayer = Math.min(currentLayer + 1, activeMap.layers);
  const milestoneLayer = [5, 10, 15, 20, 25, 30].find((layer) => layer > currentLayer && layer <= activeMap.layers) || activeMap.layers;
  const isBossMilestone = milestoneLayer === activeMap.bossLayer;

  const needsFirstBreakthrough = realmLevel < MAP_RULES[0].unlockRealm;

  return {
    total_cleared: totalCleared,
    milestone_count: milestoneCount,
    boss_clears: bossClears,
    cultivation_multiplier: multiplier,
    cultivation_bonus_percent: Math.round((multiplier - 1) * 100),
    current_goal: {
      type: needsFirstBreakthrough ? 'breakthrough' : 'battle',
      map_id: activeMap.mapId,
      map_name: activeMap.name,
      layer: nextLayer,
      label: needsFirstBreakthrough ? '突破至练气初期，解锁青云村外' : `挑战${activeMap.name}第${nextLayer}层`,
    },
    next_milestone: {
      map_id: activeMap.mapId,
      map_name: activeMap.name,
      layer: milestoneLayer,
      bonus_percent: 8 + (isBossMilestone ? 12 : 0),
      is_boss: isBossMilestone,
    },
  };
}

module.exports = { MAP_RULES, getProgression };
