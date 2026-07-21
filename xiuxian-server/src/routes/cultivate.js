const express = require('express');
const router = express.Router();
const { getDb, saveDb, getRow } = require('../db/init');
const config = require('../config');
const { requireOwnedRole } = require('../ownership');

const MAX_OFFLINE = config.GAME.MAX_OFFLINE_SECONDS;
const OFFLINE_EFF = config.GAME.OFFLINE_EFFICIENCY;
const BASE_SPEED = config.GAME.BASE_CULTIVATE_SPEED;

const REALM_NAMES = [
  '凡人', '练气初期', '练气中期', '练气后期', '练气圆满',
  '筑基初期', '筑基中期', '筑基后期', '筑基圆满',
  '金丹初期', '金丹中期', '金丹后期', '金丹圆满',
  '元婴初期', '元婴中期', '元婴后期', '元婴圆满',
  '化神初期', '化神中期', '化神后期', '化神圆满',
  '炼虚初期', '炼虚中期', '炼虚后期', '炼虚圆满',
  '合道初期', '合道中期', '合道后期', '合道圆满',
  '大乘初期', '大乘中期', '大乘后期', '大乘圆满',
  '渡劫初期', '渡劫中期', '渡劫后期', '渡劫圆满',
];

// 每个大境界突破所需修为（realm_level 到下一层）
// 从 index.js 配置和 PRD 数据来
const EXP_TABLE = [
  100,   // 凡人 →
  2500,  // 练气初期 →
  9500,  // 练气中期 →
  48000, // 练气后期 →
  2780000,// 练气圆满 → 筑基初期 (含筑基初期3层)
  2780000,// 筑基初期 →
  2780000,// 筑基中期 →
  2780000,// 筑基后期 →
  50000000,// 筑基圆满 → 金丹
  50000000,
  50000000,
  50000000,
  400000000,// 金丹圆满 → 元婴
  400000000,
  400000000,
  400000000,
  5000000000,// 元婴圆满 → 化神
  5000000000,
  5000000000,
  5000000000,
  65000000000,// 化神圆满 → 炼虚
  65000000000,
  65000000000,
  65000000000,
  650000000000,// 炼虚圆满 → 合道
  650000000000,
  650000000000,
  650000000000,
  6500000000000,// 合道圆满 → 大乘
  6500000000000,
  6500000000000,
  6500000000000,
  65000000000000,// 大乘圆满 → 渡劫
  65000000000000,
  65000000000000,
  65000000000000,
];

// 每个大境界突破所需破境丹材料ID
function getBreakPill(realmLevel) {
  if (realmLevel < 4) return null;       // 凡人→练气不需要破境丹
  if (realmLevel < 8) return 1;          // 练气破境丹
  if (realmLevel < 12) return 2;         // 筑基破境丹
  if (realmLevel < 16) return 3;         // 金丹破境丹
  if (realmLevel < 20) return 4;         // 元婴破境丹
  if (realmLevel < 24) return 5;         // 化神破境丹
  if (realmLevel < 28) return 6;         // 炼虚破境丹
  if (realmLevel < 32) return 7;         // 合道破境丹
  return 8;                               // 大乘破境丹
}

// 突破基础成功率
function getBaseRate(realmLevel) {
  if (realmLevel <= 3) return 0.95;
  if (realmLevel <= 8) return 0.90;
  if (realmLevel <= 12) return 0.80;
  if (realmLevel <= 16) return 0.70;
  if (realmLevel <= 20) return 0.65;
  if (realmLevel <= 24) return 0.60;
  if (realmLevel <= 28) return 0.55;
  if (realmLevel <= 32) return 0.50;
  return 0.45;
}

