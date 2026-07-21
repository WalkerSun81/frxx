/**
 * Phase 0 全面测试
 *
 * 用法:
 *   1. 新开终端:  node server.js
 *   2. 运行测试:  node test/phase0.test.js
 */

const http = require('http');

const BASE = 'http://localhost:3000';
let passed = 0, failed = 0, errors = [];

// ============================================================
function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const req = http.request({ method, hostname: url.hostname, port: url.port, path: url.pathname + url.search, headers }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch (_) { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function p(name) { passed++; console.log(`  PASS  ${name}`); }
function f(name, r) { failed++; errors.push({ name, reason: r }); console.log(`  FAIL  ${name} — ${r}`); }
function check(cond, name, reason) { cond ? p(name) : f(name, reason); }

// ============================================================
async function main() {
  console.log('\n============================================');
  console.log('   Phase 0 全面测试');
  console.log('============================================\n');

  // ========== 1. 服务连通 ==========
  console.log('--- 1. 服务连通 ---');
  try {
    const r = await request('GET', '/api/health');
    check(r.body.code === 0, 'GET /api/health 返回成功', r.body.code);
    check(typeof r.body.data?.uptime === 'number', '返回 uptime 字段');
  } catch (e) {
    f('服务器未启动', e.message);
    console.log('\n请先在另一个终端运行: node server.js');
    process.exit(1);
  }

  // ========== 2. 参数校验 ==========
  console.log('\n--- 2. 参数校验 ---');
  {
    const r = await request('POST', '/api/login', {});
    check(r.body.code === 1001, '缺 device_id → 1001', r.body.code);
  }
  {
    const r = await request('POST', '/api/login', { device_id: '' });
    check(r.body.code === 1001, '空 device_id → 1001', r.body.code);
  }

  // ========== 3. 登录流程 ==========
  console.log('\n--- 3. 登录 ---');

  const d1 = 'device_alpha';
  let r = await request('POST', '/api/login', { device_id: d1 });
  check(r.body.code === 0, '首次登录成功', r.body.code);
  const t1 = r.body.data?.token;
  check(!!t1, '返回 JWT token');
  check(r.body.data?.player_id === 1, '首位玩家 player_id=1', r.body.data?.player_id);
  check(Array.isArray(r.body.data?.roles), 'roles 是数组');
  check(r.body.data?.roles.length === 0, '新玩家 roles=[]', r.body.data?.roles.length);

  // 二次登录同设备
  r = await request('POST', '/api/login', { device_id: d1 });
  check(r.body.code === 0, '同设备再次登录成功', r.body.code);
  check(r.body.data?.player_id === 1, 'player_id 仍然=1', r.body.data?.player_id);
  check(typeof r.body.data?.token === 'string', 'token 正确返回', r.body.data?.token);
  const t1b = r.body.data.token;

  // 新设备
  const d2 = 'device_beta';
  r = await request('POST', '/api/login', { device_id: d2 });
  check(r.body.code === 0, '新设备登录成功', r.body.code);
  check(r.body.data?.player_id === 2, 'player_id=2', r.body.data?.player_id);
  const t2 = r.body.data.token;

  // 第三个设备
  const d3 = 'device_gamma';
  r = await request('POST', '/api/login', { device_id: d3 });
  check(r.body.code === 0, '第三个设备登录成功', r.body.code);
  check(r.body.data?.player_id === 3, 'player_id=3', r.body.data?.player_id);
  const t3 = r.body.data.token;

  // ========== 4. JWT 认证 ==========
  console.log('\n--- 4. JWT 认证 ---');

  // 无 token
  r = await request('GET', '/api/role/info?role_id=1');
  check(r.body.code === 1003, '无 token → 1003', r.body.code);

  // 坏 token
  r = await request('GET', '/api/role/info?role_id=1', null, 'bad.token.here');
  check(r.body.code === 1003, '坏 token → 1003', r.body.code);

  // 有效 token
  r = await request('GET', '/api/role/info?role_id=1', null, t1);
  // role/info 还没实现，但认证应该通过（不是 1003）
  check(r.body.code !== 1003, '有效 token 认证通过（非 1003）', r.body.code);

  // ========== 5. 404 处理 ==========
  console.log('\n--- 5. 404 处理 ---');
  r = await request('GET', '/api/nonexistent', null, t1);
  check(r.body.code === 1006, '不存在的接口 → 1006', r.body.code);
  r = await request('POST', '/api/unknown', {}, t1);
  check(r.body.code === 1006, 'POST 不存在接口 → 1006', r.body.code);

  // ========== 6. 并发 ==========
  console.log('\n--- 6. 并发 ---');
  const tasks = [];
  for (let i = 0; i < 10; i++) {
    tasks.push(request('POST', '/api/login', { device_id: `concurrent_${i}` }));
  }
  const results = await Promise.all(tasks);
  let allOk = results.every((r) => r.body.code === 0);
  check(allOk, '10 并发登录全部成功');

  // ========== 7. 并发 + 健康检查混跑 ==========
  {
    const mix = [];
    for (let i = 0; i < 5; i++) {
      mix.push(request('GET', '/api/health'));
      mix.push(request('POST', '/api/login', { device_id: `mix_${i}` }));
    }
    const mixResults = await Promise.all(mix);
    allOk = mixResults.every((r) => r.body.code === 0);
    check(allOk, '健康检查与登录 10 并发混跑全部成功');
  }

  // ========== 8. DB 持久化 ==========
  console.log('\n--- 8. DB 持久化 ---');
  r = await request('POST', '/api/login', { device_id: d1 });
  check(r.body.code === 0, '再次登录 device_alpha 成功', r.body.code);
  check(r.body.data?.player_id === 1, 'player_id=1 持久化未丢', r.body.data?.player_id);
  // 用最新的 token
  r = await request('GET', '/api/role/info?role_id=1', null, r.body.data.token);
  check(r.body.code !== 1003, '新 token 也通过认证', r.body.code);

  // ========== 9. 响应结构一致性 ==========
  console.log('\n--- 9. 响应格式 ---');
  r = await request('GET', '/api/health');
  check('code' in r.body, '响应含 code');
  check('msg' in r.body, '响应含 msg');
  check('data' in r.body, '响应含 data');

  r = await request('POST', '/api/login', { device_id: d1 });
  check(typeof r.body.data.player_id === 'number', 'data.player_id 为 number');
  check(typeof r.body.data.token === 'string', 'data.token 为 string');
  check(Array.isArray(r.body.data.roles), 'data.roles 为 array');

  // ========== 10. 极端参数 ==========
  console.log('\n--- 10. 极端参数 ---');
  r = await request('POST', '/api/login', { device_id: 'x'.repeat(1000) });
  check(r.body.code === 0, '1000 字符 device_id 正常处理', r.body.code);

  r = await request('POST', '/api/login', { device_id: '<script>alert(1)</script>' });
  check(r.body.code === 0, 'XSS 字符串 device_id 正常处理', r.body.code);

  r = await request('POST', '/api/login', { device_id: '中文_한국어_日本語_😊' });
  check(r.body.code === 0, 'Unicode device_id 正常处理', r.body.code);

  r = await request('GET', '/api/role/info?role_id=-1', null, t1);
  check(r.body.code !== 1003, '负 role_id 请求通过认证', r.body.code);

  // ========== 汇总 ==========
  console.log('\n============================================');
  console.log(`  总计: ${passed + failed}  |  PASS: ${passed}  |  FAIL: ${failed}`);
  console.log('============================================\n');

  if (errors.length > 0) {
    console.log('失败详情:');
    errors.forEach((e) => console.log(`  - ${e.name}: ${e.reason}`));
    console.log('');
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
