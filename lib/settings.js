import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

const DIRECTORY = process.env.NODE_ENV === 'test' && process.env.WORKMODE_TEST_SETTINGS_DIR
  ? path.resolve(process.env.WORKMODE_TEST_SETTINGS_DIR)
  : path.join(os.homedir(), '.work-mode');
const SETTINGS_FILE = path.join(DIRECTORY, 'settings.json');
const TEST_API = process.env.NODE_ENV === 'test' && process.env.WORKMODE_TEST_ALLOW_REMOTE_AI === '1';

export async function readSettings() {
  // The distributed Windows app is always offline-only. The OpenAI-compatible
  // client library talks exclusively to the included local llama.cpp server.
  // Legacy settings are not permitted to enable metered API calls.
  if (TEST_API) return {
    provider:'openai',openaiModel:'gpt-4.1-mini',
    apiKey:'integration-test-only'
  };
  return {provider:'embedded',apiKey:'',openaiModel:''};
}

export async function getPublicSettings() {
  return {
    provider:'embedded',hasApiKey:false,builtIn:true,
    localModelInfo:'Lite-only offline AI is included. No Ollama, API key, usage credits, or monthly subscription required.'
  };
}

export async function saveSettings(update = {}) {
  if (update.provider && update.provider !== 'embedded') {
    throw new Error('This free offline edition does not support paid API providers');
  }
  if (update.apiKey) {
    throw new Error('API keys are not used by this free offline edition');
  }
  await fs.mkdir(DIRECTORY, { recursive:true,mode:0o700 });
  const tmp = SETTINGS_FILE + '.tmp';
  await fs.writeFile(tmp,JSON.stringify({provider:'embedded'},null,2),{encoding:'utf8',mode:0o600});
  await fs.rename(tmp,SETTINGS_FILE);
  return getPublicSettings();
}

// On startup, discard any provider settings left by older Work-Mode releases.
// This also prevents a previously saved API key from remaining in app settings.
export async function migrateLegacySettings() {
  if (TEST_API) return;
  try {
    const old = await fs.readFile(SETTINGS_FILE,'utf8');
    if (old.includes('apiKey') || old.includes('openai') || old.includes('ollama')) {
      await saveSettings({provider:'embedded'});
    }
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}
