const express = require('express');
const router = express.Router();
const { getDb, saveDb, getRow, getAllRows, insert } = require('../db/init');
const { requireOwnedRole } = require('../ownership');
const { getProgression } = require('../game/progression');
const { STRATEGIES, SKILLS, normalizeBuild, getBuild, getBuildCatalog } = require('../game/builds');
const { logGameEvent } = require('../game/analytics');

// ============================================================
// 地图配置
// ============================================================
const MAPS = {
  1: { name: '青云村外', unlockRealm: 1, layers: 20, baseLevel: 1, maxQuality: 3, bossLayer: 20,
       boss: { name: '妖狐王', level: 15, hp: 2000, atk: 80, def: 40, spd: 20, gold: 200, equipQ: 3, stone: 5 } },
  2: { name: '落霞山脉', unlockRealm: 2, layers: 20, baseLevel: 12, maxQuality: 4, bossLayer: 20,
       boss: { name: '剑灵王', level: 27, hp: 8000, atk: 200, def: 100, spd: 35, gold: 800, equipQ: 4, stone: 10 } },
  3: { name: '幽冥谷', unlockRealm: 3, layers: 20, baseLevel: 24, maxQuality: 4, bossLayer: 20,
       boss: { name: '幽冥将军', level: 39, hp: 25000, atk: 400, def: 200, spd: 45, gold: 2000, equipQ: 4, stone: 15 } },
  4: { name: '天剑宗', unlockRealm: 5, layers: 20, baseLevel: 36, maxQuality: 5, bossLayer: 20,
       boss: { name: '剑魔', level: 51, hp: 80000, atk: 800, def: 400, spd: 55, gold: 5000, equipQ: 5, stone: 20 } },
  5: { name: '万妖山', unlockRealm: 6, layers: 20, baseLevel: 48, maxQuality: 5, bossLayer: 20,
       boss: { name: '妖皇', level: 63, hp: 250000, atk: 1600, def: 800, spd: 65, gold: 15000, equipQ: 5, stone: 30 } },
  6: { name: '雷泽秘境', unlockRealm: 7, layers: 20, baseLevel: 60, maxQuality: 6, bossLayer: 20,
       boss: { name: '雷兽', level: 78, hp: 800000, atk: 3200, def: 1600, spd: 75, gold: 50000, equipQ: 6, stone: 50 } },
  7: { name: '金丹秘境', unlockRealm: 9, layers: 30, baseLevel: 75, maxQuality: 6, bossLayer: 30,
       boss: { name: '金甲灵王', level: 105, hp: 3000000, atk: 8000, def: 4000, spd: 90, gold: 200000, equipQ: 6, stone: 80 } },
};

const QUALITY_NAMES = ['', '普通', '优秀', '精良', '史诗', '传说', '神话'];
const SLOT_NAMES = ['', '武器', '衣服', '帽子', '手套', '鞋子', '项链', '戒指1', '戒指2', '法宝1', '法宝2', '法宝3'];

// ============================================================
// 怪物生成
// ============================================================
function genMonster(mapId, layer, isBoss) {
  const map = MAPS[mapId];
  const level = map.baseLevel + layer - 1;
  const growth = 1 + (level - 1) * 0.04;

  let attrs = {
    hp: Math.floor(50 * growth),
    atk: Math.floor(10 * growth),
    def: Math.floor(5 * growth),
    speed: Math.floor(8 + growth * 2),
    level,
    name: `${map.name}小妖`,
    gold: Math.floor(3 * growth),
  };

  if (isBoss) {
    attrs = {
      hp: map.boss.hp,
      atk: map.boss.atk,
      def: map.boss.def,
      speed: map.boss.spd,
      level: map.boss.level,
      name: map.boss.name,
      gold: map.boss.gold,
    };
  }

  return attrs;
}

