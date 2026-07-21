const express = require('express');
const router = express.Router();
const { getDb, getRow, insert, saveDb } = require('../db/init');
const { requireOwnedRole } = require('../ownership');

function recoverEnergy(skill) {
  const updated = Date.parse((skill.energy_updated_at || '').replace(' ', 'T'));
  const gained = Number.isFinite(updated) ? Math.floor((Date.now() - updated) / 60000) : 0;
  return Math.min(100, Math.max(0, skill.energy) + Math.max(0, gained));
}

router.get('/api/life/info', async (req, res) => {
  const roleId = parseInt(req.query.role_id, 10);
  if (!roleId) return res.json({ code: 1001, msg: '缺少 role_id', data: null });
  await getDb();
  if (!requireOwnedRole(res, roleId, req.playerId)) return;
  const db = await getDb();
  db.run('INSERT OR IGNORE INTO t_life_skill (role_id) VALUES (?)', [roleId]);
  saveDb();
  const skill = getRow('SELECT * FROM t_life_skill WHERE role_id = ?', [roleId]);
  const energy = recoverEnergy(skill || { energy: 100 });
  return res.json({ code: 0, msg: 'success', data: { ...(skill || {}), energy } });
});

router.post('/api/life/collect', async (req, res) => {
  const { role_id } = req.body || {};
  if (!role_id) return res.json({ code: 1001, msg: '缺少 role_id', data: null });
  await getDb();
  if (!requireOwnedRole(res, role_id, req.playerId)) return;
  const setupDb = await getDb();
  setupDb.run('INSERT OR IGNORE INTO t_life_skill (role_id) VALUES (?)', [role_id]);
  const skill = getRow('SELECT * FROM t_life_skill WHERE role_id = ?', [role_id]);
  const energy = recoverEnergy(skill || { energy: 100 });
  if (energy < 10) return res.json({ code: 2002, msg: '体力不足', data: null });
  const copper = 50 + ((skill?.mining_level || 1) * 10);
  const db = await getDb();
  db.run('UPDATE t_life_skill SET energy = ?, energy_updated_at = datetime(\'now\',\'localtime\') WHERE role_id = ?', [energy - 10, role_id]);
  db.run('UPDATE t_resource SET copper = copper + ? WHERE role_id = ?', [copper, role_id]);
  let gem = null;
  if (Math.random() < 0.2) {
    gem = 'strength';
    insert('INSERT INTO t_gem (role_id, gem_type, level) VALUES (?, ?, 1)', [role_id, gem]);
  }
  saveDb();
  return res.json({ code: 0, msg: 'success', data: { copper, gem, energy: energy - 10 } });
});

router.post('/api/life/craft', async (req, res) => {
  const { role_id } = req.body || {};
  if (!role_id) return res.json({ code: 1001, msg: '缺少 role_id', data: null });
  await getDb();
  if (!requireOwnedRole(res, role_id, req.playerId)) return;
  const resource = getRow('SELECT copper FROM t_resource WHERE role_id = ?', [role_id]);
  if (!resource || resource.copper < 100) return res.json({ code: 2002, msg: '铜板不足', data: null });
  const db = await getDb();
  db.run('UPDATE t_resource SET copper = copper - 100, realm_material_1 = realm_material_1 + 1 WHERE role_id = ?', [role_id]);
  saveDb();
  return res.json({ code: 0, msg: 'success', data: { item: '突破材料', cost: 100 } });
});

module.exports = router;