// 境界突破属性成长（累加到基础属性上）
function getAttrGrowth(realmLevel) {
  if (realmLevel === 0) return { str: 5, vit: 8, agi: 3, int: 2, acc: 3, sen: 2, wis: 5, luk: 3, hp: 80 };
  if (realmLevel === 1) return { str: 9, vit: 16, agi: 5, int: 4, acc: 6, sen: 3, wis: 3, luk: 0, hp: 120 };
  if (realmLevel === 2) return { str: 13, vit: 24, agi: 8, int: 8, acc: 6, sen: 3, wis: 4, luk: 0, hp: 220 };
  if (realmLevel === 3) return { str: 21, vit: 36, agi: 12, int: 12, acc: 9, sen: 4, wis: 4, luk: 0, hp: 300 };
  if (realmLevel === 4) return { str: 5, vit: 9, agi: 3, int: 3, acc: 3, sen: 2, wis: 2, luk: 0, hp: 80 };
  if (realmLevel >= 5 && realmLevel <= 8) return { str: 30 + (realmLevel - 5) * 15, vit: 50 + (realmLevel - 5) * 25, agi: 15 + (realmLevel - 5) * 5, int: 25 + (realmLevel - 5) * 15, acc: 15 + (realmLevel - 5) * 5, sen: 8 + (realmLevel - 5) * 4, wis: 6 + (realmLevel - 5) * 2, luk: 2 + (realmLevel - 5) * 1, hp: 420 + (realmLevel - 5) * 230 };
  // 金丹及以上用简化公式
  const tier = Math.floor(realmLevel / 4);
  return { str: 30 * tier, vit: 50 * tier, agi: 15 * tier, int: 25 * tier, acc: 15 * tier, sen: 8 * tier, wis: 6 * tier, luk: 2 * tier, hp: 420 * tier };
}

/**
 * POST /api/role/cultivate
 * 在线修炼，返回修为增量
 */
router.post('/api/role/cultivate', async (req, res) => {
  const { role_id } = req.body || {};
  if (!role_id) return res.json({ code: 1001, msg: '缺少 role_id', data: null });

  await getDb();

  const role = requireOwnedRole(res, role_id, req.playerId);
  if (!role) return;

  // 修炼速度
  const attr = getRow('SELECT cultivation_speed FROM t_role_attribute WHERE role_id = ?', [role_id]);
  const speed = attr ? Math.max(attr.cultivation_speed, 1.0) * BASE_SPEED : BASE_SPEED;

  // 每请求加 10 秒修为
  const gain = Math.floor(speed * 10);
  const newExp = role.cultivate_exp + gain;
  role.cultivate_exp = newExp;

  const db = await getDb();
  db.run('UPDATE t_role SET cultivate_exp = ?, total_cultivate_exp = total_cultivate_exp + ?, update_time = datetime(\'now\',\'localtime\') WHERE id = ?',
    [newExp, gain, role_id]);
  saveDb();

  return res.json({
    code: 0, msg: 'success',
    data: {
      cultivate_exp: newExp,
      cultivate_exp_to_next: role.cultivate_exp_to_next,
      gain,
      cultivate_speed: speed,
    },
  });
});

/**
 * POST /api/role/breakthrough
 * 境界突破
 */
