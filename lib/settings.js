import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

const DIRECTORY = process.env.NODE_ENV === 'test' && process.env.WORKMODE_TEST_SETTINGS_DIR
  ? path.resolve(process.env.WORKMODE_TEST_SETTINGS_DIR)
  : path.join(os.homedir(), '.work-mode');
const SETTINGS_FILE = path.join(DIRECTORY, 'settings.json');
const PROVIDERS = new Set(['embedded', 'openai']);
function modelName(value) {
  const s=String(value||'').trim();
  return /^[\w.:\-/]{2,100}$/.test(s) ? s : 'gpt-4.1-mini';
}
function providerName(name) {
  // Previous releases used Ollama. Migrate saved preferences to the model
  // now included with the Windows app, without requiring an extra installation.
  return name === 'openai' ? 'openai' : 'embedded';
}
export async function readSettings(){
  const defaults={
    provider:providerName(process.env.AI_PROVIDER),
    openaiModel:modelName(process.env.OPENAI_MODEL),
    apiKey:String(process.env.OPENAI_API_KEY||'').trim()
  };
  try{
    const disk=JSON.parse(await fs.readFile(SETTINGS_FILE,'utf8'));
    return {
      provider:providerName(disk.provider),
      openaiModel:modelName(disk.openaiModel||defaults.openaiModel),
      apiKey:String(disk.apiKey||defaults.apiKey)
    };
  }catch(err){
    if(err.code==='ENOENT')return defaults;
    throw err;
  }
}
export async function getPublicSettings(){
  const s=await readSettings();
  return {
    provider:s.provider,openaiModel:s.openaiModel,
    hasApiKey:Boolean(s.apiKey),
    builtIn:true,
    localModelInfo:'The AI engine and offline models are included with Work-Mode. No Ollama, API key, or separate model download is needed for the offline option.'
  };
}
export async function saveSettings(update={}){
  if(!PROVIDERS.has(update.provider))throw Error('Choose Built-in AI or OpenAI API');
  const prior=await readSettings();
  const openaiModel=modelName(update.openaiModel||prior.openaiModel);
  const apiKey=update.apiKey===undefined?prior.apiKey:String(update.apiKey||'').trim();
  if(apiKey.length>350)throw Error('API key is too long');
  const next={provider:update.provider,openaiModel,apiKey};
  await fs.mkdir(DIRECTORY,{recursive:true,mode:0o700});
  const temp=SETTINGS_FILE+'.tmp';
  await fs.writeFile(temp,JSON.stringify(next,null,2),{encoding:'utf8',mode:0o600});
  await fs.rename(temp,SETTINGS_FILE);
  return getPublicSettings();
}
