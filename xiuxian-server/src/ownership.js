const { getRow } = require('./db/init');

function getOwnedRole(roleId, playerId) {
  return getRow('SELECT * FROM t_role WHERE id = ? AND player_id = ?', [roleId, playerId]);
}

function getOwnedEquipment(equipmentId, playerId) {
  return getRow(
    `SELECT e.* FROM t_equipment e
     JOIN t_role r ON r.id = e.role_id
     WHERE e.id = ? AND r.player_id = ?`,
    [equipmentId, playerId]
  );
}

function requireOwnedRole(res, roleId, playerId) {
  const role = getOwnedRole(roleId, playerId);
  if (!role) {
    const exists = getRow('SELECT id FROM t_role WHERE id = ?', [roleId]);
    res.json({ code: exists ? 3002 : 3001, msg: exists ? '无权操作该角色' : '角色不存在', data: null });
    return null;
  }
  return role;
}

module.exports = { getOwnedRole, getOwnedEquipment, requireOwnedRole };
