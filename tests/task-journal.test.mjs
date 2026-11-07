import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createTaskJournal} from '../lib/task-journal.js';

test('encrypted job journal survives restart and never replays unsafe unfinished actions', async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'workmode-jobs-'));
  const key='testing-private-key-larger-than-thirty-two-characters';
  try {
    let j=createTaskJournal({directory,secret:key});
    const work=await j.begin('Open the example site and click Submit');
    await j.update(work.id,{steps:2,lastAction:'Clicked a button'});
    const disk=await fs.readFile(j.filepath,'utf8');
    assert.equal(disk.includes('Open the example site'),false,'Task instructions must be encrypted');
    j=createTaskJournal({directory,secret:key});
    const interrupted=await j.recover();
    assert.equal(interrupted.length,1);
    assert.equal(interrupted[0].phase,'interrupted');
    assert.match(interrupted[0].answer,/no actions were automatically replayed/);
    assert.equal(interrupted[0].steps,2);
    assert.deepEqual(await j.recover(),[]);
    const next=await j.begin('Hello');
    await Promise.all([j.update(next.id,{steps:1}),j.update(next.id,{steps:2})]);
    await j.update(next.id,{phase:'done',answer:'Completed'});
    assert.equal((await j.list())[0].phase,'done');
    assert.throws(()=>createTaskJournal({directory,secret:'tiny'}),/strong secret/);
    const wrong=createTaskJournal({directory,secret:'wrong-key-with-more-than-32-characters'});
    await assert.rejects(wrong.list(),/unreadable/);
    await assert.rejects(wrong.begin('Must not overwrite'),/unreadable/);
    assert.equal((await j.list()).length,2);
  } finally {await fs.rm(directory,{recursive:true,force:true});}
});
