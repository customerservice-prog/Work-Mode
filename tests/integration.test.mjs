import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

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
  const res = await fetch(url, { ...options, signal: AbortSignal.timeout(3000) });
  return await res.json();
}

for (const provider of ['openai']) {
 test('full task loop (' + provider + ') navigates, reads, clicks, verifies and reports without real API costs', { timeout: 45000 }, async () => {
  const webpage = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><title>Local browser test</title><button id="launch">Show Result</button><input name="one-time-code" type="text" value="TEST-SECRET-OTP"><input type="password" value="TEST-SECRET-PASSWORD"><input aria-label="API key" value="TEST-SECRET-API-KEY"><p id="result">Not verified yet</p><script>document.querySelector("#launch").onclick=()=>{document.querySelector("#result").textContent="Action verified";};</script>');
  });
  const sitePort = await listen(webpage);
  let count = 0;
  let didVerify = false;
  let statelessOk = false;
  let modelToolChoiceOk = false;
  let secretFieldsRedacted = false;
  const llm = http.createServer(async (req, res) => {
    if (req.url === '/api/tags') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ models: [{ name: 'simulated-local' }] }));
      return;
    }
    if (req.method !== 'POST' || req.url !== '/v1/responses') {
      res.writeHead(404); res.end(); return;
    }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    if (count === 4) {
      if (provider === 'ollama') {
        statelessOk = !body.previous_response_id && (body.input || []).some(item => item.type === 'function_call');
      } else {
        statelessOk = Boolean(body.previous_response_id);
      }
      didVerify = (Array.isArray(body.input) ? body.input : []).some(item => {
        if (item.type !== 'function_call_output') return false;
        try { return JSON.parse(item.output).verified === true; } catch { return false; }
      });
    }
    if (count === 2) {
      const outputs=(Array.isArray(body.input)?body.input:[]).filter(x=>x.type==='function_call_output').map(x=>x.output).join(' ');
      secretFieldsRedacted = outputs.includes('[redacted]') &&
        !outputs.includes('TEST-SECRET-OTP') &&
        !outputs.includes('TEST-SECRET-PASSWORD') &&
        !outputs.includes('TEST-SECRET-API-KEY');
    }
    if (count === 0) {
      const offeredTools = Array.isArray(body.tools) ? body.tools.map(t => t.name) : [];
      modelToolChoiceOk = provider === 'ollama'
        ? !offeredTools.includes('inspect_visual') && offeredTools.includes('verify_page')
        : offeredTools.includes('inspect_visual') && offeredTools.includes('verify_page');
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
      output: answer ? [answer] : [{
        id: 'msg_' + count, type: 'message', role: 'assistant', status: 'completed',
        content: [{ type: 'output_text', text: 'Verified the test page successfully.', annotations: [] }]
      }], model: 'test-mock', usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 }
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  });
  const llmPort = await listen(llm);
  const appPort = 49000 + Math.floor(Math.random() * 4000);
  const testProfile = await fs.mkdtemp(path.join(os.tmpdir(), 'work-mode-integration-'));
  const proc = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(), windowsHide: true,
    env: {
      ...process.env, NODE_ENV: 'test', BROWSER_HEADLESS: '1',
      AI_PROVIDER: provider, OLLAMA_MODEL: 'simulated-local', WORKMODE_TEST_PROFILE: testProfile,
      OPENAI_API_KEY: 'integration-test-only',
      WORKMODE_TEST_AI_BASE_URL: 'http://127.0.0.1:' + llmPort + '/v1',
      WORKMODE_TEST_OLLAMA_BASEURL: 'http://127.0.0.1:' + llmPort,
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
    for (let i = 0; i < 80; i++) {
      try { state = await json('http://127.0.0.1:' + appPort + '/api/status'); }
      catch { if (proc.exitCode !== null) break; }
      if (!state.busy && ['done','error','limited','stopped'].includes(state.phase)) break;
      await new Promise(r => setTimeout(r, 250));
    }
    assert.equal(state.phase, 'done', JSON.stringify({ state, errors }));
    assert.match(state.answer, /verified/i);
    assert.ok(didVerify, 'The verification tool did not return a verified result to the AI');
    assert.ok(statelessOk, 'The correct stateful/stateless tool-call context was not used');
    assert.ok(modelToolChoiceOk, 'Model received tools inappropriate for its visual capabilities');
    assert.ok(secretFieldsRedacted,'Sensitive form values were disclosed to the AI model');
    assert.equal(count, 5);
    assert.ok(state.imageVersion > 0, 'No screenshots recorded');
    assert.ok(state.logs.some(event => /Verified page text condition: PASS/.test(event.message)), 'Verification was not logged');
    const screenshot = await fetch('http://127.0.0.1:' + appPort + '/api/screenshot');
    assert.equal(screenshot.status, 200);
    assert.match(screenshot.headers.get('content-type'), /image\/jpeg/i);
  } finally {
    proc.kill('SIGKILL');
    webpage.closeAllConnections();
    llm.closeAllConnections();
    await Promise.allSettled([stopServer(webpage), stopServer(llm)]);
    await fs.rm(testProfile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }).catch(() => {});
  }
 });
}