function getEncounter(mapId, layer, isBoss) {
  if (mapId === 1 && isBoss) {
    return {
      type: 'boss', title: '妖狐王 · 月影双相',
      mechanics: [
        { id: 'moon_shield', name: '月影护盾', description: '气血高于50%时减伤，庚金破锋可克制' },
        { id: 'enrage', name: '残月狂怒', description: '气血低于35%后伤害大幅提高，守御与护体功法可应对' },
      ],
      recommended: ['metal_edge', 'stone_skin'],
    };
  }
  if (mapId === 1 && layer === 5) return { type: 'elite', title: '铁甲山魈', mechanics: [{ id: 'iron_hide', name: '铁甲', description: '防御提高，适合使用破防功法' }], recommended: ['metal_edge'] };
  if (mapId === 1 && layer === 10) return { type: 'elite', title: '疾风妖狼', mechanics: [{ id: 'quick', name: '抢攻', description: '速度提高，疾行策略更容易取得先手' }], recommended: ['wind_step'] };
  if (mapId === 1 && layer === 15) return { type: 'elite', title: '蚀骨毒蛛', mechanics: [{ id: 'venom', name: '蚀骨毒', description: '战斗越久伤害越高，需要爆发或恢复' }], recommended: ['flame_burst', 'wood_recovery'] };
  if (isBoss) return { type: 'boss', title: MAPS[mapId].boss.name, mechanics: [{ id: 'enrage', name: '狂怒', description: '低血量时伤害提高' }], recommended: ['stone_skin'] };
  return { type: 'normal', title: `${MAPS[mapId].name}小妖`, mechanics: [], recommended: [] };
}

function getEffectiveStats(roleId, attrs) {
  const effective = { ...attrs };
  const equipped = getAllRows('SELECT base_attrs, extra_attrs, level FROM t_equipment WHERE role_id = ? AND slot_type > 0', [roleId]);
  for (const equip of equipped) {
    let base = {}, extra = [];
    try { base = JSON.parse(equip.base_attrs || '{}'); } catch (_) {}
    try { extra = JSON.parse(equip.extra_attrs || '[]'); } catch (_) {}
    const scale = 1 + Number(equip.level || 0) * 0.08;
    for (const key of ['strength', 'vitality', 'agility', 'intelligence']) {
      effective[key] = Number(effective[key] || 0) + Math.floor(Number(base[key] || 0) * scale);
    }
    for (const affix of extra) {
      if (affix.type === 'crit_rate') effective.crit_rate = Number(effective.crit_rate || 0) + Number(affix.value || 0);
      if (affix.type === 'attack_speed') effective.attack_speed = Number(effective.attack_speed || 1) + Number(affix.value || 0);
      if (affix.type === 'damage_reduce') effective.damage_reduce = Number(effective.damage_reduce || 0) + Number(affix.value || 0);
    }
  }
  return effective;
}

function generateStageWaves(mapId, layer, isBoss, encounter) {
  const normalBase = genMonster(mapId, layer, false);
  const stageBase = isBoss ? genMonster(mapId, layer, true) : normalBase;
  const emptyEncounter = { type: 'normal', title: '普通敌人', mechanics: [], recommended: [] };

  function makeEnemy(base, name, hpScale, atkScale, defScale = 1, enemyEncounter = emptyEncounter) {
    return {
      ...base,
      name,
      hp: Math.max(1, Math.floor(base.hp * hpScale)),
      atk: Math.max(1, Math.floor(base.atk * atkScale)),
      def: Math.max(0, Math.floor(base.def * defScale)),
      encounter: enemyEncounter,
    };
  }

  if (isBoss) {
    return [
      [
        makeEnemy(normalBase, `${MAPS[mapId].name}巡守·一`, 0.75, 0.75),
        makeEnemy(normalBase, `${MAPS[mapId].name}巡守·二`, 0.75, 0.75),
      ],
      [
        makeEnemy(normalBase, `${MAPS[mapId].name}护法·一`, 1.15, 0.95, 1.25),
        makeEnemy(normalBase, `${MAPS[mapId].name}护法·二`, 1.15, 0.95, 1.25),
      ],
      [makeEnemy(stageBase, stageBase.name, 1, 1, 1, encounter)],
    ];
  }

  if (encounter.type === 'elite') {
    const elite = { ...stageBase, name: encounter.title };
    if (encounter.mechanics.some((item) => item.id === 'iron_hide')) elite.def = Math.floor(elite.def * 2.2);
    if (encounter.mechanics.some((item) => item.id === 'quick')) elite.speed = Math.floor(elite.speed * 1.8);
    return [
      [
        makeEnemy(normalBase, `${MAPS[mapId].name}前哨·一`, 0.45, 0.72),
        makeEnemy(normalBase, `${MAPS[mapId].name}前哨·二`, 0.45, 0.72),
      ],
      [
        makeEnemy(normalBase, `${encounter.title}随从·一`, 0.55, 0.82),
        makeEnemy(normalBase, `${encounter.title}随从·二`, 0.55, 0.82),
      ],
      [
        makeEnemy(normalBase, `${encounter.title}亲卫`, 0.45, 0.78),
        makeEnemy(elite, encounter.title, 1, 1, 1, encounter),
      ],
    ];
  }

  return [
    [
      makeEnemy(normalBase, `${normalBase.name}·甲`, 0.32, 0.62),
      makeEnemy(normalBase, `${normalBase.name}·乙`, 0.32, 0.62),
    ],
    [
      makeEnemy(normalBase, `${normalBase.name}·丙`, 0.34, 0.66),
      makeEnemy(normalBase, `${normalBase.name}·丁`, 0.34, 0.66),
    ],
    [
      makeEnemy(normalBase, `${normalBase.name}·戊`, 0.34, 0.68),
      makeEnemy(normalBase, `${normalBase.name}·己`, 0.34, 0.68),
      makeEnemy(normalBase, `${normalBase.name}头目`, 0.52, 0.78, 1.15),
    ],
  ];
}

