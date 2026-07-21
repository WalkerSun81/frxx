const express = require('express');
const router = express.Router();
const { getDb, saveDb, getRow, getAllRows, insert } = require('../db/init');
const { requireOwnedRole } = require('../ownership');

// ============================================================
// 天赋池配置
// ============================================================
const TALENT_POOL = {
  1: [ // 凡品
    { name: '体格健壮', type: 2, attr: 'vitality', value: 3 },
    { name: '身手敏捷', type: 2, attr: 'agility', value: 3 },
    { name: '精神饱满', type: 6, attr: 'sense', value: 3 },
    { name: '运气平平', type: 4, attr: 'luck', value: 3 },
    { name: '略有天赋', type: 1, attr: 'strength', value: 3 },
  ],
  2: [ // 良品
    { name: '钢筋铁骨', type: 2, attr: 'vitality', value: 8 },
    { name: '疾如风', type: 2, attr: 'agility', value: 8 },
    { name: '明镜止水', type: 6, attr: 'sense', value: 8 },
    { name: '小有福缘', type: 4, attr: 'luck', value: 8 },
    { name: '力能扛鼎', type: 1, attr: 'strength', value: 8 },
  ],
  3: [ // 优品
    { name: '铜皮铁骨', type: 2, attr: 'vitality', value: 15 },
    { name: '静如处子', type: 2, attr: 'agility', value: 15 },
    { name: '心如止水', type: 6, attr: 'sense', value: 15 },
    { name: '福缘深厚', type: 4, attr: 'luck', value: 15 },
    { name: '力大无穷', type: 1, attr: 'strength', value: 15 },
  ],
  4: [ // 极品
    { name: '金刚不坏', type: 2, attr: 'vitality', value: 25, passive: '受伤-5%' },
    { name: '动如脱兔', type: 2, attr: 'agility', value: 25, passive: '速度+8%' },
    { name: '洞察天机', type: 6, attr: 'sense', value: 25, passive: '暴击+5%' },
    { name: '天选之人', type: 4, attr: 'luck', value: 25, passive: '稀有掉落+15%' },
    { name: '天生神力', type: 1, attr: 'strength', value: 25, passive: '攻击+10%' },
  ],
  5: [ // 仙品
    { name: '不灭金身', type: 2, attr: 'vitality', value: 45, passive: '受伤-10%' },
    { name: '瞬步千里', type: 2, attr: 'agility', value: 45, passive: '速度+15%' },
    { name: '神算无遗', type: 6, attr: 'sense', value: 45, passive: '识破+10%' },
    { name: '天命所归', type: 4, attr: 'luck', value: 45, passive: '稀有掉落+25%' },
    { name: '力破苍穹', type: 1, attr: 'strength', value: 45, passive: '攻击+20%' },
  ],
  6: [ // 神品
    { name: '不死之身', type: 5, attr: 'vitality', value: 100, passive: '复活(每日1次)' },
    { name: '浴火重生', type: 5, attr: 'vitality', value: 100, passive: '死亡时恢复50%气血' },
    { name: '万法不侵', type: 2, attr: 'vitality', value: 100, passive: '受伤-20%' },
    { name: '行天道', type: 4, attr: 'luck', value: 100, passive: '全属性+5%' },
    { name: '悟道者', type: 3, attr: 'wisdom', value: 100, passive: '修炼+25%' },
  ],
};

const QUALITY_WEIGHTS = [0, 40, 30, 15, 10, 4, 1];  // index=quality, 总和=100

function weightedRandomQuality() {
  const total = QUALITY_WEIGHTS.reduce((a, b) => a + b, 0);
  let rand = Math.ceil(Math.random() * total);
  for (let q = 1; q <= 6; q++) {
    rand -= QUALITY_WEIGHTS[q];
    if (rand <= 0) return q;
  }
  return 1;
}

function generateTalent(slotIndex) {
  const quality = weightedRandomQuality();
  const pool = TALENT_POOL[quality];
  const t = pool[Math.floor(Math.random() * pool.length)];
  return {
    slot_index: slotIndex,
    talent_type: t.type,
    quality,
    value: t.value,
    talent_name: t.name,
    passive: t.passive || null,
    active: 1,
  };
}

/**
 * POST /api/talent/random
 * 为指定角色生成5个命格天赋
 */
