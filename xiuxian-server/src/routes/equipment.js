const express = require('express');
const router = express.Router();
const { getDb, saveDb, getRow, getAllRows } = require('../db/init');
const { getOwnedEquipment, requireOwnedRole } = require('../ownership');

/**
 * POST /api/equipment/equip
 * 穿戴装备到槽位
 */
router.post('/api/equipment/equip', async (req, res) => {
  const { equipment_id, slot_type } = req.body || {};
  if (!equipment_id || !slot_type) return res.json({ code: 1001, msg: '缺少参数', data: null });

  await getDb();
  const db = await getDb();
  const equip = getOwnedEquipment(equipment_id, req.playerId);
  if (!equip) return res.json({ code: 3002, msg: '无权操作该装备', data: null });
  if (!Number.isInteger(slot_type) || slot_type < 1 || slot_type > 11) {
    return res.json({ code: 1001, msg: '装备槽位无效', data: null });
  }

  // 卸下该槽位旧装备
  const old = getRow('SELECT * FROM t_equipment WHERE role_id = ? AND slot_type = ?', [equip.role_id, slot_type]);
  if (old) {
    db.run('UPDATE t_equipment SET slot_type = 0 WHERE id = ?', [old.id]);
  }

  // 穿戴上
  db.run('UPDATE t_equipment SET slot_type = ? WHERE id = ?', [slot_type, equipment_id]);

  // 更新属性
  updateCombatPower(db, equip.role_id);
  saveDb();

  return res.json({
    code: 0, msg: 'success',
    data: { equipment_id, slot_type, unequipped_id: old ? old.id : null },
  });
});

/**
 * POST /api/equipment/unequip
 */
router.post('/api/equipment/unequip', async (req, res) => {
  const { slot_type, role_id } = req.body || {};
  if (!slot_type || !role_id) return res.json({ code: 1001, msg: '缺少参数', data: null });

  await getDb();
  if (!requireOwnedRole(res, role_id, req.playerId)) return;
  const db = await getDb();
  const equip = getRow('SELECT * FROM t_equipment WHERE role_id = ? AND slot_type = ?', [role_id, slot_type]);
  if (!equip) return res.json({ code: 3001, msg: '该槽位无装备', data: null });

  db.run('UPDATE t_equipment SET slot_type = 0 WHERE id = ?', [equip.id]);
  updateCombatPower(db, role_id);
  saveDb();

  return res.json({ code: 0, msg: 'success', data: { equipment_id: equip.id } });
});

/**
 * POST /api/equipment/enhance
 * 强化装备
 */
router.post('/api/equipment/enhance', async (req, res) => {
  const { equipment_id } = req.body || {};
  if (!equipment_id) return res.json({ code: 1001, msg: '缺少参数', data: null });

  await getDb();
  const db = await getDb();
  const equip = getOwnedEquipment(equipment_id, req.playerId);
  if (!equip) return res.json({ code: 3002, msg: '无权操作该装备', data: null });

  // 强化消耗（简化版：固定消耗铜板+金）
  const cost = Math.floor((equip.level + 1) * 50);
  const role_res = getRow('SELECT gold, copper FROM t_resource WHERE role_id = ?', [equip.role_id]);
  if (!role_res || role_res.copper < cost) {
    return res.json({ code: 2002, msg: '铜板不足', data: null });
  }

  // 成功率
  const lvl = equip.level + 1;
  let rate = 1;
  if (lvl <= 3) rate = 1;
  else if (lvl <= 5) rate = 0.95;
  else if (lvl <= 8) rate = 0.85;
  else if (lvl <= 10) rate = 0.70;
  else if (lvl <= 12) rate = 0.55;
  else if (lvl <= 15) rate = 0.40;
  else if (lvl <= 18) rate = 0.25;
  else rate = 0.15;

  db.run('UPDATE t_resource SET copper = copper - ? WHERE role_id = ?', [cost, equip.role_id]);

  if (Math.random() < rate) {
    db.run('UPDATE t_equipment SET level = level + 1, update_time = datetime(\'now\',\'localtime\') WHERE id = ?', [equipment_id]);
    updateCombatPower(db, equip.role_id);
    saveDb();
    return res.json({ code: 0, msg: 'success', data: { success: true, new_level: equip.level + 1, cost } });
  } else {
    // 失败惩罚：按策划文档分级
    let penalty;
    if (lvl <= 3) penalty = 0;               // +1~+3 不会失败
    else if (lvl <= 8) penalty = 1;           // +4~+8 降1级
    else if (lvl <= 12) penalty = 2;          // +9~+12 降2级
    else if (lvl <= 15) penalty = 3;          // +13~+15 降3级
    else if (lvl <= 18) penalty = -1;         // +16~+18 装备破碎（设为0级）
    else penalty = -1;                         // +19~+20 装备破碎
    // -1 表示破碎（重置为0级）
    const newLevel = penalty === -1 ? 0 : Math.max(0, equip.level - penalty);
    db.run('UPDATE t_equipment SET level = ? WHERE id = ?', [newLevel, equipment_id]);
    updateCombatPower(db, equip.role_id);
    saveDb();
    return res.json({ code: 0, msg: 'success', data: { success: false, new_level: newLevel, cost, penalty: penalty === -1 ? '破碎' : penalty } });
  }
});