router.post('/api/role/breakthrough', async (req, res) => {
  const { role_id } = req.body || {};
  if (!role_id) return res.json({ code: 1001, msg: '缺少 role_id', data: null });

  await getDb();

  const role = requireOwnedRole(res, role_id, req.playerId);
  if (!role) return;

  // 检查修为是否满
  if (role.cultivate_exp < role.cultivate_exp_to_next) {
    return res.json({ code: 3001, msg: '修为不足，无法突破', data: null });
  }

  // 检查是否已达最高
  if (role.realm_level >= 36) {
    return res.json({ code: 3001, msg: '已达最高境界', data: null });
  }

  // 大境界突破需要破境丹（realm_level 末尾需要突破材料）
  // 简化：每4级（大境界切换）检查一次
  const needPill = (role.realm_level > 0 && (role.realm_level + 1) % 4 === 1);
  // 凡人(0)→练气也可以不需要材料。从练气圆满(4)→筑基(5)开始检查
  const needMaterial = role.realm_level >= 4;

  if (needMaterial) {
    const resTable = getRow('SELECT realm_material_1 FROM t_resource WHERE role_id = ?', [role_id]);
    const mat = resTable ? resTable.realm_material_1 : 0;
    if (mat < 5) {
      return res.json({ code: 2003, msg: '突破材料不足（需5个）', data: null });
    }
  }

  // 成功率 = 基础成功率 + 气运加成 + VIP加成
  const attr = getRow('SELECT luck, wisdom FROM t_role_attribute WHERE role_id = ?', [role_id]);
  const player = getRow('SELECT vip_level FROM t_player WHERE id = ?', [role.player_id]);
  const baseRate = getBaseRate(role.realm_level);
  const luckBonus = (attr ? attr.luck : 3) * 0.01;
  const vipBonus = (player ? player.vip_level : 0) * 0.02;
  const successRate = Math.min(baseRate + luckBonus + vipBonus, 1.0);

  const success = Math.random() < successRate;

  const db = await getDb();

  if (success) {
    // 扣除材料
    if (needMaterial) {
      db.run('UPDATE t_resource SET realm_material_1 = realm_material_1 - 5 WHERE role_id = ?', [role_id]);
    }
    if (needPill) {
      db.run('UPDATE t_resource SET realm_material_2 = realm_material_2 - 1 WHERE role_id = ?', [role_id]);
    }

    // 更新境界（累加 total_cultivate_exp 用于排行榜）
    const newRealm = role.realm_level + 1;
    const nextExp = EXP_TABLE[newRealm] || Math.floor(role.cultivate_exp_to_next * 1.5);
    db.run('UPDATE t_role SET realm_level = ?, cultivate_exp = 0, cultivate_exp_to_next = ?, total_cultivate_exp = total_cultivate_exp + ?, update_time = datetime(\'now\',\'localtime\') WHERE id = ?',
      [newRealm, nextExp, role.cultivate_exp, role_id]);

    // 属性成长
    const growth = getAttrGrowth(role.realm_level);
    db.run(
      `UPDATE t_role_attribute SET
       strength = strength + ?, vitality = vitality + ?, agility = agility + ?,
       intelligence = intelligence + ?, accuracy = accuracy + ?, sense = sense + ?,
       wisdom = wisdom + ?, luck = luck + ?, hp = hp + ?, current_hp = current_hp + ?,
       physical_attack = (strength + ?) * 2 + (vitality + ?) * 0.5
       WHERE role_id = ?`,
      [growth.str, growth.vit, growth.agi, growth.int, growth.acc, growth.sen, growth.wis, growth.luk, growth.hp, growth.hp, growth.str, growth.vit, role_id]
    );

    // 重算战力
    const newAttrs = getRow('SELECT * FROM t_role_attribute WHERE role_id = ?', [role_id]);
    const cp = calcCombatPower(newAttrs, newRealm);
    db.run('UPDATE t_role SET combat_power = ? WHERE id = ?', [cp, role_id]);

    saveDb();

    // WebSocket 推送：境界突破成功
    const pushToRole = req.app.get('pushToRole');
    if (pushToRole) {
      pushToRole(role_id, {
        push_cmd: 9002,
        data: {
          type: 'realm_break_success',
          old_realm: { level: role.realm_level, name: REALM_NAMES[role.realm_level] },
          new_realm: { level: newRealm, name: REALM_NAMES[newRealm] || '未知' },
          attribute_bonus: growth,
          combat_power: cp,
        },
      });
    }

    return res.json({
      code: 0, msg: 'success',
      data: {
        success: true,
        old_realm_level: role.realm_level,
        old_realm_name: REALM_NAMES[role.realm_level],
        new_realm_level: newRealm,
        new_realm_name: REALM_NAMES[newRealm] || '未知',
        success_rate: successRate,
        attribute_bonus: growth,
        combat_power: cp,
      },
    });
  } else {
    // 失败：扣除材料（不返还破境丹，返还50%突破材料）、保留80%修为
    if (needMaterial) {
      // 扣5个材料，返还2个（取整向下 = 2）
      const refund = 2;
      const consumed = 5;
      db.run('UPDATE t_resource SET realm_material_1 = realm_material_1 - ? WHERE role_id = ?',
        [consumed - refund, role_id]);
    }
    if (needPill) {
      db.run('UPDATE t_resource SET realm_material_2 = realm_material_2 - 1 WHERE role_id = ?', [role_id]);
    }
    const penaltyExp = Math.floor(role.cultivate_exp * 0.2);
    db.run('UPDATE t_role SET cultivate_exp = cultivate_exp - ? WHERE id = ?', [penaltyExp, role_id]);
    saveDb();

    return res.json({
      code: 0, msg: 'success',
      data: {
        success: false,
        fail_reason: 'break_failed',
        kept_exp: role.cultivate_exp - penaltyExp,
        success_rate: successRate,
        penalty_exp: penaltyExp,
      },
    });
  }
});

