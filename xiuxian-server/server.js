const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const config = require('./src/config');
const { initTables, getRow } = require('./src/db/init');
const auth = require('./src/middleware/auth');
const { errorHandler, notFound } = require('./src/middleware/error');

// 路由
const authRoutes    = require('./src/routes/auth');
const roleRoutes    = require('./src/routes/role');
const elementRoutes = require('./src/routes/element');
const talentRoutes    = require('./src/routes/talent');
const cultivateRoutes = require('./src/routes/cultivate');
const battleRoutes    = require('./src/routes/battle');
const equipRoutes     = require('./src/routes/equipment');
const gemRoutes       = require('./src/routes/gem');
const lifeRoutes      = require('./src/routes/life');

const app = express();

// ---------- 中间件 ----------
app.use(cors({ origin: config.CORS_ORIGIN || false }));
app.use(express.json());

// 静态文件
app.use(express.static(config.STATIC_DIR));

// 认证中间件
app.use(auth);

// ---------- 路由 ----------
app.use(authRoutes);
app.use(roleRoutes);
app.use(elementRoutes);
app.use(talentRoutes);
app.use(cultivateRoutes);
app.use(battleRoutes);
app.use(equipRoutes);
app.use(gemRoutes);
app.use(lifeRoutes);

// ---------- 错误处理 ----------
app.use(notFound);
app.use(errorHandler);

// ---------- WebSocket ----------
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// roleId -> ws 映射（用于按角色推送）
const wsClients = new Map();

wss.on('connection', async (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const roleId = parseInt(url.searchParams.get('role_id'), 10);
  const token = url.searchParams.get('token');

  try {
    const payload = jwt.verify(token || '', config.JWT_SECRET);
    const role = getRow('SELECT id FROM t_role WHERE id = ? AND player_id = ?', [roleId, payload.playerId]);
    if (!role) throw new Error('role is not owned');
  } catch (_) {
    ws.close(1008, 'unauthorized');
    return;
  }

  wsClients.set(roleId, ws);

  ws.on('close', () => {
    wsClients.delete(roleId);
  });

  ws.on('error', () => {
    wsClients.delete(roleId);
  });

  // 发送连接确认
  ws.send(JSON.stringify({ push_cmd: 0, data: { msg: 'connected', role_id: roleId } }));
});

/**
 * 向指定角色推送消息
 */
function pushToRole(roleId, pushData) {
  const ws = wsClients.get(roleId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(pushData));
  }
}

// 挂到 app 上供路由使用
app.set('pushToRole', pushToRole);
app.set('wss', wss);

// ---------- 启动 ----------
async function start() {
  await initTables();

  server.listen(config.PORT, () => {
    console.log(`[Server] 凡人修仙录服务已启动: http://localhost:${config.PORT}`);
    console.log(`[Server] WebSocket 已就绪: ws://localhost:${config.PORT}`);
    console.log(`[Server] 前端入口: http://localhost:${config.PORT}`);
  });
}

start();
