const STRATEGIES = {
  attack: { id: 'attack', name: '猛攻', description: '造成伤害+20%，受到伤害+10%', attack: 1.20, incoming: 1.10, speed: 1 },
  guard: { id: 'guard', name: '守御', description: '造成伤害-10%，受到伤害-28%', attack: 0.90, incoming: 0.72, speed: 0.95 },
  swift: { id: 'swift', name: '疾行', description: '速度+35%，暴击率+6%', attack: 0.95, incoming: 1, speed: 1.35, crit: 0.06 },
};

const SKILLS = {
  metal_edge: { id: 'metal_edge', name: '庚金破锋', element: 1, route: '爆发', description: '无视20%防御；克制护盾' },
  wood_recovery: { id: 'wood_recovery', name: '青木回春', element: 2, route: '生存', description: '每3回合恢复4%气血' },
  water_shield: { id: 'water_shield', name: '玄水护体', element: 3, route: '生存', description: '前2次受击伤害降低30%' },
  flame_burst: { id: 'flame_burst', name: '离火爆炎', element: 4, route: '爆发', description: '每3回合额外造成35%伤害' },
  stone_skin: { id: 'stone_skin', name: '厚土诀', element: 5, route: '生存', description: '全程受到伤害降低12%' },
  wind_step: { id: 'wind_step', name: '御风步', element: 0, route: '疾行', description: '速度+20%，闪避率+8%' },
};

const DEFAULT_SKILLS = ['metal_edge', 'wood_recovery', 'stone_skin'];

function normalizeBuild(strategy, skills) {
  const validStrategy = STRATEGIES[strategy] ? strategy : 'attack';
  const source = Array.isArray(skills) ? skills : [];
  const validSkills = [...new Set(source.filter((id) => SKILLS[id]))].slice(0, 3);
  return {
    strategy: validStrategy,
    skills: validSkills.length === 3 ? validSkills : DEFAULT_SKILLS.slice(),
  };
}

function getBuild(roleId, getRow) {
  const row = getRow('SELECT strategy, skills FROM t_battle_build WHERE role_id = ?', [roleId]);
  let skills = [];
  try { skills = JSON.parse(row?.skills || '[]'); } catch (_) {}
  return normalizeBuild(row?.strategy, skills);
}

function getBuildCatalog() {
  return {
    strategies: Object.values(STRATEGIES),
    skills: Object.values(SKILLS),
    max_skill_slots: 3,
  };
}

module.exports = { STRATEGIES, SKILLS, DEFAULT_SKILLS, normalizeBuild, getBuild, getBuildCatalog };