function calcCombatPower(attrs, realmLevel) {
  const base = (attrs.strength + attrs.vitality + attrs.agility + attrs.intelligence + attrs.accuracy + attrs.sense + attrs.wisdom + attrs.luck) * 5;
  const hpPow = attrs.hp * 0.5;
  const atkPow = (attrs.physical_attack + attrs.physical_defense) * 3;
  const realmMult = 1 + realmLevel * 0.3;
  return Math.floor((base + hpPow + atkPow) * realmMult);
}

/**
 * POST /api/role/offline_reward
 * 结算离线收益
 */
router.post('/api/role/offline_reward', async (req, res) => {
  const { role_id } = req.body || {};
  if (!role_id) return res.json({ code: 1001, msg: '缺少 role_id', data: null });

  await getDb();

  const role = requireOwnedRole(res, role_id, req.playerId);
  if (!role) return;

  const attr = getRow('SELECT cultivation_speed FROM t_role_attribute WHERE role_id = ?', [role_id]);
  const speed = attr ? Math.max(attr.cultivation_speed, 1.0) * BASE_SPEED : BASE_SPEED;

  // 上次活跃记录
  const lastAfk = getRow(
    `SELECT * FROM t_afk_record WHERE role_id = ? AND status = 0 ORDER BY start_time DESC LIMIT 1`,
    [role_id]
  );

  let offlineSeconds = 0;
  if (lastAfk) {
    // SQLite 存储的是 datetime('now','localtime')，不加 Z 直接解析为本机时间
    const lastTime = Date.parse(lastAfk.start_time.replace(' ', 'T'));
    offlineSeconds = Math.floor((Date.now() - lastTime) / 1000);
  }
  // 没有活跃挂机记录时不给补偿
  if (offlineSeconds <= 0) {
    offlineSeconds = 0;
  }

  const capped = Math.min(Math.max(offlineSeconds, 0), MAX_OFFLINE);
  const gain = Math.floor(speed * capped * OFFLINE_EFF);
  // 离线灵石 = 修为的 10%（打折后），离线铜板 = 修为的 5%
  const goldGain = Math.floor(gain * 0.1);
  const copperGain = Math.floor(gain * 0.05);

  const db = await getDb();
  db.run('UPDATE t_role SET cultivate_exp = cultivate_exp + ?, total_cultivate_exp = total_cultivate_exp + ? WHERE id = ?',
    [gain, gain, role_id]);
  db.run('UPDATE t_resource SET gold = gold + ?, copper = copper + ? WHERE role_id = ?',
    [goldGain, copperGain, role_id]);

  // 关闭旧挂机记录
  if (lastAfk) {
    db.run('UPDATE t_afk_record SET status = 1, end_time = datetime(\'now\',\'localtime\'), total_seconds = ?, earned_exp = ?, earned_gold = ? WHERE id = ?',
      [capped, gain, goldGain, lastAfk.id]);
  }

  saveDb();

  return res.json({
    code: 0, msg: 'success',
    data: {
      offline_seconds: capped,
      cultivate_gain: gain,
      gold_gain: goldGain,
      copper_gain: copperGain,
      cultivate_speed: speed,
    },
  });
});

/**
 * POST /api/role/tick
 * 每1秒自动修炼1次，加1倍基础速度的修为（= 1秒量）
 * 无次数限制，纯后端被动计时
 */