// ============================================================
// 战斗引擎
// ============================================================
function executeBattle(player, monster, build, mainElement, encounter) {
  const log = [];
  let pHp = player.hp, mHp = monster.hp;
  const maxPlayerHp = pHp;
  const strategy = STRATEGIES[build.strategy];
  const selected = new Set(build.skills);
  const rootBoost = (skillId) => SKILLS[skillId]?.element === mainElement ? 1.15 : 1;

  // 暴击率从属性折算
  const critRate = Math.min((player.crit_rate || 0.05) + (strategy.crit || 0), 0.5);
  const critDmg = player.crit_damage || 1.5;
  const pAtk = ((player.physical_attack || 0) + (player.strength || 10) * 2) * strategy.attack;
  const pDef = (player.physical_defense || 0) + (player.vitality || 10);
  let pSpd = ((player.agility || 10) + (player.attack_speed || 1) * 5) * strategy.speed;
  if (selected.has('wind_step')) pSpd *= 1.2 * rootBoost('wind_step');
  const dodgeRate = selected.has('wind_step') ? 0.08 * rootBoost('wind_step') : 0;
  const hasShield = selected.has('water_shield');
  const hasStone = selected.has('stone_skin');
  const encounterIds = new Set((encounter.mechanics || []).map((item) => item.id));
  let incomingHits = 0;

  // 先手判定
  const playerFirst = pSpd > monster.speed;

  for (let round = 1; round <= 50; round++) {
    // 每回合双方各攻击一次，先手方先攻
    const attackers = playerFirst ? ['player', 'monster'] : ['monster', 'player'];
    for (const atk of attackers) {
      if (atk === 'player') {
        // 伤害公式：ATK * (1 - DEF/(DEF+500)) 收益递减
        const ignoreDef = selected.has('metal_edge') ? 0.20 * rootBoost('metal_edge') : 0;
        const effectiveDef = monster.def * (1 - ignoreDef);
        const dmgReduction = effectiveDef / (effectiveDef + 500);
        let dmg = pAtk * (1 - dmgReduction);
        let skill = null;
        if (selected.has('flame_burst') && round % 3 === 0) {
          dmg *= 1 + 0.35 * rootBoost('flame_burst');
          skill = 'flame_burst';
        }
        if (encounterIds.has('moon_shield') && mHp / monster.hp > 0.5) {
          dmg *= selected.has('metal_edge') ? 0.95 : 0.70;
        }
        const isCrit = Math.random() < critRate;
        if (isCrit) dmg *= critDmg;
        dmg = Math.max(dmg * (0.9 + Math.random() * 0.2), pAtk * 0.1);
        dmg = Math.floor(dmg);
        mHp -= dmg;
        log.push({ round, attacker: '玩家', damage: dmg, isCrit, skill, monsterHp: Math.max(0, mHp) });
        if (mHp <= 0) return { result: 'win', rounds: round, log, playerHp: Math.max(0, pHp), monsterHp: 0 };
      } else {
        if (Math.random() < dodgeRate) {
          log.push({ round, attacker: monster.name, damage: 0, dodged: true, playerHp: Math.max(0, pHp) });
          continue;
        }
        // 怪物伤害：同样用收益递减模型
        const dmgReduction = pDef / (pDef + 500);
        let monsterAttack = monster.atk;
        if (encounterIds.has('enrage') && mHp / monster.hp <= 0.35) monsterAttack *= 1.5;
        if (encounterIds.has('venom')) monsterAttack *= 1 + Math.max(0, round - 1) * 0.06;
        let dmg = monsterAttack * (1 - dmgReduction) * strategy.incoming;
        if (hasStone) dmg *= 1 - 0.12 * rootBoost('stone_skin');
        if (hasShield && incomingHits < 2) dmg *= 1 - 0.30 * rootBoost('water_shield');
        dmg *= 1 - Math.min(Number(player.damage_reduce || 0), 0.35);
        dmg = Math.max(dmg * (0.9 + Math.random() * 0.2), monster.atk * 0.05);
        dmg = Math.floor(dmg);
        pHp -= dmg;
        incomingHits++;
        log.push({ round, attacker: monster.name, damage: dmg, isCrit: false, playerHp: Math.max(0, pHp) });
        if (pHp <= 0) return { result: 'lose', rounds: round, log, playerHp: 0, monsterHp: Math.max(0, mHp) };
      }
    }

    if (selected.has('wood_recovery') && round % 3 === 0 && pHp > 0 && pHp < maxPlayerHp) {
      const heal = Math.max(1, Math.floor(maxPlayerHp * 0.04 * rootBoost('wood_recovery')));
      pHp = Math.min(maxPlayerHp, pHp + heal);
      log.push({ round, attacker: '玩家', heal, skill: 'wood_recovery', playerHp: pHp });
    }
  }

  // 超时
  const pct = mHp / monster.hp;
  return pct < 0.5
    ? { result: 'win', rounds: 50, log, playerHp: Math.max(0, pHp), monsterHp: Math.max(0, mHp) }
    : { result: 'timeout', rounds: 50, log, playerHp: Math.max(0, pHp), monsterHp: Math.max(0, mHp) };
}

