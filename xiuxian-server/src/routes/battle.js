const express = require('express');
const router = express.Router();
const { getDb, saveDb, getRow, getAllRows, insert } = require('../db/init');
const { requireOwnedRole } = require('../ownership');

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

// ============================================================
// 战斗引擎
// ============================================================
function executeBattle(player, monster) {
  const log = [];
  let pHp = player.hp, mHp = monster.hp;

  // 暴击率从属性折算
  const critRate = Math.min(player.crit_rate || 0.05, 0.5);
  const critDmg = player.crit_damage || 1.5;
  const pAtk = player.physical_attack || player.strength * 2 || 20;
  const pDef = player.physical_defense || player.vitality || 10;
  const pSpd = player.agility || 10;

  // 先手判定
  const playerFirst = pSpd > monster.speed;

  for (let round = 1; round <= 50; round++) {
    // 每回合双方各攻击一次，先手方先攻
    const attackers = playerFirst ? ['player', 'monster'] : ['monster', 'player'];
    for (const atk of attackers) {
      if (atk === 'player') {
        // 伤害公式：ATK * (1 - DEF/(DEF+500)) 收益递减
        const dmgReduction = monster.def / (monster.def + 500);
        let dmg = pAtk * (1 - dmgReduction);
        const isCrit = Math.random() < critRate;
        if (isCrit) dmg *= critDmg;
        dmg = Math.max(dmg * (0.9 + Math.random() * 0.2), pAtk * 0.1);
        dmg = Math.floor(dmg);
        mHp -= dmg;
        log.push({ round, attacker: '玩家', damage: dmg, isCrit, monsterHp: Math.max(0, mHp) });
        if (mHp <= 0) return { result: 'win', rounds: round, log };
      } else {
        // 怪物伤害：同样用收益递减模型
        const dmgReduction = pDef / (pDef + 500);
        let dmg = monster.atk * (1 - dmgReduction);
        dmg = Math.max(dmg * (0.9 + Math.random() * 0.2), monster.atk * 0.05);
        dmg = Math.floor(dmg);
        pHp -= dmg;
        log.push({ round, attacker: monster.name, damage: dmg, isCrit: false, playerHp: Math.max(0, pHp) });
        if (pHp <= 0) return { result: 'lose', rounds: round, log };
      }
    }
  }

  // 超时
  const pct = mHp / monster.hp;
  return pct < 0.5 ? { result: 'win', rounds: 50, log } : { result: 'timeout', rounds: 50, log };
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

function genEquip(quality, grade) {
  const slotType = 1 + Math.floor(Math.random() * 8); // 1-8 (基础槽位，法宝9-11后续按境界解锁)
  const baseAttrs = {
    strength: Math.floor((3 + quality * 2) * (1 + grade * 0.3)),
    vitality: Math.floor((5 + quality * 3) * (1 + grade * 0.3)),
  };
  const extra = [];
  if (quality >= 3) extra.push({ type: 'crit_rate', value: Math.floor(quality * 0.5) / 100 });
  return {
    slot_type: slotType,
    template_name: QUALITY_NAMES[quality] + SLOT_NAMES[slotType],
    quality,
    level: 0,
    grade,
    base_attrs: JSON.stringify(baseAttrs),
    extra_attrs: JSON.stringify(extra),
    gem_holes: JSON.stringify([]),
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

  // 生成怪物
  const isBoss = (targetLayer === map.bossLayer);
  const monster = genMonster(map_id, targetLayer, isBoss);

  // 执行战斗
  const result = executeBattle(attrs, monster);

  const db = await getDb();

  // 奖励
  let rewards = { exp: 0, gold: 0, equipment: null };
  if (result.result === 'win') {
    // 基础奖励
    const isFirstPass = targetLayer > progress.max_layer;
    let expGain = Math.floor(50 + monster.level * 10 + targetLayer * 5);
    let goldGain = Math.floor(monster.gold || (10 + monster.level * 2 + targetLayer));

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
    }

    // 装备掉落
    if (Math.random() < 0.7) {
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
        rewards.equipment = { id, slot_type: equip.slot_type, name: equip.template_name, quality: equip.quality };
      }
    }
    if (Math.random() < 0.1) {
      const gemType = ['strength', 'vitality', 'agility', 'intelligence'][Math.floor(Math.random() * 4)];
      const id = insert('INSERT INTO t_gem (role_id, gem_type, level) VALUES (?, ?, 1)', [role_id, gemType]);
      rewards.gem = { id, gem_type: gemType, level: 1 };
    }
  } else if (result.result === 'lose') {
    // 失败给安慰奖
    const pitExp = Math.floor(10 + targetLayer);
    const pitGold = Math.floor(5 + targetLayer);
    db.run('UPDATE t_role SET cultivate_exp = cultivate_exp + ? WHERE id = ?', [pitExp, role_id]);
    db.run('UPDATE t_resource SET gold = gold + ? WHERE role_id = ?', [pitGold, role_id]);
    rewards = { exp: pitExp, gold: pitGold };
  }

  saveDb();

  return res.json({
    code: 0, msg: 'success',
    data: {
      result: result.result,
      monster: { name: monster.name, hp: monster.hp, atk: monster.atk, def: monster.def },
      rounds: result.rounds,
      log: result.log,
      rewards,
    },
  });
});

/**
 * GET /api/battle/maps
 * 获取地图列表及进度
 */
router.get('/api/battle/maps', async (req, res) => {
  const roleId = parseInt(req.query.role_id, 10);
  if (!roleId) return res.json({ code: 1001, msg: '缺少 role_id', data: null });

  await getDb();
  if (!requireOwnedRole(res, roleId, req.playerId)) return;
  const progress = getAllRows('SELECT map_id, max_layer FROM t_map_progress WHERE role_id = ?', [roleId]);
  const progressMap = {};
  for (const p of progress) progressMap[p.map_id] = p.max_layer;

  const maps = Object.entries(MAPS).map(([id, m]) => ({
    map_id: parseInt(id),
    name: m.name,
    layers: m.layers,
    unlockRealm: m.unlockRealm,
    bossLayer: m.bossLayer,
    max_layer: progressMap[id] || 0,
  }));

  return res.json({ code: 0, msg: 'success', data: { maps } });
});

module.exports = router;
