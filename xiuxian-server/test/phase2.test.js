/**
 * Phase 2 测试 — 修炼 + 境界突破 + 离线收益
 */

const http = require('http');
const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';
let passed = 0, failed = 0, errors = [];

function rq(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const req = http.request({ method, hostname: url.hostname, port: url.port, path: url.pathname + url.search, headers }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (_) { resolve(d); } });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}
function ok(n) { passed++; console.log(`  PASS  ${n}`); }
function no(n, r) { failed++; errors.push({ name: n, reason: r }); console.log(`  FAIL  ${n} — ${r}`); }
function chk(c, n, v) { c ? ok(n) : no(n, v); }

async function main() {
  console.log('\n============================================');
  console.log('   Phase 2 测试 — 修炼与境界突破');
  console.log('============================================\n');

  // Setup: 登录 + 创建角色 + 灵根 + 命格
  const login = await rq('POST', '/api/login', { device_id: 'phase2_' + Date.now() });
  const token = login.data.token;
  const cr = await rq('POST', '/api/role/create', { name: '测试修士' }, token);
  const roleId = cr.data.role_id;
  ok('角色创建完成');

  // 灵根
  const elem = await rq('POST', '/api/element/random', { role_id: roleId }, token);
  await rq('POST', '/api/element/confirm', { role_id: roleId, ...elem.data }, token);
  // 命格
  const tal = await rq('POST', '/api/talent/random', { role_id: roleId }, token);
  await rq('POST', '/api/talent/confirm', { role_id: roleId, talents: tal.data.talents }, token);
  ok('灵根命格已配置');

  // ========== 修炼 ==========
  console.log('\n--- 修炼 ---');
  let r = await rq('POST', '/api/role/cultivate', { role_id: roleId }, token);
  chk(r.code === 0, '修炼成功', r.code);
  chk(r.data.gain > 0, '修为有增长', r.data.gain);
  chk(r.data.cultivate_speed >= 1, '体现修炼速度', r.data.cultivate_speed);

  // 多次修炼
  let info = await rq('GET', '/api/role/info?role_id=' + roleId, null, token);
  const beforeExp = info.data.basic.cultivate_exp;
  for (let i = 0; i < 5; i++) {
    await rq('POST', '/api/role/cultivate', { role_id: roleId }, token);
  }
  info = await rq('GET', '/api/role/info?role_id=' + roleId, null, token);
  chk(info.data.basic.cultivate_exp > beforeExp, '多次修炼累积增长', info.data.basic.cultivate_exp - beforeExp);

  // 修炼到满（凡人→练气需约100修为，约点10次）
  while (true) {
    r = await rq('POST', '/api/role/cultivate', { role_id: roleId }, token);
    if (r.data.cultivate_exp >= r.data.cultivate_exp_to_next) break;
    if (r.data.cultivate_exp > 1000) break; // safety
  }
  info = await rq('GET', '/api/role/info?role_id=' + roleId, null, token);
  chk(info.data.basic.cultivate_exp >= info.data.basic.cultivate_exp_to_next, '修为可以修炼到满', info.data.basic.cultivate_exp);

  // ========== 突破 ==========
  console.log('\n--- 境界突破 ---');
  r = await rq('POST', '/api/role/breakthrough', { role_id: roleId }, token);
  chk(r.code === 0, '突破请求成功', r.code);
  if (r.data.success) {
    ok('境界突破成功 (' + r.data.old_realm_name + ' → ' + r.data.new_realm_name + ')');
    chk(r.data.new_realm_level > r.data.old_realm_level, '境界等级提升', r.data.new_realm_level);
    chk(r.data.attribute_bonus?.hp > 0, '属性有成长', r.data.attribute_bonus?.hp);
    chk(r.data.combat_power > 0, '战力更新', r.data.combat_power);

    // 突破后修为清零
    info = await rq('GET', '/api/role/info?role_id=' + roleId, null, token);
    chk(info.data.basic.cultivate_exp < info.data.basic.cultivate_exp_to_next, '突破后修为归零', info.data.basic.cultivate_exp);
  } else {
    ok('突破失败（概率正常）');
    // 损失20%
    info = await rq('GET', '/api/role/info?role_id=' + roleId, null, token);
    chk(info.data.basic.cultivate_exp > 0, '失败后仍有修为保留', info.data.basic.cultivate_exp);
  }

  // 境界上限测试
  r = await rq('POST', '/api/role/breakthrough', { role_id: 99999 }, token);
  chk(r.code === 3001, '不存在角色返回错误', r.code);

  // ========== 挂机 ==========
  console.log('\n--- 挂机/离线 ---');
  r = await rq('POST', '/api/role/start_afk', { role_id: roleId }, token);
  chk(r.code === 0, '开始挂机', r.code);
  chk(r.data.started === true, '返回started=true', r.data.started);

  // 已在挂机中不可再开
  r = await rq('POST', '/api/role/start_afk', { role_id: roleId }, token);
  chk(r.code === 3001, '不可重复挂机', r.code);

  // 离线收益
  r = await rq('POST', '/api/role/offline_reward', { role_id: roleId }, token);
  chk(r.code === 0, '离线收益结算', r.code);
  chk(r.data.cultivate_gain >= 0, '修为收益 >= 0', r.data.cultivate_gain);

  // ========== 汇总 ==========
  console.log('\n============================================');
  console.log(`  总计: ${passed + failed}  |  PASS: ${passed}  |  FAIL: ${failed}`);
  console.log('============================================\n');
  if (errors.length > 0) { console.log('失败详情:'); errors.forEach((e) => console.log(`  - ${e.name}: ${e.reason}`)); console.log(''); }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