function executeStage(player, waves, build, mainElement) {
  const log = [];
  let playerHp = Number(player.hp || 1);
  let totalRounds = 0;
  let defeatedCount = 0;

  for (let waveIndex = 0; waveIndex < waves.length; waveIndex++) {
    const enemies = waves[waveIndex];
    for (let enemyIndex = 0; enemyIndex < enemies.length; enemyIndex++) {
      const monster = enemies[enemyIndex];
      const battle = executeBattle({ ...player, hp: playerHp }, monster, build, mainElement, monster.encounter);
      totalRounds += battle.rounds;
      log.push(...battle.log.map((item) => ({
        ...item,
        wave: waveIndex + 1,
        waveCount: waves.length,
        enemy: enemyIndex + 1,
        enemyCount: enemies.length,
        monsterName: monster.name,
        monsterMaxHp: monster.hp,
      })));
      playerHp = battle.playerHp;
      if (battle.result !== 'win') {
        return {
          result: battle.result,
          rounds: totalRounds,
          log,
          playerHp,
          defeatedCount,
          failedWave: waveIndex + 1,
          failedEnemy: enemyIndex + 1,
          currentMonster: monster,
        };
      }
      defeatedCount++;
    }
  }

  return {
    result: 'win', rounds: totalRounds, log, playerHp, defeatedCount,
    failedWave: null, failedEnemy: null,
    currentMonster: waves[waves.length - 1][waves[waves.length - 1].length - 1],
  };
}

// ============================================================
// 掉落生成
// ============================================================
function rollQuality(dropTable) {
  const r = Math.random();
  let cum = 0;
  for (let q = 1; q <= 6; q++) {
    cum += (dropTable[q] || 0);
    if (r < cum) return q;
  }
  return 1;
}

function genEquip(quality, grade, forcedArchetype) {
  const slotType = 1 + Math.floor(Math.random() * 8); // 1-8 (基础槽位，法宝9-11后续按境界解锁)
  const archetypes = ['burst', 'survival', 'swift'];
  const archetype = forcedArchetype && archetypes.includes(forcedArchetype)
    ? forcedArchetype
    : archetypes[Math.floor(Math.random() * archetypes.length)];
  const scale = 1 + grade * 0.3;
  const baseAttrs = archetype === 'burst'
    ? { strength: Math.floor((5 + quality * 3) * scale), vitality: Math.floor((2 + quality) * scale) }
    : archetype === 'survival'
      ? { strength: Math.floor((2 + quality) * scale), vitality: Math.floor((7 + quality * 4) * scale) }
      : { strength: Math.floor((3 + quality * 2) * scale), vitality: Math.floor((3 + quality * 2) * scale), agility: Math.floor((4 + quality * 2) * scale) };
  const extra = [];
  if (quality >= 2 && archetype === 'burst') extra.push({ type: 'crit_rate', value: Math.floor(quality * 0.8) / 100 });
  if (quality >= 2 && archetype === 'survival') extra.push({ type: 'damage_reduce', value: Math.floor(quality * 0.6) / 100 });
  if (quality >= 2 && archetype === 'swift') extra.push({ type: 'attack_speed', value: Math.floor(quality * 0.8) / 100 });
  return {
    slot_type: slotType,
    template_name: QUALITY_NAMES[quality] + SLOT_NAMES[slotType],
    quality,
    level: 0,
    grade,
    base_attrs: JSON.stringify(baseAttrs),
    extra_attrs: JSON.stringify(extra),
    gem_holes: JSON.stringify([]),
    archetype,
  };
}

