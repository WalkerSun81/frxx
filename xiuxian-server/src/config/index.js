const path = require('path');

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('生产环境必须设置 JWT_SECRET');
}

module.exports = {
  // 服务端口
  PORT: process.env.PORT || 3000,
  CORS_ORIGIN: process.env.CORS_ORIGIN || '',

  // SQLite 数据库路径
  DB_PATH: process.env.XIUXIAN_DB_PATH || path.join(__dirname, '../../data/xiuxian.db'),

  // JWT 密钥
  JWT_SECRET: process.env.JWT_SECRET || 'xiuxian-dev-secret-key-change-in-production',
  JWT_EXPIRES: '7d',

  // 前端静态文件目录
  STATIC_DIR: path.join(__dirname, '../../frontend'),

  // 游戏初始配置
  GAME: {
    // 初始资源
    INIT_GOLD: 1000,
    INIT_COPPER: 5000,
    INIT_CULTIVATE_BOOK: 3,
    INIT_ENHANCE_STONE: 10,

    // 基础属性
    BASE_ATTRS: {
      strength: 10,
      vitality: 10,
      agility: 10,
      intelligence: 10,
      accuracy: 10,
      sense: 10,
      wisdom: 10,
      luck: 10,
    },

    // 离线收益上限（秒）
    MAX_OFFLINE_SECONDS: 8 * 3600,
    // 离线效率
    OFFLINE_EFFICIENCY: 0.8,

    // 修炼基础速度（修为/秒）
    BASE_CULTIVATE_SPEED: 1.0,

    // 最大角色数
    MAX_ROLES_PER_PLAYER: 3,

    // 角色名长度限制
    ROLE_NAME_MIN: 2,
    ROLE_NAME_MAX: 8,
  },
};
