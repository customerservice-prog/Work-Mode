import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

test('cloud history migration preserves records, encrypts future writes and fails closed',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'workmode-history-'));
 const before={cloud:process.env.WORKMODE_CLOUD_MODE,dir:process.env.WORKMODE_DATA_DIR,
  secret:process.env.WORKMODE_SESSION_SECRET};
 process.env.WORKMODE_CLOUD_MODE='1';
 process.env.WORKMODE_DATA_DIR=dir;
 process.env.WORKMODE_SESSION_SECRET='testing-history-key-long-enough-for-encryption';
 try {
   const historic={id:'old-1',task:'Previously inspected example.com',phase:'done',
     answer:'Inspected',startedAt:'2026-01-01',finishedAt:'2026-01-01',steps:2,actions:[]};
   await fs.writeFile(path.join(dir,'task-history.json'),JSON.stringify([historic]),{mode:0o600});
   const history=await import('../lib/history.js?cloud-history-test='+Date.now());
   await history.migrateHistory();
   assert.equal((await history.listHistory()).length,1);
   const encrypted=await fs.readFile(path.join(dir,'task-history.enc'),'utf8');
   assert.equal(encrypted.includes('Previously inspected'),false);
   await assert.rejects(fs.access(path.join(dir,'task-history.json')),{code:'ENOENT'});
   await history.recordTask({task:'Search for party tents',phase:'done',answer:'Verified results',steps:1,actions:[]});
   const all=await history.listHistory();
   assert.equal(all.length,2);
   assert.equal(all[0].task,'Search for party tents');
   assert.equal(all[1].id,'old-1');
   await history.migrateHistory();
   assert.equal((await history.listHistory()).length,2);
   await fs.writeFile(path.join(dir,'task-history.enc'),'corrupt');
   await assert.rejects(history.listHistory(),/unreadable/);
   await assert.rejects(history.recordTask({task:'should not overwrite'}),/unreadable/);
 } finally {
   if(before.cloud===undefined)delete process.env.WORKMODE_CLOUD_MODE;else process.env.WORKMODE_CLOUD_MODE=before.cloud;
   if(before.dir===undefined)delete process.env.WORKMODE_DATA_DIR;else process.env.WORKMODE_DATA_DIR=before.dir;
   if(before.secret===undefined)delete process.env.WORKMODE_SESSION_SECRET;else process.env.WORKMODE_SESSION_SECRET=before.secret;
   await fs.rm(dir,{recursive:true,force:true});
 }
});
