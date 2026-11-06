import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { requestWithHost } from './_http-client.mjs';

function listen(server) { return new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(server.address().port))); }

test('protected cloud mode supports sign-in, touch browser controls and secret-free logs', { timeout: 55000 }, async () => {
  const fixture = http.createServer((_req,res)=>{
    res.writeHead(200,{'content-type':'text/html; charset=utf-8'});
    res.end('<!doctype html><title>Remote test</title><button style="position:absolute;left:30px;top:20px;width:130px;height:48px" onclick="document.querySelector(\'#result\').textContent=\'Clicked successfully\'">Click Me</button><p id="result" style="position:absolute;top:100px">Waiting</p><input style="position:absolute;top:140px;left:30px">');
  });
  const fixturePort=await listen(fixture);
  const data=await fs.mkdtemp(path.join(os.tmpdir(),'work-mode-cloud-test-'));
  const port=43000+Math.floor(Math.random()*1500);
  const proc=spawn(process.execPath,['server.js'],{
    cwd:process.cwd(),windowsHide:true,
    env:{
      ...process.env, NODE_ENV:'test',WORKMODE_CLOUD_MODE:'1',
      WORKMODE_CLOUD_ORIGIN:'https://workmode.example.com',
      WORKMODE_CLOUD_PASSWORD:'safelongtestpassword-abc123',
      WORKMODE_SESSION_SECRET:'testing-session-secret-must-be-long-enough-123456',
      WORKMODE_DATA_DIR:data,
      WORKMODE_TEST_ORIGIN:'http://127.0.0.1:'+fixturePort,
      PORT:String(port),OPENAI_API_KEY:''
    },stdio:['ignore','pipe','pipe']
  });
  let errors='';
  proc.stderr.on('data',chunk=>{errors+=chunk.toString();});
  const base='http://127.0.0.1:'+port;
  const request = (endpoint,method='GET',payload,cookie) =>
    requestWithHost(base,endpoint,{
      method,host:'workmode.example.com',
      origin:'https://workmode.example.com',
      cookie,body:payload,timeoutMs:11000
    });
  try {
    let ready=false;
    for(let i=0;i<65;i++){
      if(proc.exitCode!==null)break;
      try {
        const r=await request('/api/health');
        if(r.status===200){ready=true;break;}
      }catch{}
      await new Promise(r=>setTimeout(r,170));
    }
    assert.ok(ready,'Cloud server did not start: '+errors);
    assert.equal((await request('/api/mode')).status,401);
    assert.equal((await request('/api/screenshot')).status,401);
    assert.equal((await request('/api/cloud/readiness')).status,401);
    assert.equal((await request('/api/events')).status,401);
    const health=await request('/api/health');
    assert.equal(health.status,200);
    assert.equal(health.headers.get('x-frame-options'),'DENY');
    assert.equal(health.headers.get('cache-control'),'no-store');
    assert.equal((await request('/')).status,302);
    const login=await request('/api/auth/login','POST',{password:'safelongtestpassword-abc123'});
    assert.equal(login.status,200);
    const cookie=login.headers.get('set-cookie').split(';')[0];
    const mode=await (await request('/api/mode','GET',undefined,cookie)).json();
    assert.equal(mode.cloud,true);
    const readiness=await (await request('/api/cloud/readiness','GET',undefined,cookie)).json();
    assert.equal(readiness.hosted,true);
    assert.equal(readiness.aiConfigured,false);
    assert.equal(readiness.dataDirectoryConfigured,true);
    assert.equal(readiness.dataDirectoryWritable,true);
    assert.equal(readiness.browserInstalled,true);
    const bad=await request('/api/remote/navigate','POST',{url:'http://127.0.0.1:1/private'},cookie);
    assert.equal(bad.status,400);
    const navigation=await request('/api/remote/navigate','POST',
      {url:'http://127.0.0.1:'+fixturePort+'/'},cookie);
    assert.equal(navigation.status,200,await navigation.text().catch(()=>'')); // consume below via status
    const click=await request('/api/remote/click','POST',{x:88,y:44},cookie);
    assert.equal(click.status,200);
    const screenshot=await request('/api/screenshot','GET',undefined,cookie);
    assert.equal(screenshot.status,200);
    assert.match(screenshot.headers.get('content-type'),/image\/jpeg/);
    const insert=await request('/api/remote/type','POST',{text:'dummy-password-never-log-this'},cookie);
    assert.equal(insert.status,200);
    const status=await (await request('/api/status','GET',undefined,cookie)).json();
    assert.equal(JSON.stringify(status).includes('dummy-password-never-log-this'),false);
    assert.equal((await request('/api/remote/key','POST',{key:'Tab'},cookie)).status,200);
    assert.equal((await request('/api/remote/scroll','POST',{direction:'down'},cookie)).status,200);
    assert.equal((await request('/api/history','GET',undefined,cookie)).status,200);
  } finally {
    proc.kill('SIGKILL');
    fixture.closeAllConnections();
    await Promise.allSettled([
      new Promise(resolve=>fixture.close(resolve)),
      fs.rm(data,{recursive:true,force:true,maxRetries:3,retryDelay:100})
    ]);
  }
});
