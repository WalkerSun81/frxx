/**
 * 统一错误处理中间件
 */
function errorHandler(err, req, res, _next) {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
  res.status(500).json({
    code: 5001,
    msg: '服务器内部错误',
    data: null,
  });
}

/**
 * 404 处理
 */
function notFound(req, res) {
  res.status(404).json({ code: 1006, msg: '接口不存在', data: null });
}

module.exports = { errorHandler, notFound };
