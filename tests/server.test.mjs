import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

test('Work-Mode starts locally and serves the chat interface', async () => {
  const port = '31689';
  const child = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: port, OPENAI_API_KEY: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk.toString(); });
  try {
    let healthy = false;
    for (let i = 0; i < 45; i++) {
      if (child.exitCode !== null) break;
      try {
        const response = await fetch('http://127.0.0.1:' + port + '/api/health');
        if (response.ok) {
          const body = await response.json();
          assert.equal(body.service, 'Work-Mode');
          assert.equal(body.local, true);
          healthy = true;
          break;
        }
      } catch {}
      await new Promise(r => setTimeout(r, 150));
    }
    assert.ok(healthy, 'Server did not start: ' + stderr);
    const response = await fetch('http://127.0.0.1:' + port + '/');
    assert.equal(response.status, 200);
    const page = await response.text();
    assert.match(page, /Work-Mode/);
    assert.match(page, /Run task/);
    const status = await (await fetch('http://127.0.0.1:' + port + '/api/status')).json();
    assert.equal(status.busy, false);
    assert.equal(status.hasBrowser, false);
  } finally {
    child.kill();
  }
});
