/**
 * 基础 API 测试
 * 用法: node test/api.test.js
 */

const http = require('http');

const BASE = 'http://localhost:3000';
let token = '';
let failures = 0;

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`  PASS  ${name}`);
  } catch (e) {
    console.log(`  FAIL  ${name} — ${e.message}`);
    failures++;
  }
}

(async function main() {
  console.log('\n========== API 测试 ==========\n');

  // 1. 健康检查
  await test('GET /api/health', async () => {
    const resp = await request('GET', '/api/health');
    if (resp.code !== 0) throw new Error(`code=${resp.code}`);
  });

  // 2. 登录
  const deviceId = 'test_device_001';
  await test('POST /api/login', async () => {
    const resp = await request('POST', '/api/login', { device_id: deviceId });
    if (resp.code !== 0) throw new Error(`code=${resp.code} msg=${resp.msg}`);
    token = resp.data.token;
    if (!token) throw new Error('缺少 token');
    console.log(`       player_id=${resp.data.player_id} roles=${resp.data.roles.length}`);
  });

  // 3. 再次登录（验证幂等）
  await test('POST /api/login (same device)', async () => {
    const resp = await request('POST', '/api/login', { device_id: deviceId });
    if (resp.code !== 0) throw new Error(`重复登录失败 code=${resp.code}`);
    token = resp.data.token;
  });

  // 4. 需要认证的接口（无token应被拒绝）
  await test('GET /api/role/info (无token)', async () => {
    const saved = token;
    token = '';
    const resp = await request('GET', '/api/role/info?role_id=1');
    if (resp.code !== 1003) throw new Error(`预期1003，实际${resp.code}`);
    token = saved;
  });

  // 汇总
  console.log(`\n========== ${failures === 0 ? '全部通过' : `失败 ${failures} 项`} ==========\n`);
  process.exit(failures > 0 ? 1 : 0);
})();
