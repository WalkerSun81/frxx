const express = require('express');
const router = express.Router();
const { getDb, saveDb, getRow, getAllRows, insert } = require('../db/init');
const config = require('../config');
const jwt = require('jsonwebtoken');

/**
 * POST /api/login
 * 游客登录 — 用设备ID自动注册/登录
 */
router.post('/api/login', async (req, res) => {
  const { device_id } = req.body || {};

  if (!device_id) {
    return res.json({ code: 1001, msg: '缺少 device_id', data: null });
  }

  await getDb();
  const openid = `guest:${device_id}`;

  // 查找或创建玩家
  let player = getRow('SELECT * FROM t_player WHERE openid = ?', [openid]);
  if (!player) {
    const id = insert(
      'INSERT INTO t_player (openid, platform, nickname) VALUES (?, 3, ?)',
      [openid, '无名修士']
    );
    player = getRow('SELECT * FROM t_player WHERE id = ?', [id]);
  }

  // 更新最后登录
  const db = await getDb();
  db.run('UPDATE t_player SET last_login_time = datetime(\'now\',\'localtime\') WHERE id = ?', [player.id]);
  saveDb();

  // 生成 token
  const token = jwt.sign(
    { playerId: player.id, platform: player.platform },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES }
  );

  // 查询角色列表
  const roles = getAllRows(
    'SELECT id AS role_id, name, realm_level, combat_power FROM t_role WHERE player_id = ?',
    [player.id]
  );

  return res.json({
    code: 0,
    msg: 'success',
    data: {
      player_id: player.id,
      token,
      token_expire: Math.floor(Date.now() / 1000) + 7 * 86400,
      roles,
    },
  });
});

/**
 * GET /api/health
 * 健康检查
 */
router.get('/api/health', (_req, res) => {
  res.json({ code: 0, msg: 'ok', data: { uptime: process.uptime() } });
});

module.exports = router;
