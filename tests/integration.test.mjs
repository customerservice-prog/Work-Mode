import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';

function listen(server) {
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
    server.once('error', reject);
  });
}
function stopServer(server) {
  return new Promise(resolve => server.close(() => resolve()));
}
async function json(url, options = {}) {
  const res = await fetch(url, options);
  return await res.json();
}

test('full task loop navigates, reads, clicks, verifies and reports without real API costs', { timeout: 55000 }, async () => {
  const webpage = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><title>Local browser test</title><button id="launch">Show Result</button><p id="result">Not verified yet</p><script>document.querySelector("#launch").onclick=()=>{document.querySelector("#result").textContent="Action verified";};</script>');
  });
  const sitePort = await listen(webpage);
  let count = 0;
  let didVerify = false;
  const llm = http.createServer(async (req, res) => {
    if (req.method !== 'POST' || req.url !== '/v1/responses') {
      res.writeHead(404); res.end(); return;
    }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    if (body.previous_response_id && count === 4) {
      didVerify = (Array.isArray(body.input) ? body.input : []).some(item => {
        if (item.type !== 'function_call_output') return false;
        try { return JSON.parse(item.output).verified === true; } catch { return false; }
      });
    }
    count++;
    const calls = [
      ['navigate', { url: 'http://127.0.0.1:' + sitePort + '/' }],
      ['read_page', {}],
      ['click_element', { id: '1' }],
      ['verify_page', { kind: 'text', expected: 'Action verified' }]
    ];
    const next = calls[count - 1];
    const answer = next
      ? { id: 'fc_' + count, type: 'function_call', name: next[0], arguments: JSON.stringify(next[1]), call_id: 'call_' + count, status: 'completed' }
      : null;
    const result = {
      id: 'resp_' + count, object: 'response', status: 'completed',
      output: answer ? [answer] : [], output_text: 'Verified the test page successfully.', model: 'test-mock', usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 }
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  });
  const llmPort = await listen(llm);
  const appPort = 49000 + Math.floor(Math.random() * 4000);
  const proc = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(), windowsHide: true,
    env: {
      ...process.env, NODE_ENV: 'test', BROWSER_HEADLESS: '1',
      OPENAI_API_KEY: 'integration-test-only',
      WORKMODE_TEST_AI_BASE_URL: 'http://127.0.0.1:' + llmPort + '/v1',
      WORKMODE_TEST_ORIGIN: 'http://127.0.0.1:' + sitePort,
      PORT: String(appPort), MAX_STEPS: '10'
    },
    stdio: ['ignore','pipe','pipe']
  });
  let errors = '';
  proc.stderr.on('data', data => { errors += data.toString(); });
  try {
    let ready = false;
    for (let i = 0; i < 70; i++) {
      if (proc.exitCode != null) break;
      try {
        const ping = await fetch('http://127.0.0.1:' + appPort + '/api/health');
        if (ping.ok) { ready = true; break; }
      } catch {}
      await new Promise(r => setTimeout(r, 180));
    }
    assert.ok(ready, 'Work-Mode did not start: ' + errors);
    const task = await fetch('http://127.0.0.1:' + appPort + '/api/tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: 'Open the test page, click Show Result and verify the result.' })
    });
    assert.equal(task.status, 200);
    let state;
    for (let i = 0; i < 100; i++) {
      state = await json('http://127.0.0.1:' + appPort + '/api/status');
      if (!state.busy && ['done','error','limited','stopped'].includes(state.phase)) break;
      await new Promise(r => setTimeout(r, 250));
    }
    assert.equal(state.phase, 'done', JSON.stringify({ state, errors }));
    assert.match(state.answer, /verified/i);
    assert.ok(didVerify, 'The verification tool did not return a verified result to the AI');
    assert.equal(count, 5);
    assert.ok(state.imageVersion > 0, 'No screenshots recorded');
    assert.ok(state.logs.some(event => /Verified page text condition: PASS/.test(event.message)), 'Verification was not logged');
    const screenshot = await fetch('http://127.0.0.1:' + appPort + '/api/screenshot');
    assert.equal(screenshot.status, 200);
    assert.match(screenshot.headers.get('content-type'), /image\/jpeg/i);
  } finally {
    proc.kill();
    await Promise.allSettled([stopServer(webpage), stopServer(llm)]);
  }
});
