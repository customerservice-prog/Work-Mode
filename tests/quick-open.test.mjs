import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';

test('low-cost PC can open a website and verify its page title without starting any AI', {timeout:35000}, async()=>{
  const website=http.createServer((_req,res)=>{
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
    res.end('<!doctype html><title>Offline navigation verified</title><h1>Free navigation</h1>');
  });
  await new Promise(resolve=>website.listen(0,'127.0.0.1',resolve));
  const target='http://127.0.0.1:'+website.address().port+'/';
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'work-mode-lite-test-'));
  const port=41000+Math.floor(Math.random()*1400);
  const proc=spawn(process.execPath,['server.js'],{
    cwd:process.cwd(),windowsHide:true,
    env:{...process.env, NODE_ENV:'test',BROWSER_HEADLESS:'1',AI_PROVIDER:'embedded',
      WORKMODE_TEST_PROFILE:path.join(directory,'profile'),
      WORKMODE_TEST_SETTINGS_DIR:path.join(directory,'settings'),
      WORKMODE_TEST_ORIGIN:new URL(target).origin,PORT:String(port)},
    stdio:['ignore','pipe','pipe']
  });
  let stderr='';proc.stderr.on('data',x=>{stderr+=String(x)});
  const root='http://127.0.0.1:'+port;
  try {
    let healthy=false;
    for(let i=0;i<65;i++){
      if(proc.exitCode!==null)break;
      try{
        const res=await fetch(root+'/api/health');
        if(res.ok){healthy=true;break;}
      }catch{}
      await new Promise(r=>setTimeout(r,150));
    }
    assert.ok(healthy,'Local desktop server did not start: '+stderr);
    const submission=await fetch(root+'/api/tasks',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({task:'Open '+target+' and tell me the page title'})
    });
    assert.equal(submission.status,200);
    let state;
    for(let i=0;i<80;i++){
      try{state=await(await fetch(root+'/api/status')).json();}catch{}
      if(state&&!state.busy&&['done','error','stopped','limited'].includes(state.phase))break;
      await new Promise(r=>setTimeout(r,230));
    }
    assert.equal(state?.phase,'done',JSON.stringify({state,stderr}));
    assert.match(state.answer,/Offline navigation verified/);
    assert.match(state.answer,/without loading the AI model/);
    const ai=await(await fetch(root+'/api/built-in/status')).json();
    assert.equal(ai.ready,false);
    assert.equal(ai.phase,'not-started');
    const page=await fetch(root+'/api/screenshot');
    assert.equal(page.status,200);
    assert.match(page.headers.get('content-type'),/image\/jpeg/i);
  }finally{
    proc.kill('SIGKILL');
    website.closeAllConnections();
    await new Promise(resolve=>website.close(resolve));
    await fs.rm(directory,{recursive:true,force:true,maxRetries:3,retryDelay:100});
  }
});
