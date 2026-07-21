const config = require('../config');
const jwt = require('jsonwebtoken');

/**
 * Token 认证中间件
 * 校验请求头中的 Authorization: Bearer <token>
 */
function auth(req, res, next) {
  // 跳过无需认证的路径（静态资源也放行）
  if (req.path === '/api/health' || req.path === '/api/login') {
    return next();
  }
  // 非 API 请求直接放行（静态文件、favicon等）
  if (!req.path.startsWith('/api/')) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ code: 1003, msg: '未登录', data: null });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, config.JWT_SECRET);
    req.playerId = payload.playerId;
    req.platform = payload.platform;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ code: 1003, msg: 'Token已过期，请重新登录', data: null });
    }
    return res.status(401).json({ code: 1003, msg: 'Token无效', data: null });
  }
}

module.exports = auth;