router.post('/api/talent/random', async (req, res) => {
  const { role_id } = req.body || {};
  if (!role_id) {
    return res.json({ code: 1001, msg: '缺少 role_id', data: null });
  }

  await getDb();

  if (!requireOwnedRole(res, role_id, req.playerId)) return;

  // 生成5个天赋
  const talents = [];
  for (let i = 0; i < 5; i++) {
    talents.push(generateTalent(i));
  }
  const db = await getDb();
  db.run(
    `INSERT INTO t_talent_preview (role_id, talents, update_time) VALUES (?, ?, datetime('now','localtime'))
     ON CONFLICT(role_id) DO UPDATE SET talents = excluded.talents, update_time = excluded.update_time`,
    [role_id, JSON.stringify(talents)]
  );
  saveDb();

  // 计算羁绊
  const qualities = talents.map((t) => t.quality);
  const fetters = [];

  // 天道：五彩斑斓 — 5种品质各不相同
  if (new Set(qualities).size === 5) {
    fetters.push({ name: '五彩斑斓', category: '天道', effect: '全属性+5%' });
  }
  // 天道：五行归一 — 5种品质完全相同
  if (qualities.every((q) => q === qualities[0])) {
    fetters.push({ name: '五行归一', category: '天道', effect: '修炼速度+15%' });
  }
  // 天道：道法自然 — 有凡品+(仙品或神品)
  if (qualities.includes(1) && (qualities.includes(5) || qualities.includes(6))) {
    fetters.push({ name: '道法自然', category: '天道', effect: '修炼速度+10%' });
  }
  // 地道：紫气东来 — 极品以上(4/5/6) >= 3
  if (qualities.filter((q) => q >= 4).length >= 3) {
    fetters.push({ name: '紫气东来', category: '地道', effect: '暴击+5%, 全属性+2%' });
  }
  // 地道：草根崛起 — 凡品/良品 >= 3
  if (qualities.filter((q) => q <= 2).length >= 3) {
    fetters.push({ name: '草根崛起', category: '地道', effect: '气血+10%, 防御+8%' });
  }
  // 人道：根据天赋类型判断
  const types = talents.map((t) => t.talent_type);
  if (types.filter((t) => t === 1).length >= 3) {
    fetters.push({ name: '战意凝形', category: '人道', effect: '暴击+5%, 攻击+8%' });
  }
  if (types.filter((t) => t === 3).length >= 3) {
    // type 3 = 修炼型 (wisdom相关)
    fetters.push({ name: '道法精修', category: '人道', effect: '修炼+8%, 悟性+6%' });
  }
  if (types.filter((t) => t === 4).length >= 3) {
    fetters.push({ name: '命运之子', category: '人道', effect: '气运+8%' });
  }
  if (types.filter((t) => t === 2 || t === 5).length >= 3) {
    fetters.push({ name: '不动如山', category: '人道', effect: '气血+8%, 防御+6%' });
  }

  return res.json({
    code: 0,
    msg: 'success',
    data: { talents, fetters },
  });
});

/**
 * POST /api/talent/confirm
 * 确认命格，写入数据库
 */
router.post('/api/talent/confirm', async (req, res) => {
  const { role_id } = req.body || {};
  if (!role_id) {
    return res.json({ code: 1001, msg: '参数错误', data: null });
  }

  await getDb();
  if (!requireOwnedRole(res, role_id, req.playerId)) return;

  const preview = getRow('SELECT talents FROM t_talent_preview WHERE role_id = ?', [role_id]);
  if (!preview) return res.json({ code: 3001, msg: '请先随机命格', data: null });
  const talents = JSON.parse(preview.talents);

  // 检查是否已有确认的命格
  const existing = getAllRows('SELECT id FROM t_talent WHERE role_id = ?', [role_id]);
  if (existing.length > 0) {
    return res.json({ code: 3001, msg: '命格已确认，如需更改请使用重置接口', data: null });
  }

  const db = await getDb();

  for (const t of talents) {
    db.run(
      `INSERT INTO t_talent (role_id, slot_index, talent_type, quality, value, talent_name, passive, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [role_id, t.slot_index, t.talent_type, t.quality, t.value, t.talent_name, t.passive || null]
    );
  }
  db.run('DELETE FROM t_talent_preview WHERE role_id = ?', [role_id]);

  // 应用天赋属性到角色属性表
  const attr = getRow('SELECT * FROM t_role_attribute WHERE role_id = ?', [role_id]);
  if (attr) {
    const bonuses = { strength: 0, vitality: 0, agility: 0, intelligence: 0, accuracy: 0, sense: 0, wisdom: 0, luck: 0 };
    for (const t of talents) {
      const attrName = typeToAttr(t.talent_type);
      if (attrName && bonuses[attrName] !== undefined) {
        bonuses[attrName] += t.value;
      }
    }
    db.run(
      `UPDATE t_role_attribute SET
       strength = strength + ?, vitality = vitality + ?, agility = agility + ?,
       intelligence = intelligence + ?, accuracy = accuracy + ?, sense = sense + ?,
       wisdom = wisdom + ?, luck = luck + ?
       WHERE role_id = ?`,
      [bonuses.strength, bonuses.vitality, bonuses.agility, bonuses.intelligence,
       bonuses.accuracy, bonuses.sense, bonuses.wisdom, bonuses.luck, role_id]
    );
  }

  // 重算战力
  const role = getRow('SELECT * FROM t_role WHERE id = ?', [role_id]);
  const newAttr = getRow('SELECT * FROM t_role_attribute WHERE role_id = ?', [role_id]);
  if (role && newAttr) {
    const base = (newAttr.strength + newAttr.vitality + newAttr.agility + newAttr.intelligence + newAttr.accuracy + newAttr.sense + newAttr.wisdom + newAttr.luck) * 5;
    const hpPow = newAttr.hp * 0.5;
    const atkPow = (newAttr.physical_attack || newAttr.strength * 2) * 3 + (newAttr.physical_defense || 0) * 1;
    const realmMult = 1 + role.realm_level * 0.3;
    const cp = Math.floor((base + hpPow + atkPow) * realmMult);
    db.run('UPDATE t_role SET combat_power = ? WHERE id = ?', [cp, role_id]);
  }

  saveDb();

  return res.json({ code: 0, msg: 'success', data: { confirmed: true } });
});

/**
 * talent_type → attribute 英文名映射
 */
function typeToAttr(type) {
  const map = { 1: 'strength', 2: 'vitality', 3: 'wisdom', 4: 'luck', 5: 'vitality', 6: 'sense' };
  return map[type] || null;
}

module.exports = router;
