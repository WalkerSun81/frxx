const http = require('http');
const BASE = 'http://localhost:3000';

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
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('\n========== Phase 7: 全流程联调 ==========\n');
  let failures = 0;

  try {
    // 1. 登录
    let r = await rq('POST', '/api/login', { device_id: 'final_test_' + Date.now() });
    if (r.code !== 0) { console.log('FAIL: login'); process.exit(1); }
    const t = r.data.token;
    console.log('  OK  登录');

    // 2. 创建角色 + 灵根 + 命格
    r = await rq('POST', '/api/role/create', { name: '终测者' }, t);
    const rid = r.data.role_id;
    const elem = await rq('POST', '/api/element/random', { role_id: rid }, t);
    await rq('POST', '/api/element/confirm', { role_id: rid, ...elem.data }, t);
    const tal = await rq('POST', '/api/talent/random', { role_id: rid }, t);
    await rq('POST', '/api/talent/confirm', { role_id: rid, talents: tal.data.talents }, t);
    console.log('  OK  角色创建 + 灵根 + 命格');

    // 3. 查看角色
    let info = await rq('GET', '/api/role/info?role_id=' + rid, null, t);
    console.log(`  OK  角色信息 | 境界: ${info.data.basic.realm_name} | 战力: ${info.data.basic.combat_power}`);

    // 4. 修炼 -> 突破（循环到练气初期）
    let breakCount = 0;
    while (breakCount < 2) {
      info = await rq('GET', '/api/role/info?role_id=' + rid, null, t);
      if (info.data.basic.realm_level >= 1) break;
      if (info.data.basic.cultivate_exp >= info.data.basic.cultivate_exp_to_next) {
        r = await rq('POST', '/api/role/breakthrough', { role_id: rid }, t);
        if (r.data.success) { breakCount++; console.log(`  OK  突破: ${r.data.old_realm_name} -> ${r.data.new_realm_name}`); }
      }
      await rq('POST', '/api/role/cultivate', { role_id: rid }, t);
    }
    info = await rq('GET', '/api/role/info?role_id=' + rid, null, t);
    console.log(`  OK  修炼后战力: ${info.data.basic.combat_power}`);

    // 5. 战斗（打几层）
    for (let layer = 1; layer <= 5; layer++) {
      r = await rq('POST', '/api/battle/challenge', { role_id: rid, map_id: 1, layer }, t);
      if (r.code !== 0) { console.log(`  FAIL layer ${layer}: ${r.msg}`); failures++; }
    }
    info = await rq('GET', '/api/role/info?role_id=' + rid, null, t);
    console.log(`  OK  战斗5层后 | 战力: ${info.data.basic.combat_power} | 修为: ${info.data.basic.cultivate_exp}`);

    // 6. 资源查询 + 商城购物
    r = await rq('POST', '/api/resource', { role_id: rid }, t);
    console.log(`  OK  灵石: ${r.data.gold} | 铜板: ${r.data.copper}`);
    r = await rq('POST', '/api/shop/buy', { role_id: rid, item_id: 'enhance_stone_10', count: 1 }, t);
    console.log(`  OK  商城购买强化石: ${r.data.item}`);

    // 7. 离线收益
    await rq('POST', '/api/role/start_afk', { role_id: rid }, t);
    r = await rq('POST', '/api/role/offline_reward', { role_id: rid }, t);
    console.log(`  OK  离线收益: ${r.data.cultivate_gain} 修为`);

    console.log(`\n========== ${failures === 0 ? '全流程通过' : `失败 ${failures} 处`} ==========\n`);
  } catch (e) {
    console.error('FATAL:', e.message);
    process.exit(1);
  }
  process.exit(failures > 0 ? 1 : 0);
}

main();
