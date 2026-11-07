import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=new URL('../',import.meta.url);
const rel=file=>new URL(file,root);
test('Edge extension is Manifest V3, opt-in per-site and does not require an AI API key',async()=>{
  const manifest=JSON.parse(await fs.readFile(rel('extension/manifest.json'),'utf8'));
  assert.equal(manifest.manifest_version,3);
  assert.equal(manifest.background.service_worker,'background.js');
  assert.ok(manifest.optional_host_permissions.includes('https://*/*'));
  assert.ok(manifest.content_scripts[0].matches.includes('https://work-mode-production.up.railway.app/*'));
  assert.equal(manifest.host_permissions.includes('<all_urls>'),false);
  assert.equal(manifest.permissions.includes('debugger'),false);
  const src=await fs.readFile(rel('extension/background.js'),'utf8');
  assert.match(src,/chrome\.permissions\.contains/);
  assert.match(src,/confirmed!==true/);
  assert.match(src,/isSensitive/);
  const bridge=await fs.readFile(rel('extension/bridge.js'),'utf8');
  assert.match(bridge,/event\.source!==window/);
  assert.match(bridge,/event\.origin!==ORIGIN/);
  for(const file of ['extension/background.js','extension/bridge.js','extension/policy.js','extension/popup.js',
      'public/edge-tabs.js','public/edge-facebook.js']){
    assert.doesNotThrow(()=>execFileSync(process.execPath,['--check',fileURLToPath(rel(file))]),file+' must parse');
  }
});
test('extension forbids internal addresses, secret fields and silent publish clicks',async()=>{
  const source=await fs.readFile(rel('extension/policy.js'),'utf8');
  const context={globalThis:{},URL};
  vm.runInNewContext(source,context);
  const p=context.globalThis.WorkModeTabPolicy;
  assert.equal(p.supportedUrl('https://www.facebook.com/groups/12345678/'),true);
  for(const raw of ['chrome://extensions','edge://settings','file:///etc/passwd',
    'http://127.0.0.1','http://10.1.1.3/','http://192.168.1.4/',
    'http://169.254.169.254','http://[::1]/','http://[fd00::1]/',
    'http://metadata.google.internal/','https://example.internal/']){
    assert.equal(p.supportedUrl(raw),false,'Should block '+raw);
  }
  assert.equal(p.isSecret({type:'password'}),true);
  assert.equal(p.isSecret({label:'Verification code'}),true);
  assert.equal(p.highImpact({label:'Post'}),true);
  assert.equal(p.highImpact({label:'Send'}),true);
  assert.equal(p.highImpact({label:'Share'}),true);
  assert.equal(p.highImpact({label:'Open menu'}),false);
  assert.equal(p.fromWorkMode({url:'https://evil.example/'}),false);
  assert.equal(p.fromWorkMode({url:'https://work-mode-production.up.railway.app/'}),true);
  assert.equal(p.allowAction('eval'),false);
  assert.equal(p.allowAction('verify_post'),true);
});
