import test from 'node:test';
import assert from 'node:assert/strict';
import {parseBasicCommand, BASIC_HELP} from '../lib/basic-commands.js';

test('no-API browser commands parse safely without fabricating free-form AI actions', () => {
  assert.equal(parseBasicCommand('hi').kind, 'greeting');
  assert.equal(parseBasicCommand('Help').kind, 'help');
  assert.deepEqual(parseBasicCommand('Scroll down'),{kind:'scroll',direction:'down'});
  assert.equal(parseBasicCommand('Open https://www.google.com and tell me the page title').url,'https://www.google.com/');
  assert.equal(parseBasicCommand('Open google.com').kind,'navigate');
  assert.equal(parseBasicCommand('Search the web for party tents').url,'https://www.google.com/search?q=party%20tents');
  assert.equal(parseBasicCommand('What is the page title?').kind,'title');
  assert.equal(parseBasicCommand('Read the page').kind,'read');
  assert.equal(parseBasicCommand('Click Search').label,'Search');
  assert.deepEqual(parseBasicCommand('Type "party tents" into "Search"'),{kind:'fill',value:'party tents',label:'Search'});
  assert.equal(parseBasicCommand('Verify page contains Google').expected,'Google');
  assert.equal(parseBasicCommand('Go back').kind,'back');
  assert.equal(parseBasicCommand('List tabs').kind,'tabs');
  assert.equal(parseBasicCommand('Take a screenshot').kind,'screenshot');
  assert.deepEqual(parseBasicCommand('Switch to tab 2'),{kind:'switch_tab',index:2});
  assert.equal(parseBasicCommand('Open localhost:4000').kind,'unsupported');
  assert.equal(parseBasicCommand('Build me a brand-new website and deploy it').kind,'unsupported');
  assert.match(BASIC_HELP,/not an LLM|no AI model/i);
});
