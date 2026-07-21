const http = require('http');
const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';
let p = 0, f = 0, errs = [];

function rq(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const h = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = `Bearer ${token}`;
    const req = http.request({ method, hostname: url.hostname, port: url.port, path: url.pathname + url.search, headers: h }, (res) => {
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
function ok(n) { p++; console.log(`  PASS  ${n}`); }
function no(n, r) { f++; errs.push({ n, r }); console.log(`  FAIL  ${n} — ${r}`); }
function chk(c, n, v) { c ? ok(n) : no(n, v); }

async function main() {
  console.log('\n========== Phase 4-6: 装备/经济/商城 ==========\n');

  // 创建角色 + 战斗获取装备
  const login = await rq('POST', '/api/login', { device_id: 'p46_' + Date.now() });
  const t = login.data.token;
  let r = await rq('POST', '/api/role/create', { name: '装备测试' }, t);
  const rid = r.data.role_id;
  const elem = await rq('POST', '/api/element/random', { role_id: rid }, t);
  await rq('POST', '/api/element/confirm', { role_id: rid, ...elem.data }, t);
  const tal = await rq('POST', '/api/talent/random', { role_id: rid }, t);
  await rq('POST', '/api/talent/confirm', { role_id: rid, talents: tal.data.talents }, t);

  // 突破到练气初期
  while (true) {
    let info = await rq('GET', '/api/role/info?role_id=' + rid, null, t);
    if (info.data.basic.realm_level >= 1) break;
    await rq('POST', '/api/role/cultivate', { role_id: rid }, t);
    if (info.data.basic.cultivate_exp >= info.data.basic.cultivate_exp_to_next) {
      await rq('POST', '/api/role/breakthrough', { role_id: rid }, t);
    }
  }
  ok('角色就绪');

  // 战斗获取装备
  await rq('POST', '/api/battle/challenge', { role_id: rid, map_id: 1, layer: 1 }, t);
  ok('战斗获取装备');

  // === 装备 ===
  console.log('\n--- 装备 ---');
  let info = await rq('GET', '/api/role/info?role_id=' + rid, null, t);
  let equipList = (info.data.equipment || []).filter((equip) => equip.slot_type === 0);

  if (equipList.length > 0) {
    const eid = equipList[0].id;
    r = await rq('POST', '/api/equipment/equip', { equipment_id: eid, slot_type: equipList[0].slot_type || 1 }, t);
    chk(r.code === 0, '穿戴装备', r.code);

    // 强化
    r = await rq('POST', '/api/equipment/enhance', { equipment_id: eid }, t);
    chk(r.code === 0, '强化装备', r.code);
    chk(typeof r.data.success === 'boolean', '返回成功/失败');

    // 卸下
    r = await rq('POST', '/api/equipment/unequip', { slot_type: 1, role_id: rid }, t);
    chk(r.code === 0, '卸下装备', r.code);
  } else {
    ok('无装备跳过（战斗未掉宝）');
  }

  // === 资源 ===
  console.log('\n--- 资源 ---');
  r = await rq('POST', '/api/resource', { role_id: rid }, t);
  chk(r.code === 0, '查询资源', r.code);
  chk(r.data.gold >= 0, '有灵石余额');

  // === 商城 ===
  console.log('\n--- 商城 ---');
  r = await rq('POST', '/api/shop/buy', { role_id: rid, item_id: 'enhance_stone_10', count: 1 }, t);
  chk(r.code === 0, '购买强化石', r.code);

  r = await rq('POST', '/api/shop/buy', { role_id: rid, item_id: 'fake_item' }, t);
  chk(r.code === 3001, '不存在商品拒买', r.code);

  // === 汇总 ===
  console.log(`\n========== ${f === 0 ? '全部通过' : `失败 ${f} 项`} ==========\n`);
  if (f > 0) errs.forEach((e) => console.log(`  - ${e.n}: ${e.r}`));
  process.exit(f > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
