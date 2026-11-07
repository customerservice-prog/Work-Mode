import test from 'node:test';
import assert from 'node:assert/strict';
import { hostedAI } from '../lib/hosted-ai.js';
import { cloudRequirements } from '../lib/cloud-config.js';

test('hosted model configuration: optional, private, and explicit',()=>{
  assert.equal(hostedAI({}).mode,'basic');
  assert.equal(hostedAI({}).configured,false);
  assert.equal(hostedAI({OPENAI_API_KEY:'some-key'}).mode,'openai');
  const self=hostedAI({WORKMODE_AI_BASE_URL:'http://model.railway.internal:11434/v1',
    WORKMODE_AI_MODEL:'qwen3:0.6b'});
  assert.equal(self.mode,'compatible');
  assert.equal(self.configured,true);
  assert.equal(self.stateless,true);
  assert.equal(self.baseURL,'http://model.railway.internal:11434/v1');
  assert.equal(cloudRequirements({WORKMODE_AI_BASE_URL:'http://model.railway.internal:11434/v1',
    WORKMODE_AI_MODEL:'qwen3:0.6b'}).aiConfigured,true);
  assert.equal(hostedAI({WORKMODE_AI_BASE_URL:'https://models.example.com/v1/',
    WORKMODE_AI_MODEL:'small'}).baseURL,'https://models.example.com/v1');
  assert.throws(()=>hostedAI({WORKMODE_AI_BASE_URL:'http://evil.example/v1',WORKMODE_AI_MODEL:'m'}),/HTTPS/);
  assert.throws(()=>hostedAI({WORKMODE_AI_BASE_URL:'https://u:p@example.com/v1',WORKMODE_AI_MODEL:'m'}),/credentials/);
  assert.throws(()=>hostedAI({WORKMODE_AI_BASE_URL:'https://example.com/v1'}),/WORKMODE_AI_MODEL/);
  assert.throws(()=>hostedAI({WORKMODE_AI_BASE_URL:'file:///tmp/m',WORKMODE_AI_MODEL:'m'}),/HTTPS/);
  assert.equal(hostedAI({NODE_ENV:'test',WORKMODE_AI_BASE_URL:'http://127.0.0.1:3123/v1',
    WORKMODE_AI_MODEL:'m'}).mode,'compatible');
});
