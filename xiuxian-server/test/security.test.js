const http = require('http');

const BASE = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const req = http.request({ method, hostname: url.hostname, port: url.port, path: url.pathname + url.search, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  const a = await request('POST', '/api/login', { device_id: `security_a_${Date.now()}` });
  const b = await request('POST', '/api/login', { device_id: `security_b_${Date.now()}` });
  const created = await request('POST', '/api/role/create', { name: '甲方角色' }, a.data.token);
  const roleId = created.data.role_id;

  const forbidden = await request('GET', `/api/role/info?role_id=${roleId}`, null, b.data.token);
  if (forbidden.code !== 3002) throw new Error(`越权读取未被拒绝: ${forbidden.code}`);

  const random = await request('POST', '/api/element/random', { role_id: roleId }, a.data.token);
  const confirmed = await request('POST', '/api/element/confirm', { role_id: roleId, metal: 100, wood: 0, water: 0, fire: 0, earth: 0, main_element: 1, cultivate_multiplier: 999 }, a.data.token);
  if (confirmed.code !== 0 || confirmed.data.cultivate_multiplier !== random.data.cultivate_multiplier) {
    throw new Error('灵根确认仍信任客户端伪造数值');
  }
  const negativeBuy = await request('POST', '/api/shop/buy', { role_id: roleId, item_id: 'enhance_stone_10', count: -1 }, a.data.token);
  if (negativeBuy.code !== 1001) throw new Error('负数购买未被拒绝');
  const life = await request('GET', `/api/life/info?role_id=${roleId}`, null, a.data.token);
  const collect = await request('POST', '/api/life/collect', { role_id: roleId }, a.data.token);
  const craft = await request('POST', '/api/life/craft', { role_id: roleId }, a.data.token);
  const gems = await request('GET', `/api/gem/list?role_id=${roleId}`, null, a.data.token);
  if (life.code !== 0 || collect.code !== 0 || craft.code !== 0 || gems.code !== 0) throw new Error('宝石或生活技能接口不可用');
  console.log('  PASS  权限、灵根、购买参数、宝石与生活技能接口');
}

main().catch((error) => { console.error(error.message); process.exit(1); });