function updateCombatPower(db, roleId) {
  const attrs = getRow('SELECT * FROM t_role_attribute WHERE role_id = ?', [roleId]);
  const role = getRow('SELECT * FROM t_role WHERE id = ?', [roleId]);
  if (!attrs || !role) return;
  const equipped = getAllRows(
    'SELECT base_attrs, level FROM t_equipment WHERE role_id = ? AND slot_type > 0', [roleId]
  );
  let equipBonus = 0;
  for (const e of equipped) {
    try {
      const ba = JSON.parse(e.base_attrs || '{}');
      equipBonus += (ba.strength || 0) + (ba.vitality || 0) + e.level * 5;
    } catch (_) {}
  }
  const base = (attrs.strength + attrs.vitality + attrs.agility + attrs.intelligence + attrs.accuracy + attrs.sense + attrs.wisdom + attrs.luck) * 4;
  const hpPow = attrs.hp * 0.5;
  const cp = Math.floor((base + hpPow + equipBonus) * (1 + role.realm_level * 0.3));
  db.run('UPDATE t_role SET combat_power = ? WHERE id = ?', [cp, roleId]);
}

/**
 * POST /api/resource
 * 获取资源
 */
router.post('/api/resource', async (req, res) => {
  const { role_id } = req.body || {};
  if (!role_id) return res.json({ code: 1001, msg: '缺少 role_id', data: null });
  await getDb();
  if (!requireOwnedRole(res, role_id, req.playerId)) return;
  const r = getRow('SELECT * FROM t_resource WHERE role_id = ?', [role_id]);
  return res.json({ code: 0, msg: 'success', data: r || {} });
});

/**
 * POST /api/shop/buy
 * 购买商品（简化版坊市）
 */
router.post('/api/shop/buy', async (req, res) => {
  const { role_id, item_id, count } = req.body || {};
  if (!role_id || !item_id) return res.json({ code: 1001, msg: '缺少参数', data: null });

  const SHOP = {
    'enhance_stone_10': { name: '强化石x10', cost: 100, currency: 'gold', give: 'enhance_stone', gcnt: 10 },
    'cultivate_book_1': { name: '修为丹x1', cost: 500, currency: 'gold', give: 'cultivate_book', gcnt: 1 },
    'realm_mat_1': { name: '突破材料x1', cost: 200, currency: 'gold', give: 'realm_material_1', gcnt: 1 },
  };

  const item = SHOP[item_id];
  if (!item) return res.json({ code: 3001, msg: '商品不存在', data: null });

  const qty = count || 1;
  if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
    return res.json({ code: 1001, msg: '购买数量必须为1-99的整数', data: null });
  }
  const totalCost = item.cost * qty;

  await getDb();
  if (!requireOwnedRole(res, role_id, req.playerId)) return;
  const db = await getDb();
  const resR = getRow('SELECT gold FROM t_resource WHERE role_id = ?', [role_id]);
  if (!resR || resR.gold < totalCost) {
    return res.json({ code: 2001, msg: '灵石不足', data: null });
  }

  // 使用白名单字段名避免 SQL 注入
  const allowedFields = ['enhance_stone', 'cultivate_book', 'realm_material_1'];
  if (!allowedFields.includes(item.give)) {
    return res.json({ code: 5001, msg: '内部错误', data: null });
  }
  db.run(`UPDATE t_resource SET gold = gold - ?, ${item.give} = ${item.give} + ? WHERE role_id = ?`,
    [totalCost, item.gcnt * qty, role_id]);
  saveDb();

  return res.json({ code: 0, msg: 'success', data: { item: item.name, qty, cost: totalCost } });
});

module.exports = router;
