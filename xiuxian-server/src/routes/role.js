const express = require('express');
const router = express.Router();
const { getDb, saveDb, getRow, getAllRows, insert } = require('../db/init');
const config = require('../config');
const { requireOwnedRole } = require('../ownership');

const G = config.GAME;

/**
 * POST /api/role/create
 * 创建角色
 */
router.post('/api/role/create', async (req, res) => {
  const { name } = req.body || {};
  const playerId = req.playerId;

  // 校验
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.json({ code: 1001, msg: '角色名不能为空', data: null });
  }
  const clean = name.trim();
  if (clean.length < G.ROLE_NAME_MIN || clean.length > G.ROLE_NAME_MAX) {
    return res.json({ code: 1001, msg: `角色名需${G.ROLE_NAME_MIN}-${G.ROLE_NAME_MAX}个字符`, data: null });
  }

  await getDb();

  // 检查角色数上限
  const count = getRow('SELECT COUNT(*) as c FROM t_role WHERE player_id = ?', [playerId]);
  if (count.c >= G.MAX_ROLES_PER_PLAYER) {
    return res.json({ code: 3001, msg: `最多创建${G.MAX_ROLES_PER_PLAYER}个角色`, data: null });
  }

  // 检查重名
  const exist = getRow('SELECT id FROM t_role WHERE name = ?', [clean]);
  if (exist) {
    return res.json({ code: 3001, msg: '角色名已被使用', data: null });
  }

  // 创建角色
  const roleId = insert(
    `INSERT INTO t_role (player_id, name, realm_level, realm_sub_level, cultivate_exp, cultivate_exp_to_next)
     VALUES (?, ?, 0, 1, 0, ?)`,
    [playerId, clean, 100]
  );

  // 初始化属性
  const db = await getDb();
  db.run(
    `INSERT INTO t_role_attribute (role_id, strength, vitality, agility, intelligence, accuracy, sense, wisdom, luck,
       hp, current_hp, mp, current_mp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 100, 100, 100, 100)`,
    [roleId, 10, 10, 10, 10, 10, 10, 10, 10]
  );

  // 初始化资源
  db.run(
    `INSERT INTO t_resource (role_id, gold, copper, cultivate_book, enhance_stone)
     VALUES (?, ?, ?, ?, ?)`,
    [roleId, G.INIT_GOLD, G.INIT_COPPER, G.INIT_CULTIVATE_BOOK, G.INIT_ENHANCE_STONE]
  );
  db.run('INSERT INTO t_life_skill (role_id) VALUES (?)', [roleId]);

  saveDb();

  return res.json({
    code: 0,
    msg: 'success',
    data: {
      role_id: roleId,
      name: clean,
      realm_level: 0,
      realm_name: '凡人',
      attributes: { ...G.BASE_ATTRS },
      resources: {
        gold: G.INIT_GOLD,
        copper: G.INIT_COPPER,
        cultivate_book: G.INIT_CULTIVATE_BOOK,
        enhance_stone: G.INIT_ENHANCE_STONE,
      },
    },
  });
});

/**
 * GET /api/role/info
 * 获取角色完整信息
 */
router.get('/api/role/info', async (req, res) => {
  const roleId = parseInt(req.query.role_id, 10);
  if (!roleId) {
    return res.json({ code: 1001, msg: '缺少 role_id', data: null });
  }

  await getDb();

  const role = requireOwnedRole(res, roleId, req.playerId);
  if (!role) return;

  const attrs = getRow('SELECT * FROM t_role_attribute WHERE role_id = ?', [roleId]) || {};
  const element = getRow('SELECT * FROM t_element_root WHERE role_id = ?', [roleId]);
  const talents = getAllRows('SELECT * FROM t_talent WHERE role_id = ? ORDER BY slot_index', [roleId]);
  const equipped = getAllRows(
    `SELECT id, slot_type, template_name, quality, level, base_attrs, extra_attrs, gem_holes FROM t_equipment
     WHERE role_id = ? AND slot_type >= 0`,
    [roleId]
  );
  const resources = getRow('SELECT * FROM t_resource WHERE role_id = ?', [roleId]) || {};

  // 境界名称映射
  const realmNames = [
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

  return res.json({
    code: 0,
    msg: 'success',
    data: {
      basic: {
        role_id: role.id,
        name: role.name,
        realm_level: role.realm_level,
        realm_name: realmNames[role.realm_level] || '未知',
        realm_sub_level: role.realm_sub_level,
        cultivate_exp: role.cultivate_exp,
        cultivate_exp_to_next: role.cultivate_exp_to_next,
        combat_power: role.combat_power,
        create_time: role.create_time,
      },
      attributes: {
        strength: attrs.strength, vitality: attrs.vitality,
        agility: attrs.agility, intelligence: attrs.intelligence,
        accuracy: attrs.accuracy, sense: attrs.sense,
        wisdom: attrs.wisdom, luck: attrs.luck,
        hp: attrs.hp, current_hp: attrs.current_hp,
        mp: attrs.mp, current_mp: attrs.current_mp,
        physical_attack: attrs.physical_attack, physical_defense: attrs.physical_defense,
        magical_attack: attrs.magical_attack, magical_defense: attrs.magical_defense,
        crit_rate: attrs.crit_rate, crit_damage: attrs.crit_damage,
        dodge_rate: attrs.dodge_rate, hit_rate: attrs.hit_rate,
        attack_speed: attrs.attack_speed,
        cultivation_speed: attrs.cultivation_speed,
      },
      element_root: element || null,
      talents,
      equipment: equipped,
      resources: {
        gold: resources.gold || 0,
        copper: resources.copper || 0,
        medal_stone: resources.medal_stone || 0,
        cultivate_book: resources.cultivate_book || 0,
        enhance_stone: resources.enhance_stone || 0,
        auto_cultivate_count: resources.realm_contribution || 0,
      },
    },
  });
});

module.exports = router;