// ============================================================
// POST /api/battle/challenge
// ============================================================
router.post('/api/battle/challenge', async (req, res) => {
  const { role_id, map_id, layer } = req.body || {};
  if (!role_id || !map_id) return res.json({ code: 1001, msg: '缺少参数', data: null });

  await getDb();

  const role = requireOwnedRole(res, role_id, req.playerId);
  if (!role) return;

  const map = MAPS[map_id];
  if (!map) return res.json({ code: 3001, msg: '地图不存在', data: null });

  // 检查地图解锁
  if (role.realm_level < map.unlockRealm) {
    return res.json({ code: 3001, msg: '境界不足，未解锁此地图', data: null });
  }

  // 获取或创建地图进度
  let progress = getRow('SELECT * FROM t_map_progress WHERE role_id = ? AND map_id = ?', [role_id, map_id]);
  if (!progress) {
    const db = await getDb();
    db.run('INSERT INTO t_map_progress (role_id, map_id, max_layer, daily_pass_count, daily_reset_time) VALUES (?, ?, 0, 0, date(\'now\'))', [role_id, map_id]);
    saveDb();
    progress = { max_layer: 0, daily_pass_count: 0 };
  }

  const targetLayer = layer || (progress.max_layer + 1);
  if (targetLayer > progress.max_layer + 1) {
    return res.json({ code: 3001, msg: '请先通关前置层数', data: null });
  }
  if (targetLayer > map.layers) {
    return res.json({ code: 3001, msg: '已是本地图最高层', data: null });
  }

  // 获取角色属性
  const attrs = getRow('SELECT * FROM t_role_attribute WHERE role_id = ?', [role_id]);
  if (!attrs) return res.json({ code: 3001, msg: '角色属性缺失', data: null });
  const effectiveAttrs = getEffectiveStats(role_id, attrs);
  const build = getBuild(role_id, getRow);
  const element = getRow('SELECT main_element FROM t_element_root WHERE role_id = ?', [role_id]);

  // 生成整层多波敌人
  const isBoss = (targetLayer === map.bossLayer);
  const encounter = getEncounter(Number(map_id), targetLayer, isBoss);
  const waves = generateStageWaves(Number(map_id), targetLayer, isBoss, encounter);

  // 执行战斗，玩家气血在同一层所有波次与敌人之间继承。
  const result = executeStage(effectiveAttrs, waves, build, Number(element?.main_element || 0));
  const monster = result.currentMonster;

  const db = await getDb();

  // 奖励
  let rewards = { exp: 0, gold: 0, equipment: null, breakthrough_material: 0, enhance_stone: 0 };
  if (result.result === 'win') {
    // 基础奖励
    const isFirstPass = targetLayer > progress.max_layer;
    let expGain = Math.floor(50 + monster.level * 10 + targetLayer * 5 + result.defeatedCount * 8);
    let goldGain = Math.floor((monster.gold || (10 + monster.level * 2 + targetLayer)) + result.defeatedCount * 2);

    // 首次通关额外奖励
    if (isFirstPass) {
      const bonusExp = Math.floor(expGain * 0.5);
      const bonusGold = Math.floor(goldGain * 0.5);
      expGain += bonusExp;
      goldGain += bonusGold;
    }

    db.run('UPDATE t_role SET cultivate_exp = cultivate_exp + ?, total_cultivate_exp = total_cultivate_exp + ? WHERE id = ?',
      [expGain, expGain, role_id]);
    db.run('UPDATE t_resource SET gold = gold + ?, copper = copper + ? WHERE role_id = ?',
      [goldGain, Math.floor(goldGain * 0.5), role_id]);

    rewards = { exp: expGain, gold: goldGain, first_pass_bonus: isFirstPass };

    // 更新进度
    if (isFirstPass) {
      db.run('UPDATE t_map_progress SET max_layer = ?, update_time = datetime(\'now\',\'localtime\') WHERE role_id = ? AND map_id = ?',
        [targetLayer, role_id, map_id]);

      if (targetLayer % 5 === 0) {
        const stoneGain = isBoss ? Number(map.boss.stone || 5) : 2;
        db.run('UPDATE t_resource SET enhance_stone = enhance_stone + ? WHERE role_id = ?', [stoneGain, role_id]);
        rewards.enhance_stone = stoneGain;
      }
      if (isBoss) {
        db.run('UPDATE t_resource SET realm_material_1 = realm_material_1 + 5 WHERE role_id = ?', [role_id]);
        rewards.breakthrough_material = 5;
      }
      if (targetLayer % 5 === 0) {
        const choiceQuality = Math.min(map.maxQuality, isBoss ? 3 : 2);
        const grade = Math.max(1, Math.floor(map.baseLevel / 5));
        const options = ['burst', 'survival', 'swift'].map((route) => genEquip(choiceQuality, grade, route));
        const choiceId = insert(
          'INSERT INTO t_reward_choice (role_id, map_id, layer, options) VALUES (?, ?, ?, ?)',
          [role_id, Number(map_id), targetLayer, JSON.stringify(options)]
        );
        rewards.reward_choice = {
          choice_id: choiceId,
          options: options.map((item, index) => ({
            index, name: item.template_name, quality: item.quality, slot_type: item.slot_type,
            archetype: item.archetype, base_attrs: JSON.parse(item.base_attrs), extra_attrs: JSON.parse(item.extra_attrs),
          })),
        };
      }
    }

    // 装备掉落
    if (!(isFirstPass && targetLayer % 5 === 0) && Math.random() < 0.7) {
      const dropTable = {
        1: isBoss ? 0 : 0.70,
        2: isBoss ? 0.10 : 0.25,
        3: isBoss ? 0.25 : 0.05,
      };
      if (map.maxQuality >= 4) dropTable[4] = isBoss ? 0.35 : 0.05;
      if (map.maxQuality >= 5) dropTable[5] = isBoss ? 0.25 : 0;
      if (map.maxQuality >= 6) dropTable[6] = isBoss ? 0.05 : 0;

      const q = rollQuality(dropTable);
      if (q <= map.maxQuality) {
        const equip = genEquip(q, Math.max(1, Math.floor(map.baseLevel / 5)));
        const id = insert(
          `INSERT INTO t_equipment (role_id, slot_type, template_name, quality, level, grade, base_attrs, extra_attrs, gem_holes)
           VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)`,
          [role_id, equip.slot_type, equip.template_name, equip.quality, Math.max(1, Math.floor(map.baseLevel / 5)), equip.base_attrs, equip.extra_attrs, equip.gem_holes]
        );
        rewards.equipment = {
          id, slot_type: equip.slot_type, name: equip.template_name, quality: equip.quality,
          archetype: equip.archetype, base_attrs: JSON.parse(equip.base_attrs), extra_attrs: JSON.parse(equip.extra_attrs),
        };
      }
    }
    if (Math.random() < 0.1) {
      const gemType = ['strength', 'vitality', 'agility', 'intelligence'][Math.floor(Math.random() * 4)];
      const id = insert('INSERT INTO t_gem (role_id, gem_type, level) VALUES (?, ?, 1)', [role_id, gemType]);
      rewards.gem = { id, gem_type: gemType, level: 1 };
    }
  } else {
    // 失败给安慰奖
    const pitExp = Math.floor(10 + targetLayer + result.defeatedCount * 3);
    const pitGold = Math.floor(5 + targetLayer + result.defeatedCount);
    db.run('UPDATE t_role SET cultivate_exp = cultivate_exp + ? WHERE id = ?', [pitExp, role_id]);
    db.run('UPDATE t_resource SET gold = gold + ? WHERE role_id = ?', [pitGold, role_id]);
    rewards = { exp: pitExp, gold: pitGold };
  }

  let fallbackLayer = null;
  if (result.result !== 'win') {
    fallbackLayer = Math.max(0, targetLayer - 1);
    db.run(
      'UPDATE t_map_progress SET max_layer = MIN(max_layer, ?), update_time = datetime(\'now\',\'localtime\') WHERE role_id = ? AND map_id = ?',
      [fallbackLayer, role_id, map_id]
    );
  }

  const progression = getProgression(role_id, role.realm_level);
  if (result.result === 'win' && targetLayer > progress.max_layer && targetLayer % 5 === 0) {
    rewards.cultivation_upgrade = {
      multiplier: progression.cultivation_multiplier,
      bonus_percent: targetLayer === map.bossLayer ? 20 : 8,
    };
  }
  const recommendations = result.result === 'win' ? [] : buildRecommendations(build, encounter, result.log, effectiveAttrs, monster);
  logGameEvent(db, role_id, 'battle_result', {
    map_id: Number(map_id), layer: targetLayer, encounter: encounter.type, result: result.result,
    strategy: build.strategy, skills: build.skills, recommendations,
    wave_count: waves.length, defeated_count: result.defeatedCount, failed_wave: result.failedWave, fallback_layer: fallbackLayer,
  });

  saveDb();

  return res.json({
    code: 0, msg: 'success',
    data: {
      result: result.result,
      monster: { name: monster.name, hp: monster.hp, atk: monster.atk, def: monster.def },
      waves: waves.map((wave, index) => ({
        wave: index + 1,
        enemy_count: wave.length,
        enemies: wave.map((enemy) => ({ name: enemy.name, hp: enemy.hp, atk: enemy.atk, def: enemy.def })),
      })),
      rounds: result.rounds,
      log: result.log,
      defeated_count: result.defeatedCount,
      failed_wave: result.failedWave,
      failed_enemy: result.failedEnemy,
      fallback_layer: fallbackLayer,
      rewards,
      build,
      encounter,
      progression,
      recommendations,
    },
  });
});

