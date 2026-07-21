const express = require('express');
const router = express.Router();
const { getDb, getRow, getAllRows, insert, saveDb } = require('../db/init');
const { getOwnedEquipment, requireOwnedRole } = require('../ownership');

function parseHoles(value) {
  try { return JSON.parse(value || '[]'); } catch (_) { return []; }
}

router.get('/api/gem/list', async (req, res) => {
  const roleId = parseInt(req.query.role_id, 10);
  if (!roleId) return res.json({ code: 1001, msg: '缺少 role_id', data: null });
  await getDb();
  if (!requireOwnedRole(res, roleId, req.playerId)) return;
  return res.json({ code: 0, msg: 'success', data: { gems: getAllRows('SELECT * FROM t_gem WHERE role_id = ? ORDER BY level, id', [roleId]) } });
});

router.post('/api/gem/mount', async (req, res) => {
  const { role_id, gem_id, equipment_id, slot_index } = req.body || {};
  if (!role_id || !gem_id || !equipment_id || !Number.isInteger(slot_index)) {
    return res.json({ code: 1001, msg: '参数错误', data: null });
  }
  await getDb();
  if (!requireOwnedRole(res, role_id, req.playerId)) return;
  const gem = getRow('SELECT * FROM t_gem WHERE id = ? AND role_id = ?', [gem_id, role_id]);
  const equipment = getOwnedEquipment(equipment_id, req.playerId);
  if (!gem || !equipment || equipment.role_id !== role_id) return res.json({ code: 3002, msg: '无权操作该宝石或装备', data: null });
  if (gem.equipment_id) return res.json({ code: 3001, msg: '宝石已镶嵌', data: null });
  const holes = parseHoles(equipment.gem_holes);
  if (slot_index < 0 || slot_index >= 3 || holes[slot_index]) return res.json({ code: 3001, msg: '宝石孔不可用', data: null });
  holes[slot_index] = gem.id;
  const db = await getDb();
  db.run('UPDATE t_gem SET equipment_id = ?, slot_index = ? WHERE id = ?', [equipment.id, slot_index, gem.id]);
  db.run('UPDATE t_equipment SET gem_holes = ?, update_time = datetime(\'now\',\'localtime\') WHERE id = ?', [JSON.stringify(holes), equipment.id]);
  saveDb();
  return res.json({ code: 0, msg: 'success', data: { gem_id: gem.id, equipment_id: equipment.id, slot_index } });
});

router.post('/api/gem/unmount', async (req, res) => {
  const { role_id, equipment_id, slot_index } = req.body || {};
  if (!role_id || !equipment_id || !Number.isInteger(slot_index)) return res.json({ code: 1001, msg: '参数错误', data: null });
  await getDb();
  if (!requireOwnedRole(res, role_id, req.playerId)) return;
  const equipment = getOwnedEquipment(equipment_id, req.playerId);
  if (!equipment || equipment.role_id !== role_id) return res.json({ code: 3002, msg: '无权操作该装备', data: null });
  const holes = parseHoles(equipment.gem_holes);
  const gemId = holes[slot_index];
  if (!gemId) return res.json({ code: 3001, msg: '该宝石孔为空', data: null });
  holes[slot_index] = null;
  const db = await getDb();
  db.run('UPDATE t_gem SET equipment_id = NULL, slot_index = NULL WHERE id = ? AND role_id = ?', [gemId, role_id]);
  db.run('UPDATE t_equipment SET gem_holes = ?, update_time = datetime(\'now\',\'localtime\') WHERE id = ?', [JSON.stringify(holes), equipment.id]);
  saveDb();
  return res.json({ code: 0, msg: 'success', data: { gem_id: gemId } });
});

router.post('/api/gem/compose', async (req, res) => {
  const { role_id, gem_ids } = req.body || {};
  if (!role_id || !Array.isArray(gem_ids) || gem_ids.length !== 3) return res.json({ code: 1001, msg: '需选择三颗宝石', data: null });
  if (new Set(gem_ids).size !== 3) return res.json({ code: 1001, msg: '宝石不能重复', data: null });
  await getDb();
  if (!requireOwnedRole(res, role_id, req.playerId)) return;
  const gems = gem_ids.map((id) => getRow('SELECT * FROM t_gem WHERE id = ? AND role_id = ?', [id, role_id]));
  if (gems.some((gem) => !gem || gem.equipment_id) || new Set(gems.map((gem) => `${gem.gem_type}:${gem.level}`)).size !== 1) {
    return res.json({ code: 3001, msg: '请选择三颗同类型、同等级且未镶嵌的宝石', data: null });
  }
  const [source] = gems;
  const db = await getDb();
  db.run(`DELETE FROM t_gem WHERE id IN (${gem_ids.map(() => '?').join(',')})`, gem_ids);
  const gemId = insert('INSERT INTO t_gem (role_id, gem_type, level) VALUES (?, ?, ?)', [role_id, source.gem_type, source.level + 1]);
  saveDb();
  return res.json({ code: 0, msg: 'success', data: { gem_id: gemId, gem_type: source.gem_type, level: source.level + 1 } });
});

module.exports = router;
