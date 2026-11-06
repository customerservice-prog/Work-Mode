import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { detectOllama, pullOllama } from '../lib/local-ai.js';

test('local AI setup detects missing and installed model and streams progress', async () => {
  let present = false;
  const mock = http.createServer(async (req,res) => {
    if (req.url === '/api/tags') {
      res.setHeader('content-type','application/json');
      res.end(JSON.stringify({ models: present ? [{ name: 'qwen3:8b' }] : [] }));
      return;
    }
    if (req.url === '/api/pull') {
      const body = [];
      for await (const chunk of req) body.push(chunk);
      const parsed = JSON.parse(Buffer.concat(body).toString());
      assert.equal(parsed.model,'qwen3:8b');
      res.setHeader('content-type','application/x-ndjson');
      res.write(JSON.stringify({status:'downloading', total:100, completed:40}) + '\n');
      res.write(JSON.stringify({status:'downloading', total:100, completed:100}) + '\n');
      res.end(JSON.stringify({status:'success'})+'\n');
      present = true;
      return;
    }
    res.statusCode=404;res.end();
  });
  await new Promise(resolve=>mock.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+mock.address().port;
  try {
    const initial=await detectOllama('qwen3:8b',url);
    assert.equal(initial.running,true);
    assert.equal(initial.installed,false);
    const progress=[];
    const result=await pullOllama('qwen3:8b',item=>progress.push(item),undefined,url);
    assert.equal(result.ok,true);
    assert.deepEqual(progress.filter(p=>p.percent != null).map(p=>p.percent),[40,100]);
    assert.equal(progress.at(-1).status,'success');
    assert.equal((await detectOllama('qwen3:8b',url)).installed,true);
    await assert.rejects(()=>pullOllama('invalid model name!',null,undefined,url),/valid Ollama model/);
  } finally {
    mock.closeAllConnections();
    await new Promise(resolve=>mock.close(resolve));
  }
});

test('local AI setup reports Ollama absent without crashing', async () => {
  const result=await detectOllama('qwen3:8b','http://127.0.0.1:9');
  assert.equal(result.running,false);
  assert.equal(result.installed,false);
});
