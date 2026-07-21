const { initTables } = require('./init');

initTables()
  .then(() => console.log('[DB] 初始化完成；测试数据请通过游戏接口创建。'))
  .catch((error) => {
    console.error('[DB] 初始化失败:', error.message);
    process.exit(1);
  });