function buildRecommendations(build, encounter, log, player, monster) {
  const selected = new Set(build.skills);
  const recommendations = [];
  for (const skillId of encounter.recommended || []) {
    if (!selected.has(skillId) && SKILLS[skillId]) recommendations.push(`换上「${SKILLS[skillId].name}」应对${encounter.title}`);
  }
  const lastPlayerHit = [...log].reverse().find((item) => item.playerHp != null);
  const lastMonsterHit = [...log].reverse().find((item) => item.monsterHp != null);
  if (lastPlayerHit && lastPlayerHit.playerHp === 0 && build.strategy !== 'guard') recommendations.push('切换「守御」策略降低承伤');
  if (lastMonsterHit && lastMonsterHit.monsterHp > monster.hp * 0.35 && build.strategy !== 'attack') recommendations.push('切换「猛攻」策略提高输出');
  if (Number(player.agility || 0) < Number(monster.speed || 0) && build.strategy !== 'swift') recommendations.push('切换「疾行」策略争取先手');
  if (recommendations.length === 0) recommendations.push('强化当前流派装备，或完成短时闭关后再战');
  return recommendations.slice(0, 3);
}

router.get('/api/battle/reward-choice', async (req, res) => {
  const roleId = parseInt(req.query.role_id, 10);
  if (!roleId) return res.json({ code: 1001, msg: '缺少 role_id', data: null });
  await getDb();
  if (!requireOwnedRole(res, roleId, req.playerId)) return;
  const choice = getRow('SELECT * FROM t_reward_choice WHERE role_id = ? AND status = 0 ORDER BY id DESC LIMIT 1', [roleId]);
  if (!choice) return res.json({ code: 0, msg: 'success', data: { choice: null } });
  let options = [];
  try { options = JSON.parse(choice.options || '[]'); } catch (_) {}
  return res.json({
    code: 0, msg: 'success',
    data: {
      choice: {
        choice_id: choice.id, map_id: choice.map_id, layer: choice.layer,
        options: options.map((item, index) => ({
          index, name: item.template_name, quality: item.quality, slot_type: item.slot_type,
          archetype: item.archetype, base_attrs: JSON.parse(item.base_attrs), extra_attrs: JSON.parse(item.extra_attrs),
        })),
      },
    },
  });
});

