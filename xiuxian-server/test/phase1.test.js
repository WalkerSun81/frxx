/**
 * Phase 1 测试 — 角色创建、灵根、命格
 */

const http = require('http');
const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';
let passed = 0, failed = 0, errors = [];

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

async function main() {
  console.log('\n============================================');
  console.log('   Phase 1 测试 — 角色创建/灵根/命格');
  console.log('============================================\n');

  // 登录获取 token（每次用唯一 ID 避免旧数据干扰）
  const login = await request('POST', '/api/login', { device_id: 'phase1_' + Date.now() });
  if (login.body.code !== 0) { f('登录失败', login.body.msg); process.exit(1); }
  const token = login.body.data.token;
  p('登录成功');

  // ========== 角色创建 ==========
  console.log('\n--- 角色创建 ---');

  // 缺 name
  let r = await request('POST', '/api/role/create', {}, token);
  check(r.body.code === 1001, '缺 name → 1001', r.body.code);

  // 空 name
  r = await request('POST', '/api/role/create', { name: '  ' }, token);
  check(r.body.code === 1001, '空 name → 1001', r.body.code);

  // 短 name
  r = await request('POST', '/api/role/create', { name: '一' }, token);
  check(r.body.code === 1001, '单字 name → 1001', r.body.code);

  // 长 name (>8字符)
  r = await request('POST', '/api/role/create', { name: '超级无敌长的角色名' }, token);
  check(r.body.code === 1001, '超长 name → 1001', r.body.code);

  // 正常创建
  r = await request('POST', '/api/role/create', { name: '江踏雪' }, token);
  check(r.body.code === 0, '创建角色"江踏雪"', r.body.code);
  check(r.body.data?.role_id > 0, '返回 role_id', r.body.data?.role_id);
  check(r.body.data?.realm_level === 0, '境界=凡人', r.body.data?.realm_level);
  check(r.body.data?.attributes?.strength === 10, '初始力量=10', r.body.data?.attributes?.strength);
  check(r.body.data?.resources?.gold === 1000, '初始灵石=1000', r.body.data?.resources?.gold);
  const roleId = r.body.data.role_id;

  // 重名
  r = await request('POST', '/api/role/create', { name: '江踏雪' }, token);
  check(r.body.code === 3001, '重名被拒', r.body.code);

  // 创建第二个角色
  r = await request('POST', '/api/role/create', { name: '叶云' }, token);
  check(r.body.code === 0, '第二角色"叶云"', r.body.code);
  const roleId2 = r.body.data.role_id;
  check(roleId2 > roleId, 'role_id 递增', roleId2);

  // 创建第三个角色
  r = await request('POST', '/api/role/create', { name: '林霜' }, token);
  check(r.body.code === 0, '第三角色"林霜"', r.body.code);

  // 上限拒绝
  r = await request('POST', '/api/role/create', { name: '第四者' }, token);
  check(r.body.code === 3001, '角色上限被拒', r.body.code);

  // ========== 角色信息查询 ==========
  console.log('\n--- 角色信息 ---');
  r = await request('GET', '/api/role/info?role_id=' + roleId, null, token);
  check(r.body.code === 0, '获取角色信息', r.body.code);
  check(r.body.data?.basic?.name === '江踏雪', '正确返回角色名', r.body.data?.basic?.name);
  check(r.body.data?.basic?.realm_name === '凡人', '境界=凡人', r.body.data?.basic?.realm_name);
  check(r.body.data?.attributes?.strength === 10, '属性=10', r.body.data?.attributes?.strength);
  check(r.body.data?.element_root === null, '无灵根', r.body.data?.element_root);
  check(r.body.data?.talents?.length === 0, '无命格', r.body.data?.talents?.length);

  // 不存在的角色
  r = await request('GET', '/api/role/info?role_id=99999', null, token);
  check(r.body.code === 3001, '不存在 role → 3001', r.body.code);

  // ========== 灵根 ==========
  console.log('\n--- 灵根 ---');

  // 随机
  r = await request('POST', '/api/element/random', { role_id: roleId }, token);
  check(r.body.code === 0, '随机灵根成功', r.body.code);
  const root = r.body.data;
  check(root.metal >= 1 && root.metal <= 80, '金值1-80', root.metal);
  check(root.wood >= 1 && root.wood <= 80, '木值1-80', root.wood);
  check([1,2,3,4,5].includes(root.main_element), '主灵根1-5', root.main_element);
  check(root.cultivate_multiplier >= 1.0, '修炼倍率>=1', root.cultivate_multiplier);

  // 再随机（应该不同——但不保证，至少不报错）
  const r2 = await request('POST', '/api/element/random', { role_id: roleId }, token);
  check(r2.body.code === 0, '二次随机灵根', r2.body.code);

  // 确认
  r = await request('POST', '/api/element/confirm', { role_id: roleId, ...root }, token);
  check(r.body.code === 0, '确认灵根', r.body.code);
  check(r.body.data?.confirmed === true, 'confirmed=true', r.body.data?.confirmed);

  // 确认后不可再随机
  r = await request('POST', '/api/element/random', { role_id: roleId }, token);
  check(r.body.code === 3001, '确认后不可再随机', r.body.code);

  // 确认后不可再确认
  r = await request('POST', '/api/element/confirm', { role_id: roleId, ...root }, token);
  check(r.body.code === 3001, '确认后不可再确认', r.body.code);

  // ========== 命格 ==========
  console.log('\n--- 命格 ---');

  // 随机
  r = await request('POST', '/api/talent/random', { role_id: roleId }, token);
  check(r.body.code === 0, '随机命格成功', r.body.code);
  check(r.body.data?.talents?.length === 5, '5个天赋', r.body.data?.talents?.length);
  check(Array.isArray(r.body.data?.fetters), '返回羁绊', r.body.data?.fetters.length >= 0);

  // 验证天赋结构
  for (const t of r.body.data.talents) {
    check(typeof t.slot_index === 'number', '有slot_index', t.slot_index);
    check([1,2,3,4,5,6].includes(t.quality), '品质1-6', t.quality);
    check(typeof t.talent_name === 'string', '有名称', t.talent_name);
    check(t.value > 0, 'value > 0', t.value);
  }

  const talents = r.body.data.talents;

  // 确认
  r = await request('POST', '/api/talent/confirm', { role_id: roleId, talents }, token);
  check(r.body.code === 0, '确认命格', r.body.code);

  // 确认后不可再确认
  r = await request('POST', '/api/talent/confirm', { role_id: roleId, talents }, token);
  check(r.body.code === 3001, '确认后不可再确认', r.body.code);

  // 角色信息已包含灵根和命格
  r = await request('GET', '/api/role/info?role_id=' + roleId, null, token);
  check(r.body.code === 0, '重查角色信息', r.body.code);
  check(r.body.data?.element_root !== null, '灵根已写入', r.body.data?.element_root?.confirmed);
  check(r.body.data?.talents?.length === 5, '命格已写入', r.body.data?.talents?.length);

  // 属性已叠加天赋加成
  const totalBonus = talents.reduce((s, t) => s + t.value, 0);
  const attrs = r.body.data.attributes;
  const totalAttr = attrs.strength + attrs.vitality + attrs.agility + attrs.intelligence +
    attrs.accuracy + attrs.sense + attrs.wisdom + attrs.luck;
  check(totalAttr > 80, '属性已叠加天赋', totalAttr);

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
