import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {requestWithHost} from './_http-client.mjs';

function open(server) {
  return new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(server.address().port)));
}
test('hosted self-managed model completes browser tool loop with checkpoints and no paid API key', {timeout:60000},async()=>{
  const fixture=http.createServer((_req,res)=>{
    res.writeHead(200,{'content-type':'text/html'});
    res.end('<!doctype html><title>Sample task completed</title><p>Verified outcome</p>');
  });
  const sitePort=await open(fixture);
  let calls=0,stateless=false,containsTools=false;
  const model=http.createServer(async(req,res)=>{
    if(req.url!=='/v1/responses') {res.writeHead(404);res.end();return;}
    let body='';for await(const ch of req)body+=ch.toString();
    const request=JSON.parse(body);calls++;
    containsTools=Array.isArray(request.tools) && request.tools.some(t=>t.name==='verify_page') &&
      !request.tools.some(t=>t.name==='inspect_visual');
    if(calls>=2)stateless=!request.previous_response_id &&
      (request.input||[]).some(x=>x.type==='function_call_output');
    const actions=[
      ['navigate',{url:'http://127.0.0.1:'+sitePort+'/'}],
      ['verify_page',{kind:'title',expected:'Sample task completed'}]
    ];
    const action=actions[calls-1];
    const output=action?[{id:'f'+calls,type:'function_call',name:action[0],
      call_id:'call'+calls,arguments:JSON.stringify(action[1]),status:'completed'}]:
      [{id:'m3',type:'message',role:'assistant',status:'completed',
        content:[{type:'output_text',text:'Verified the test title using the browser.',annotations:[]}]}];
    res.writeHead(200,{'content-type':'application/json'});
    res.end(JSON.stringify({object:'response',id:'resp'+calls,status:'completed',
      output,model:'simulated',usage:null}));
  });
  const modelPort=await open(model);
  const data=await fs.mkdtemp(path.join(os.tmpdir(),'workmode-compatible-'));
  const port=56000+Math.floor(Math.random()*2000);
  const proc=spawn(process.execPath,['server.js'],{cwd:process.cwd(),stdio:['ignore','pipe','pipe'],
    env:{...process.env,NODE_ENV:'test',WORKMODE_CLOUD_MODE:'1',WORKMODE_DATA_DIR:data,
      WORKMODE_CLOUD_ORIGIN:'https://workmode.example.com',
      WORKMODE_CLOUD_PASSWORD:'test-password-for-browser-integration',
      WORKMODE_SESSION_SECRET:'testing-private-long-secret-over-thirty-two',
      WORKMODE_AI_BASE_URL:'http://127.0.0.1:'+modelPort+'/v1',
      WORKMODE_AI_MODEL:'simulated',OPENAI_API_KEY:'',
      WORKMODE_TEST_ORIGIN:'http://127.0.0.1:'+sitePort,
      BROWSER_HEADLESS:'1',PORT:String(port)}});
  let errors='';proc.stderr.on('data',x=>errors+=x.toString());
  const root='http://127.0.0.1:'+port;
  const request=(route,method='GET',body,cookie)=>requestWithHost(root,route,{
    host:'workmode.example.com',origin:'https://workmode.example.com',method,
    body,cookie,timeoutMs:10000});
  try{
    let alive=false;
    for(let n=0;n<70;n++){
      try{if((await request('/api/health')).status===200){alive=true;break;}}catch{}
      await new Promise(r=>setTimeout(r,160));
    }
    assert.ok(alive,errors);
    const login=await request('/api/auth/login','POST',{password:'test-password-for-browser-integration'});
    assert.equal(login.status,200);
    const cookie=login.headers.get('set-cookie').split(';')[0];
    const settings=await (await request('/api/settings','GET',null,cookie)).json();
    assert.equal(settings.aiBackend,'compatible');
    assert.equal(settings.hasApiKey,true);
    assert.equal(JSON.stringify(settings).includes('WORKMODE_AI_BASE_URL'),false);
    const readiness=await (await request('/api/cloud/readiness','GET',null,cookie)).json();
    assert.equal(readiness.aiConfigured,true);
    const run=await request('/api/tasks','POST',{task:'Open test page and verify the page title'},cookie);
    assert.equal(run.status,200,await run.text().catch(()=>''));
    let state;
    for(let i=0;i<120;i++){
      state=await (await request('/api/status','GET',null,cookie)).json();
      if(!state.busy && state.task)break;
      await new Promise(r=>setTimeout(r,180));
    }
    assert.equal(state.phase,'done',state.answer||errors);
    assert.match(state.answer,/Verified the test title/);
    assert.equal(calls,3);
    assert.equal(containsTools,true);
    assert.equal(stateless,true);
    const journal=await (await request('/api/task-journal','GET',null,cookie)).json();
    assert.equal(journal.tasks[0].phase,'done');
    const encrypted=await fs.readFile(path.join(data,'task-checkpoints.enc'),'utf8');
    assert.equal(encrypted.includes('Open test page'),false);
    assert.equal((await request('/api/task-journal')).status,401);
  } finally {
    proc.kill('SIGKILL');
    fixture.closeAllConnections();
    model.closeAllConnections();
    await Promise.allSettled([
      new Promise(r=>fixture.close(r)),
      new Promise(r=>model.close(r)),
      fs.rm(data,{recursive:true,force:true,maxRetries:3,retryDelay:100})
    ]);
  }
});
