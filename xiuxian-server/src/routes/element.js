const express = require('express');
const router = express.Router();
const { getDb, saveDb, getRow, insert } = require('../db/init');
const { requireOwnedRole } = require('../ownership');

const ELEMENT_NAMES = ['金', '木', '水', '火', '土'];

/**
 * 随机生成灵根（五行归一化，总和约束为 100）
 */
function randomElementRoot() {
  const raw = {
    metal: rand(1, 80),
    wood: rand(1, 80),
    water: rand(1, 80),
    fire: rand(1, 80),
    earth: rand(1, 80),
  };
  const keys = ['metal', 'wood', 'water', 'fire', 'earth'];
  const rawSum = keys.reduce((s, k) => s + raw[k], 0);

  // 归一化到总和 100（四舍五入取整，确保非零）
  const values = {};
  let normSum = 0;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (i < keys.length - 1) {
      values[k] = Math.max(1, Math.round(raw[k] / rawSum * 100));
      normSum += values[k];
    } else {
      // 最后一个补齐差值
      values[k] = Math.max(1, 100 - normSum);
    }
  }

  // 找最大值确定主灵根
  let main = 0;
  let maxVal = 0;
  keys.forEach((k, i) => {
    if (values[k] > maxVal) { maxVal = values[k]; main = i + 1; }
  });

  // 计算修炼倍率（基于主灵根值）
  let multiplier;
  if (maxVal >= 70)       multiplier = 2.0;
  else if (maxVal >= 50)  multiplier = 1.7;
  else if (maxVal >= 30)  multiplier = 1.2;
  else                    multiplier = 1.0;

  // 木灵根额外加成
  if (main === 2) multiplier = Math.round((multiplier * 1.1) * 100) / 100;

  return { ...values, main_element: main, cultivate_multiplier: multiplier };
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * POST /api/element/random
 * 随机生成灵根（未确认前可无限调用）
 */
router.post('/api/element/random', async (req, res) => {
  const { role_id } = req.body || {};
  if (!role_id) {
    return res.json({ code: 1001, msg: '缺少 role_id', data: null });
  }

  await getDb();
  if (!requireOwnedRole(res, role_id, req.playerId)) return;

  // 检查是否已确认
  const existing = getRow('SELECT confirmed FROM t_element_root WHERE role_id = ?', [role_id]);
  if (existing && existing.confirmed) {
    return res.json({ code: 3001, msg: '灵根已确认，不可再随机', data: null });
  }

  const root = randomElementRoot();
  const db = await getDb();
  db.run(
    `INSERT INTO t_element_root (role_id, metal, wood, water, fire, earth, main_element, cultivate_multiplier, confirmed)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
     ON CONFLICT(role_id) DO UPDATE SET metal = excluded.metal, wood = excluded.wood, water = excluded.water,
       fire = excluded.fire, earth = excluded.earth, main_element = excluded.main_element,
       cultivate_multiplier = excluded.cultivate_multiplier, update_time = datetime('now','localtime')`,
    [role_id, root.metal, root.wood, root.water, root.fire, root.earth, root.main_element, root.cultivate_multiplier]
  );
  saveDb();

  return res.json({
    code: 0,
    msg: 'success',
    data: {
      metal: root.metal,
      wood: root.wood,
      water: root.water,
      fire: root.fire,
      earth: root.earth,
      main_element: root.main_element,
      main_element_name: ELEMENT_NAMES[root.main_element - 1],
      cultivate_multiplier: root.cultivate_multiplier,
    },
  });
});

/**
 * POST /api/element/confirm
 * 确认灵根，写入数据库，永久锁定
 */
router.post('/api/element/confirm', async (req, res) => {
  const { role_id } = req.body || {};

  if (!role_id) {
    return res.json({ code: 1001, msg: '缺少 role_id', data: null });
  }

  await getDb();
  if (!requireOwnedRole(res, role_id, req.playerId)) return;

  const existing = getRow('SELECT * FROM t_element_root WHERE role_id = ?', [role_id]);
  if (existing && existing.confirmed) {
    return res.json({ code: 3001, msg: '灵根已确认', data: null });
  }

  if (!existing) return res.json({ code: 3001, msg: '请先随机灵根', data: null });
  const { metal, wood, water, fire, earth, main_element, cultivate_multiplier } = existing;
  const db = await getDb();
  db.run('UPDATE t_element_root SET confirmed = 1, update_time = datetime(\'now\',\'localtime\') WHERE role_id = ?', [role_id]);

  // 应用灵根修炼倍率到属性表
  const attr = getRow('SELECT * FROM t_role_attribute WHERE role_id = ?', [role_id]);
  if (attr) {
    db.run('UPDATE t_role_attribute SET cultivation_speed = ? WHERE role_id = ?',
      [cultivate_multiplier, role_id]);
  }

  saveDb();

  return res.json({
    code: 0,
    msg: 'success',
    data: {
      confirmed: true,
      main_element_name: ELEMENT_NAMES[main_element - 1],
      cultivate_multiplier,
    },
  });
});

module.exports = router;
