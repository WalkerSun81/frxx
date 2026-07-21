const http = require('http');

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';
let passed = 0;
let failed = 0;

function rq(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const req = http.request({ method, hostname: url.hostname, port: url.port, path: url.pathname + url.search, headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (_) { resolve(data); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function check(condition, name, actual) {
  if (condition) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}: ${actual}`); }
}

async function main() {
  console.log('\n========== 核心玩法循环测试 ==========\n');
  const login = await rq('POST', '/api/login', { device_id: `core_loop_${Date.now()}` });
  const token = login.data.token;
  const created = await rq('POST', '/api/role/create', { name: '循环测试' }, token);
  const roleId = created.data.role_id;
  const element = await rq('POST', '/api/element/random', { role_id: roleId }, token);
  await rq('POST', '/api/element/confirm', { role_id: roleId, ...element.data }, token);

  let info = await rq('GET', `/api/role/info?role_id=${roleId}`, null, token);
  check(info.data.progression.current_goal.type === 'breakthrough', '凡人阶段主目标是首次突破', info.data.progression.current_goal);
  check(info.data.cultivation.focus_remaining === 3, '每日短时闭关初始3次', info.data.cultivation);

  let build = await rq('GET', `/api/battle/build?role_id=${roleId}`, null, token);
  check(build.data.catalog.strategies.length === 3, '提供3种战前策略', build.data.catalog.strategies.length);
  check(build.data.catalog.skills.length === 6, '提供6门基础功法', build.data.catalog.skills.length);
  build = await rq('POST', '/api/battle/build', {
    role_id: roleId,
    strategy: 'swift',
    skills: ['wind_step', 'flame_burst', 'wood_recovery'],
  }, token);
  check(build.code === 0 && build.data.build.strategy === 'swift', '保存功法构筑', build.code);
  const invalidBuild = await rq('POST', '/api/battle/build', { role_id: roleId, strategy: 'attack', skills: ['wind_step'] }, token);
  check(invalidBuild.code === 1001, '拒绝不足3门功法的构筑', invalidBuild.code);

  for (let i = 0; i < 3; i++) {
    const cultivate = await rq('POST', '/api/role/cultivate', { role_id: roleId }, token);
    check(cultivate.code === 0, `第${i + 1}次短时闭关成功`, cultivate.code);
  }
  const limited = await rq('POST', '/api/role/cultivate', { role_id: roleId }, token);
  check(limited.code === 3001, '第4次短时闭关被限制', limited.code);

  const breakthrough = await rq('POST', '/api/role/breakthrough', { role_id: roleId }, token);
  check(breakthrough.code === 0 && breakthrough.data.success, '突破到练气初期', breakthrough.data);

  for (let layer = 1; layer <= 5; layer++) {
    const battle = await rq('POST', '/api/battle/challenge', { role_id: roleId, map_id: 1, layer }, token);
    check(battle.code === 0 && battle.data.result === 'win', `通关青云村外第${layer}层`, battle.data?.result);
    if (layer === 1) {
      check(battle.data.waves.length === 3, '普通层包含3波敌人', battle.data.waves);
      check(battle.data.waves.reduce((sum, wave) => sum + wave.enemy_count, 0) === 7, '普通层合计7只敌人', battle.data.waves);
      check(battle.data.log.some((item) => item.wave === 3), '战报记录跨波次战斗', battle.data.log.slice(-3));
    }
    if (layer === 5) {
      check(battle.data.encounter.type === 'elite', '第5层是机制精英', battle.data.encounter);
      check(battle.data.rewards.cultivation_upgrade?.multiplier > 1, '关键层提高挂机效率', battle.data.rewards);
      check(battle.data.rewards.reward_choice?.options.length === 3, '关键层提供三选一装备', battle.data.rewards.reward_choice);
      const choice = battle.data.rewards.reward_choice;
      const claimed = await rq('POST', '/api/battle/reward-choice', { choice_id: choice.choice_id, option_index: 1 }, token);
      check(claimed.code === 0 && claimed.data.equipment.archetype === 'survival', '领取指定流派装备', claimed.data);
      const duplicate = await rq('POST', '/api/battle/reward-choice', { choice_id: choice.choice_id, option_index: 0 }, token);
      check(duplicate.code === 3001, '三选一奖励不可重复领取', duplicate.code);
    }
  }

  info = await rq('GET', `/api/role/info?role_id=${roleId}`, null, token);
  check(info.data.progression.cultivation_multiplier > 1, '角色信息返回推图修炼倍率', info.data.progression);
  check(info.data.progression.current_goal.layer === 6, '主目标推进到第6层', info.data.progression.current_goal);

  const offline = await rq('POST', '/api/role/offline_reward', { role_id: roleId }, token);
  check(offline.code === 0 && offline.data.progression.cultivation_multiplier > 1, '挂机收益使用推图倍率', offline.data);

  for (let layer = 6; layer <= 19; layer++) {
    const battle = await rq('POST', '/api/battle/challenge', { role_id: roleId, map_id: 1, layer }, token);
    check(battle.code === 0 && battle.data.result === 'win', `推进到第${layer}层`, battle.data?.result);
  }
  const boss = await rq('POST', '/api/battle/challenge', { role_id: roleId, map_id: 1, layer: 20 }, token);
  check(boss.data.encounter.type === 'boss' && boss.data.encounter.mechanics.length === 2, 'Boss包含两项可应对机制', boss.data.encounter);
  check(boss.data.result !== 'win' && boss.data.recommendations.length > 0, 'Boss失败返回针对性行动建议', boss.data.recommendations);
  check(boss.data.failed_wave > 0 && boss.data.fallback_layer === 19, '失败标记波次并退回上一层', boss.data);
  const mapsAfterFail = await rq('GET', `/api/battle/maps?role_id=${roleId}`, null, token);
  check(mapsAfterFail.data.maps[0].max_layer === 19, '失败后地图进度停留在上一层', mapsAfterFail.data.maps[0]);

  console.log(`\n========== PASS ${passed} / FAIL ${failed} ==========\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((error) => { console.error(error); process.exit(1); });
