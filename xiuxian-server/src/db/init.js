const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const config = require('../config');

const DB_PATH = config.DB_PATH;

let db = null;
let SQL = null;

/**
 * 初始化数据库（sql.js wasm 异步加载）
 */
async function initSql() {
  if (SQL) return SQL;
  SQL = await initSqlJs();
  return SQL;
}

/**
 * 获取数据库实例
 */
async function getDb() {
  if (db) return db;

  const sql = await initSql();

  // 确保 data 目录存在
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // 尝试从文件加载已有数据库
  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new sql.Database(buf);
  } else {
    db = new sql.Database();
  }

  // 开启外键
  db.run('PRAGMA foreign_keys = ON');
  console.log(`[DB] 已连接: ${DB_PATH}`);
  return db;
}

/**
 * 持久化到磁盘
 */
function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

/**
 * 快捷查询: db.run + save
 */
function exec(sql, params = []) {
  db.run(sql, params);
  saveDb();
}

/**
 * 获取单行
 */
function getRow(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  let row = null;
  if (stmt.step()) {
    row = stmt.getAsObject();
  }
  stmt.free();
  return row;
}

/**
 * 获取多行
 */
function getAllRows(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

/**
 * insert 并返回 lastID
 */
function insert(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  stmt.step();
  stmt.free();
  const row = getRow('SELECT last_insert_rowid() AS id');
  saveDb();
  return row ? row.id : null;
}

/**
 * 建表
 */
async function initTables() {
  const d = await getDb();

  const tables = [
    `CREATE TABLE IF NOT EXISTS t_player (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      openid TEXT NOT NULL UNIQUE,
      platform INTEGER NOT NULL DEFAULT 3,
      nickname TEXT,
      create_time DATETIME DEFAULT (datetime('now','localtime')),
      last_login_time DATETIME,
      total_recharge REAL NOT NULL DEFAULT 0.00,
      vip_level INTEGER NOT NULL DEFAULT 0,
      ban_status INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE INDEX IF NOT EXISTS idx_player_openid ON t_player(openid)`,

    `CREATE TABLE IF NOT EXISTS t_role (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      realm_level INTEGER NOT NULL DEFAULT 0,
      realm_sub_level INTEGER NOT NULL DEFAULT 1,
      cultivate_exp INTEGER NOT NULL DEFAULT 0,
      cultivate_exp_to_next INTEGER NOT NULL DEFAULT 100,
      total_cultivate_exp INTEGER NOT NULL DEFAULT 0,
      combat_power INTEGER NOT NULL DEFAULT 0,
      create_time DATETIME DEFAULT (datetime('now','localtime')),
      update_time DATETIME DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (player_id) REFERENCES t_player(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_role_player ON t_role(player_id)`,

    `CREATE TABLE IF NOT EXISTS t_role_attribute (
      role_id INTEGER PRIMARY KEY,
      strength INTEGER NOT NULL DEFAULT 10,
      vitality INTEGER NOT NULL DEFAULT 10,
      agility INTEGER NOT NULL DEFAULT 10,
      intelligence INTEGER NOT NULL DEFAULT 10,
      accuracy INTEGER NOT NULL DEFAULT 10,
      sense INTEGER NOT NULL DEFAULT 10,
      wisdom INTEGER NOT NULL DEFAULT 10,
      luck INTEGER NOT NULL DEFAULT 10,
      hp INTEGER NOT NULL DEFAULT 100,
      current_hp INTEGER NOT NULL DEFAULT 100,
      mp INTEGER NOT NULL DEFAULT 100,
      current_mp INTEGER NOT NULL DEFAULT 100,
      physical_attack INTEGER NOT NULL DEFAULT 0,
      physical_defense INTEGER NOT NULL DEFAULT 0,
      magical_attack INTEGER NOT NULL DEFAULT 0,
      magical_defense INTEGER NOT NULL DEFAULT 0,
      crit_rate REAL NOT NULL DEFAULT 0.000,
      crit_damage REAL NOT NULL DEFAULT 1.500,
      dodge_rate REAL NOT NULL DEFAULT 0.000,
      hit_rate REAL NOT NULL DEFAULT 1.000,
      attack_speed REAL NOT NULL DEFAULT 1.00,
      damage_increase REAL NOT NULL DEFAULT 0.000,
      damage_reduce REAL NOT NULL DEFAULT 0.000,
      cultivation_speed REAL NOT NULL DEFAULT 1.000,
      FOREIGN KEY (role_id) REFERENCES t_role(id)
    )`,

    `CREATE TABLE IF NOT EXISTS t_element_root (
      role_id INTEGER PRIMARY KEY,
      metal INTEGER NOT NULL DEFAULT 0,
      wood INTEGER NOT NULL DEFAULT 0,
      water INTEGER NOT NULL DEFAULT 0,
      fire INTEGER NOT NULL DEFAULT 0,
      earth INTEGER NOT NULL DEFAULT 0,
      main_element INTEGER NOT NULL DEFAULT 0,
      cultivate_multiplier REAL NOT NULL DEFAULT 1.00,
      confirmed INTEGER NOT NULL DEFAULT 0,
      update_time DATETIME DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (role_id) REFERENCES t_role(id)
    )`,

    `CREATE TABLE IF NOT EXISTS t_talent (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_id INTEGER NOT NULL,
      slot_index INTEGER NOT NULL,
      talent_type INTEGER NOT NULL DEFAULT 0,
      quality INTEGER NOT NULL DEFAULT 1,
      value INTEGER NOT NULL DEFAULT 0,
      talent_name TEXT,
      passive TEXT,
      active INTEGER NOT NULL DEFAULT 0,
      create_time DATETIME DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (role_id) REFERENCES t_role(id)
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_talent_role_slot ON t_talent(role_id, slot_index)`,

    `CREATE TABLE IF NOT EXISTS t_equipment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_id INTEGER NOT NULL DEFAULT 0,
      slot_type INTEGER NOT NULL DEFAULT 0,
      template_id INTEGER NOT NULL DEFAULT 0,
      template_name TEXT,
      quality INTEGER NOT NULL DEFAULT 1,
      level INTEGER NOT NULL DEFAULT 0,
      grade INTEGER NOT NULL DEFAULT 1,
      base_attrs TEXT,
      extra_attrs TEXT,
      gem_holes TEXT,
      is_locked INTEGER NOT NULL DEFAULT 0,
      create_time DATETIME DEFAULT (datetime('now','localtime')),
      update_time DATETIME DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (role_id) REFERENCES t_role(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_equip_role ON t_equipment(role_id)`,

    `CREATE TABLE IF NOT EXISTS t_resource (
      role_id INTEGER PRIMARY KEY,
      gold INTEGER NOT NULL DEFAULT 0,
      copper INTEGER NOT NULL DEFAULT 0,
      medal_stone INTEGER NOT NULL DEFAULT 0,
      cultivate_book INTEGER NOT NULL DEFAULT 0,
      enhance_stone INTEGER NOT NULL DEFAULT 0,
      realm_contribution INTEGER NOT NULL DEFAULT 0,
      realm_material_1 INTEGER NOT NULL DEFAULT 0,
      realm_material_2 INTEGER NOT NULL DEFAULT 0,
      realm_material_3 INTEGER NOT NULL DEFAULT 0,
      update_time DATETIME DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (role_id) REFERENCES t_role(id)
    )`,

    `CREATE TABLE IF NOT EXISTS t_afk_record (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_id INTEGER NOT NULL,
      map_id INTEGER NOT NULL DEFAULT 0,
      layer INTEGER NOT NULL DEFAULT 0,
      start_time DATETIME NOT NULL,
      end_time DATETIME,
      total_seconds INTEGER NOT NULL DEFAULT 0,
      earned_exp INTEGER NOT NULL DEFAULT 0,
      earned_gold INTEGER NOT NULL DEFAULT 0,
      earned_items TEXT,
      status INTEGER NOT NULL DEFAULT 0,
      create_time DATETIME DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (role_id) REFERENCES t_role(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_afk_role ON t_afk_record(role_id)`,

    `CREATE TABLE IF NOT EXISTS t_map_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_id INTEGER NOT NULL,
      map_id INTEGER NOT NULL,
      max_layer INTEGER NOT NULL DEFAULT 0,
      daily_pass_count INTEGER NOT NULL DEFAULT 0,
      daily_reset_time DATE NOT NULL DEFAULT (date('now')),
      update_time DATETIME DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (role_id) REFERENCES t_role(id)
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_map_role ON t_map_progress(role_id, map_id)`,

    `CREATE TABLE IF NOT EXISTS t_battle_build (
      role_id INTEGER PRIMARY KEY,
      strategy TEXT NOT NULL DEFAULT 'attack',
      skills TEXT NOT NULL DEFAULT '["metal_edge","wood_recovery","stone_skin"]',
      update_time DATETIME DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (role_id) REFERENCES t_role(id)
    )`,

    `CREATE TABLE IF NOT EXISTS t_game_event (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_id INTEGER NOT NULL,
      event_name TEXT NOT NULL,
      event_data TEXT,
      create_time DATETIME DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (role_id) REFERENCES t_role(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_game_event_role ON t_game_event(role_id, create_time)`,

    `CREATE TABLE IF NOT EXISTS t_reward_choice (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_id INTEGER NOT NULL,
      map_id INTEGER NOT NULL,
      layer INTEGER NOT NULL,
      options TEXT NOT NULL,
      status INTEGER NOT NULL DEFAULT 0,
      create_time DATETIME DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (role_id) REFERENCES t_role(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_reward_choice_role ON t_reward_choice(role_id, status)`,

    `CREATE TABLE IF NOT EXISTS t_bag (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_id INTEGER NOT NULL,
      template_id INTEGER NOT NULL,
      count INTEGER NOT NULL DEFAULT 1,
      is_locked INTEGER NOT NULL DEFAULT 0,
      create_time DATETIME DEFAULT (datetime('now','localtime')),
      update_time DATETIME DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (role_id) REFERENCES t_role(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_bag_role ON t_bag(role_id)`,

    `CREATE TABLE IF NOT EXISTS t_gem (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_id INTEGER NOT NULL,
      gem_type TEXT NOT NULL,
      level INTEGER NOT NULL DEFAULT 1,
      equipment_id INTEGER,
      slot_index INTEGER,
      create_time DATETIME DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (role_id) REFERENCES t_role(id),
      FOREIGN KEY (equipment_id) REFERENCES t_equipment(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_gem_role ON t_gem(role_id)`,

    `CREATE TABLE IF NOT EXISTS t_life_skill (
      role_id INTEGER PRIMARY KEY,
      mining_level INTEGER NOT NULL DEFAULT 1,
      alchemy_level INTEGER NOT NULL DEFAULT 1,
      energy INTEGER NOT NULL DEFAULT 100,
      energy_updated_at DATETIME DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (role_id) REFERENCES t_role(id)
    )`,

    `CREATE TABLE IF NOT EXISTS t_mail (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      attachments TEXT,
      status INTEGER NOT NULL DEFAULT 0,
      expire_time DATETIME,
      create_time DATETIME DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (role_id) REFERENCES t_role(id)
    )`,

    `CREATE TABLE IF NOT EXISTS t_talent_preview (
      role_id INTEGER PRIMARY KEY,
      talents TEXT NOT NULL,
      update_time DATETIME DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (role_id) REFERENCES t_role(id)
    )`,
  ];

  for (const sql of tables) {
    d.run(sql);
  }
  migrateColumns(d);
  saveDb();
  console.log('[DB] 核心表已初始化');
}

function migrateColumns(database) {
  const columns = {
    t_player: [
      'avatar_url TEXT', 'last_login_ip TEXT', 'ban_reason TEXT', 'ban_end_time DATETIME', 'last_seq INTEGER NOT NULL DEFAULT 0',
    ],
    t_role: [
      'last_tick_time DATETIME',
      'focus_cultivate_count INTEGER NOT NULL DEFAULT 0',
      'focus_cultivate_date DATE',
    ],
    t_equipment: [
      'star_level INTEGER NOT NULL DEFAULT 0', 'enchant_level INTEGER NOT NULL DEFAULT 0', 'enchant_attrs TEXT',
    ],
    t_map_progress: [
      'map_name TEXT', 'best_time INTEGER', 'total_pass_count INTEGER NOT NULL DEFAULT 0',
    ],
    t_resource: [
      'spirit_stone INTEGER NOT NULL DEFAULT 0',
    ],
  };
  for (const [table, definitions] of Object.entries(columns)) {
    const existing = new Set(database.exec(`PRAGMA table_info(${table})`)[0]?.values.map((row) => row[1]) || []);
    for (const definition of definitions) {
      const name = definition.split(' ')[0];
      if (!existing.has(name)) database.run(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
    }
  }
}

module.exports = { getDb, initTables, saveDb, exec, getRow, getAllRows, insert };