router.post('/api/battle/reward-choice', async (req, res) => {
  const { choice_id, option_index } = req.body || {};
  if (!choice_id || !Number.isInteger(option_index)) return res.json({ code: 1001, msg: '缺少奖励选择参数', data: null });
  await getDb();
  const choice = getRow('SELECT * FROM t_reward_choice WHERE id = ? AND status = 0', [choice_id]);
  if (!choice) return res.json({ code: 3001, msg: '奖励已领取或不存在', data: null });
  if (!requireOwnedRole(res, choice.role_id, req.playerId)) return;
  let options = [];
  try { options = JSON.parse(choice.options || '[]'); } catch (_) {}
  const selected = options[option_index];
  if (!selected) return res.json({ code: 1001, msg: '奖励选项无效', data: null });

  const equipmentId = insert(
    `INSERT INTO t_equipment (role_id, slot_type, template_name, quality, level, grade, base_attrs, extra_attrs, gem_holes)
     VALUES (?, 0, ?, ?, 0, ?, ?, ?, ?)`,
    [choice.role_id, selected.template_name, selected.quality, selected.grade, selected.base_attrs, selected.extra_attrs, selected.gem_holes]
  );
  const db = await getDb();
  db.run('UPDATE t_reward_choice SET status = 1 WHERE id = ?', [choice_id]);
  logGameEvent(db, choice.role_id, 'reward_choice', { choice_id, option_index, archetype: selected.archetype });
  saveDb();
  return res.json({
    code: 0, msg: 'success',
    data: {
      equipment: {
        id: equipmentId, name: selected.template_name, quality: selected.quality,
        slot_type: selected.slot_type, archetype: selected.archetype,
        base_attrs: JSON.parse(selected.base_attrs), extra_attrs: JSON.parse(selected.extra_attrs),
      },
    },
  });
});

