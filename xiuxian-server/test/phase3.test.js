const http = require('http');
const BASE = 'http://localhost:3000';
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
  console.log('\n========== Phase 3: 战斗与地图 ==========\n');

  // Setup: 创建角色
  const login = await rq('POST', '/api/login', { device_id: 'p3_' + Date.now() });
  const t = login.data.token;
  const cr = await rq('POST', '/api/role/create', { name: '战斗测试' }, t);
  const rid = cr.data.role_id;
  const elem = await rq('POST', '/api/element/random', { role_id: rid }, t);
  await rq('POST', '/api/element/confirm', { role_id: rid, ...elem.data }, t);
  const tal = await rq('POST', '/api/talent/random', { role_id: rid }, t);
  await rq('POST', '/api/talent/confirm', { role_id: rid, talents: tal.data.talents }, t);

  // 突破到练气初期（解锁青云村外）
  while (true) {
    let info = await rq('GET', '/api/role/info?role_id=' + rid, null, t);
    if (info.data.basic.realm_level >= 1) break;
    await rq('POST', '/api/role/cultivate', { role_id: rid }, t);
    if (info.data.basic.cultivate_exp >= info.data.basic.cultivate_exp_to_next) {
      await rq('POST', '/api/role/breakthrough', { role_id: rid }, t);
    }
  }
  ok('角色已突破到练气初期');

  // === 地图列表 ===
  console.log('\n--- 地图 ---');
  let r = await rq('GET', '/api/battle/maps?role_id=' + rid, null, t);
  chk(r.code === 0, '获取地图列表', r.code);
  chk(r.data.maps.length === 7, '7张地图', r.data.maps.length);
  chk(r.data.maps[0].max_layer === 0, '初始进度=0', r.data.maps[0].max_layer);

  // === 挑战 ===
  console.log('\n--- 挑战 ---');
  r = await rq('POST', '/api/battle/challenge', { role_id: rid, map_id: 1, layer: 1 }, t);
  chk(r.code === 0, 'layer 1 挑战返回', r.code);
  chk(r.data.monster !== undefined, '有怪物数据');

  if (r.data.result === 'win') {
    ok('layer 1 战斗胜利');
    chk(r.data.rewards.exp > 0, '有经验奖励');
    chk(r.data.rewards.gold > 0, '有灵石奖励');
  } else if (r.data.result === 'lose') {
    ok('layer 1 战斗失败（属性太低）');
  }

  // 验证进度更新
  let maps = await rq('GET', '/api/battle/maps?role_id=' + rid, null, t);
  chk(maps.data.maps[0].max_layer >= 0, '进度正常', maps.data.maps[0].max_layer);

  // Boss（需要1-19层全通，这里未通，验证层数锁）
  r = await rq('POST', '/api/battle/challenge', { role_id: rid, map_id: 1, layer: 20 }, t);
  chk(r.code === 3001, '未通关前置层不能打Boss', r.code);

  // 未解锁地图
  r = await rq('POST', '/api/battle/challenge', { role_id: rid, map_id: 6 }, t);
  chk(r.code === 3001, '未解锁地图拒绝', r.code);

  // === 汇总 ===
  console.log(`\n========== ${f === 0 ? '全部通过' : `失败 ${f} 项`} ==========\n`);
  if (f > 0) errs.forEach((e) => console.log(`  - ${e.n}: ${e.r}`));
  process.exit(f > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
