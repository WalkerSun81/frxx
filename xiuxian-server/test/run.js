const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

const root = path.resolve(__dirname, '..');
const tempDir = path.join(__dirname, '.tmp');
const dbPath = path.join(tempDir, 'xiuxian.test.db');
const port = 3100;
const baseUrl = `http://127.0.0.1:${port}`;
const tests = ['phase0.test.js', 'api.test.js', 'phase1.test.js', 'phase2.test.js', 'phase3.test.js', 'phase4-6.test.js', 'phase7.test.js', 'core-loop.test.js', 'security.test.js'];

function requestHealth() {
  return new Promise((resolve) => {
    const req = http.get(`${baseUrl}/api/health`, (res) => resolve(res.statusCode === 200));
    req.on('error', () => resolve(false));
    req.setTimeout(500, () => { req.destroy(); resolve(false); });
  });
}

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    if (await requestHealth()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('测试服务未在5秒内启动');
}

function run(file) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, file)], {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, XIUXIAN_DB_PATH: dbPath, NODE_ENV: 'test', PORT: String(port), TEST_BASE_URL: baseUrl },
    });
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${file} 失败，退出码 ${code}`)));
  });
}

async function main() {
  fs.rmSync(tempDir, { recursive: true, force: true });
  fs.mkdirSync(tempDir, { recursive: true });
  const server = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: { ...process.env, XIUXIAN_DB_PATH: dbPath, NODE_ENV: 'test', PORT: String(port), TEST_BASE_URL: baseUrl },
    stdio: 'inherit',
  });
  try {
    await waitForServer();
    for (const file of tests) await run(file);
  } finally {
    server.kill();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error.message); process.exit(1); });