router.post('/api/role/tick', async (req, res) => {
  const { role_id } = req.body || {};
  if (!role_id) return res.json({ code: 1001, msg: '缺少 role_id', data: null });

  await getDb();

  const role = requireOwnedRole(res, role_id, req.playerId);
  if (!role) return;
  if (isRateLimited(role.last_tick_time)) return res.json({ code: 4001, msg: '修炼请求过快', data: null });

  const attr = getRow('SELECT cultivation_speed FROM t_role_attribute WHERE role_id = ?', [role_id]);
  const speed = attr ? Math.max(attr.cultivation_speed, 1.0) * BASE_SPEED : BASE_SPEED;

  // 每 tick = 1 秒量
  const gain = Math.round(speed);
  const newExp = role.cultivate_exp + gain;
  const db = await getDb();
  db.run('UPDATE t_role SET cultivate_exp = ?, total_cultivate_exp = total_cultivate_exp + ?, last_tick_time = datetime(\'now\',\'localtime\'), update_time = datetime(\'now\',\'localtime\') WHERE id = ?',
    [newExp, gain, role_id]);
  saveDb();

  return res.json({
    code: 0, msg: 'success',
    data: {
      cultivate_exp: newExp,
      cultivate_exp_to_next: role.cultivate_exp_to_next,
      gain,
      cultivate_speed: speed,
    },
  });
});

/**
 * POST /api/role/auto_cultivate
 * 自动修炼（加速10倍），消耗次数；次数耗尽后需付费/广告
 */
router.post('/api/role/auto_cultivate', async (req, res) => {
  const { role_id } = req.body || {};
  if (!role_id) return res.json({ code: 1001, msg: '缺少 role_id', data: null });

  await getDb();

  const role = requireOwnedRole(res, role_id, req.playerId);
  if (!role) return;
  if (isRateLimited(role.last_tick_time)) return res.json({ code: 4001, msg: '修炼请求过快', data: null });

  const attr = getRow('SELECT cultivation_speed FROM t_role_attribute WHERE role_id = ?', [role_id]);
  const speed = attr ? Math.max(attr.cultivation_speed, 1.0) * BASE_SPEED : BASE_SPEED;
  const gain = Math.floor(speed * 10);
  const newExp = role.cultivate_exp + gain;
  const db = await getDb();
  db.run('UPDATE t_role SET cultivate_exp = ?, total_cultivate_exp = total_cultivate_exp + ?, last_tick_time = datetime(\'now\',\'localtime\'), update_time = datetime(\'now\',\'localtime\') WHERE id = ?',
    [newExp, gain, role_id]);
  saveDb();

  return res.json({
    code: 0, msg: 'success',
    data: {
      cultivate_exp: newExp,
      cultivate_exp_to_next: role.cultivate_exp_to_next,
      gain,
      cultivate_speed: speed,
    },
  });
});

/**
 * POST /api/role/start_afk
 * 开始挂机
 */
router.post('/api/role/start_afk', async (req, res) => {
  const { role_id } = req.body || {};
  if (!role_id) return res.json({ code: 1001, msg: '缺少 role_id', data: null });

  await getDb();
  const role = requireOwnedRole(res, role_id, req.playerId);
  if (!role) return;

  // 检查是否已在挂机
  const active = getRow('SELECT id FROM t_afk_record WHERE role_id = ? AND status = 0', [role_id]);
  if (active) {
    return res.json({ code: 3001, msg: '已在挂机中', data: null });
  }

  const db = await getDb();
  db.run(
    `INSERT INTO t_afk_record (role_id, map_id, layer, start_time, status)
     VALUES (?, 1, 1, datetime('now','localtime'), 0)`,
    [role_id]
  );
  saveDb();

  return res.json({ code: 0, msg: 'success', data: { started: true } });
});

function isRateLimited(lastTickTime) {
  if (!lastTickTime) return false;
  const ms = Date.parse(lastTickTime.replace(' ', 'T'));
  return Number.isFinite(ms) && Date.now() - ms < 900;
}

module.exports = router;
