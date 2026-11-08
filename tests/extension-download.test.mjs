import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {makeEdgeExtensionZip,zipStoredFiles} from '../lib/extension-download.js';
import {requestWithHost} from './_http-client.mjs';

function inspectZip(data) {
  assert.equal(data.readUInt32LE(0),0x04034b50);
  const seen=new Map();
  let offset=0;
  while (offset<data.length && data.readUInt32LE(offset)===0x04034b50) {
    const flags=data.readUInt16LE(offset+6),method=data.readUInt16LE(offset+8);
    const crc=data.readUInt32LE(offset+14),size=data.readUInt32LE(offset+18);
    const length=data.readUInt16LE(offset+26),extra=data.readUInt16LE(offset+28);
    assert.equal(flags,0);assert.equal(method,0);
    const name=data.subarray(offset+30,offset+30+length).toString('utf8');
    const content=data.subarray(offset+30+length+extra,offset+30+length+extra+size);
    assert.equal(content.length,size);
    seen.set(name,{content,crc});
    offset+=30+length+extra+size;
  }
  assert.equal(data.readUInt32LE(offset),0x02014b50);
  const end=data.subarray(data.length-22);
  assert.equal(end.readUInt32LE(0),0x06054b50);
  assert.equal(end.readUInt16LE(10),seen.size);
  assert.equal(end.readUInt32LE(16),offset);
  return seen;
}
test('direct Edge extension ZIP includes correct, complete installable files',async()=>{
  const zip=await makeEdgeExtensionZip();
  const entries=inspectZip(zip);
  const expected=['manifest.json','background.js','bridge.js','policy.js','popup.html','popup.js','README.md'];
  assert.deepEqual([...entries.keys()],expected);
  for(const file of expected){
    const contents=await fs.readFile(new URL('../extension/'+file,import.meta.url));
    assert.deepEqual(entries.get(file).content,contents,file);
  }
  const manifest=JSON.parse(entries.get('manifest.json').content.toString('utf8'));
  assert.equal(manifest.manifest_version,3);
  assert.deepEqual(manifest.background,{service_worker:'background.js'});
  assert.throws(()=>zipStoredFiles([['../secret','hi']]),/Unsafe archive filename/);
  assert.throws(()=>zipStoredFiles([['foo','hi'],['foo','bye']]),/Unsafe archive filename/);
});
test('Railway serves ZIP before login without exposing protected APIs', {timeout:25000},async()=>{
  const data=await fs.mkdtemp(path.join(os.tmpdir(),'workmode-edgezip-'));
  const port=60000+Math.floor(Math.random()*3000);
  const proc=spawn(process.execPath,['server.js'],{cwd:process.cwd(),stdio:['ignore','pipe','pipe'],
    env:{...process.env,NODE_ENV:'test',PORT:String(port),WORKMODE_CLOUD_MODE:'1',
      WORKMODE_CLOUD_ORIGIN:'https://workmode.example.com',
      WORKMODE_CLOUD_PASSWORD:'long-test-password-for-edge-zip',
      WORKMODE_SESSION_SECRET:'very-long-secret-for-zip-test-over-32-characters',
      WORKMODE_DATA_DIR:data,OPENAI_API_KEY:''}});
  let stderr='';proc.stderr.on('data',buf=>stderr+=buf.toString());
  const root='http://127.0.0.1:'+port;
  const req=(path)=>requestWithHost(root,path,{host:'workmode.example.com',origin:'https://workmode.example.com',timeoutMs:10000});
  try{
    let online=false;
    for(let n=0;n<80;n++){
      try {const p=await req('/api/health');if(p.status===200){online=true;break;}} catch{}
      await new Promise(resolve=>setTimeout(resolve,160));
    }
    assert.ok(online,stderr);
    const response=await req('/downloads/work-mode-edge-connector.zip');
    assert.equal(response.status,200);
    assert.match(response.headers.get('content-type'),/application\/zip/);
    assert.match(response.headers.get('content-disposition'),/attachment/);
    assert.equal(response.headers.get('cache-control'),'no-store');
    const zip=Buffer.from(await response.arrayBuffer());
    assert.equal(inspectZip(zip).size,7);
    assert.equal((await req('/api/status')).status,401);
  }finally{
    proc.kill('SIGKILL');
    await fs.rm(data,{force:true,recursive:true,maxRetries:3,retryDelay:100});
  }
});
