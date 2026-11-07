import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

const directory=await fs.mkdtemp(path.join(os.tmpdir(),'workmode-offline-settings-'));
process.env.NODE_ENV='test';
process.env.WORKMODE_TEST_SETTINGS_DIR=directory;
const {readSettings,saveSettings,getPublicSettings,migrateLegacySettings}=await import('../lib/settings.js');

test('offline edition rejects paid API settings and migrates old credentials out of local settings',async()=>{
  try {
    await fs.writeFile(path.join(directory,'settings.json'),JSON.stringify({
      provider:'openai',apiKey:'old-key-must-be-erased',openaiModel:'gpt-4.1-mini'
    }));
    await migrateLegacySettings();
    const content=await fs.readFile(path.join(directory,'settings.json'),'utf8');
    assert.equal(content.includes('old-key-must-be-erased'),false);
    assert.equal(content.includes('openai'),false);
    assert.deepEqual(await readSettings(),{provider:'embedded',apiKey:'',openaiModel:''});
    const publicSettings=await getPublicSettings();
    assert.equal(publicSettings.provider,'embedded');
    assert.equal(publicSettings.hasApiKey,false);
    await assert.rejects(saveSettings({provider:'openai'}),/does not support paid/);
    await assert.rejects(saveSettings({provider:'embedded',apiKey:'secret'}),/API keys are not used/);
    const saved=await saveSettings({provider:'embedded'});
    assert.equal(saved.provider,'embedded');
  }finally{await fs.rm(directory,{recursive:true,force:true});}
});
