import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createTokenBudget, TokenBudgetExceeded } from '../lib/cloud-budget.js';

test('AI daily and monthly quotas persist across reloads, block excess use and reset by UTC period',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'workmode-budget-test-'));
  let when=new Date('2026-11-06T14:00:00Z');
  const opts={directory,env:{WORKMODE_DAILY_TOKEN_LIMIT:'1500',WORKMODE_MONTHLY_TOKEN_LIMIT:'2500'},now:()=>when};
  try{
    let b=createTokenBudget(opts);
    assert.equal((await b.requireAvailable()).dailyRemaining,1500);
    await Promise.all([b.recordUsage({total_tokens:500}),b.recordUsage({total_tokens:600})]);
    let status=await b.getStatus();
    assert.equal(status.dayTokens,1100);
    assert.equal(status.monthTokens,1100);
    b=createTokenBudget(opts); // Simulates a service restart using the same volume.
    status=await b.requireAvailable();
    assert.equal(status.dailyRemaining,400);
    await assert.rejects(b.recordUsage({total_tokens:450}),TokenBudgetExceeded);
    status=await b.getStatus();
    assert.equal(status.dayTokens,1550); // Over-budget final request is still accounted.
    await assert.rejects(b.requireAvailable(),TokenBudgetExceeded);
    when=new Date('2026-11-07T00:00:00Z');
    status=await b.requireAvailable();
    assert.equal(status.dayTokens,0);
    assert.equal(status.monthTokens,1550);
    await assert.rejects(b.recordUsage({total_tokens:1000}),TokenBudgetExceeded);
    status=await b.getStatus();
    assert.equal(status.monthTokens,2550);
    when=new Date('2026-12-01T00:00:00Z');
    status=await b.requireAvailable();
    assert.equal(status.dayTokens,0);
    assert.equal(status.monthTokens,0);
    assert.equal(status.monthlyRemaining,2500);
  }finally{
    await fs.rm(directory,{recursive:true,force:true});
  }
});

test('AI budget rejects missing token usage and corrupt ledgers rather than silently continuing',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'workmode-budget-bad-'));
  try {
    const b=createTokenBudget({directory});
    await assert.rejects(b.recordUsage({}),/valid token usage/);
    await assert.rejects(b.recordUsage({total_tokens:-2}),/valid token usage/);
    await fs.writeFile(path.join(directory,'ai-usage.json'),'not json');
    await assert.rejects(b.requireAvailable());
    await assert.rejects(b.recordUsage({total_tokens:100}));
    assert.throws(()=>createTokenBudget({directory,env:{WORKMODE_DAILY_TOKEN_LIMIT:'-1'}}),/daily/i);
    assert.throws(()=>createTokenBudget({directory,env:{WORKMODE_DAILY_TOKEN_LIMIT:'10000',WORKMODE_MONTHLY_TOKEN_LIMIT:'2000'}}),/Monthly/);
  }finally{
    await fs.rm(directory,{recursive:true,force:true});
  }
});