router.get('/api/battle/build', async (req, res) => {
  const roleId = parseInt(req.query.role_id, 10);
  if (!roleId) return res.json({ code: 1001, msg: '缺少 role_id', data: null });
  await getDb();
  if (!requireOwnedRole(res, roleId, req.playerId)) return;
  return res.json({ code: 0, msg: 'success', data: { build: getBuild(roleId, getRow), catalog: getBuildCatalog() } });
});

router.post('/api/battle/build', async (req, res) => {
  const { role_id, strategy, skills } = req.body || {};
  if (!role_id) return res.json({ code: 1001, msg: '缺少 role_id', data: null });
  await getDb();
  if (!requireOwnedRole(res, role_id, req.playerId)) return;
  if (!STRATEGIES[strategy]) return res.json({ code: 1001, msg: '战前策略无效', data: null });
  if (!Array.isArray(skills) || skills.length !== 3 || new Set(skills).size !== 3 || skills.some((id) => !SKILLS[id])) {
    return res.json({ code: 1001, msg: '请选择3个不同功法', data: null });
  }
  const build = normalizeBuild(strategy, skills);
  const db = await getDb();
  db.run(
    `INSERT INTO t_battle_build (role_id, strategy, skills, update_time) VALUES (?, ?, ?, datetime('now','localtime'))
     ON CONFLICT(role_id) DO UPDATE SET strategy = excluded.strategy, skills = excluded.skills, update_time = excluded.update_time`,
    [role_id, build.strategy, JSON.stringify(build.skills)]
  );
  logGameEvent(db, role_id, 'build_changed', build);
  saveDb();
  return res.json({ code: 0, msg: 'success', data: { build } });
});

/**
 * GET /api/battle/maps
 * 获取地图列表、下一场遭遇与推图带来的修炼效率
 */
router.get('/api/battle/maps', async (req, res) => {
  const roleId = parseInt(req.query.role_id, 10);
  if (!roleId) return res.json({ code: 1001, msg: '缺少 role_id', data: null });

  await getDb();
  const role = requireOwnedRole(res, roleId, req.playerId);
  if (!role) return;
  const progress = getAllRows('SELECT map_id, max_layer FROM t_map_progress WHERE role_id = ?', [roleId]);
  const progressMap = {};
  for (const p of progress) progressMap[p.map_id] = p.max_layer;

  const maps = Object.entries(MAPS).map(([id, m]) => {
    const maxLayer = progressMap[id] || 0;
    const nextLayer = Math.min(maxLayer + 1, m.layers);
    const nextEncounter = getEncounter(Number(id), nextLayer, nextLayer === m.bossLayer);
    const nextWaves = generateStageWaves(Number(id), nextLayer, nextLayer === m.bossLayer, nextEncounter);
    return {
      map_id: parseInt(id),
      name: m.name,
      layers: m.layers,
      unlockRealm: m.unlockRealm,
      bossLayer: m.bossLayer,
      max_layer: maxLayer,
      next_encounter: nextEncounter,
      next_battle: {
        wave_count: nextWaves.length,
        enemy_count: nextWaves.reduce((sum, wave) => sum + wave.length, 0),
        wave_enemy_counts: nextWaves.map((wave) => wave.length),
      },
    };
  });

  return res.json({ code: 0, msg: 'success', data: { maps, progression: getProgression(roleId, role.realm_level) } });
});

module.exports = router;
