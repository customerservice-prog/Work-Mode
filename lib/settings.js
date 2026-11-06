import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

const DIRECTORY = process.env.NODE_ENV === 'test' && process.env.WORKMODE_TEST_SETTINGS_DIR
  ? path.resolve(process.env.WORKMODE_TEST_SETTINGS_DIR)
  : path.join(os.homedir(), '.work-mode');
const SETTINGS_FILE = path.join(DIRECTORY, 'settings.json');
const VALID_PROVIDERS = new Set(['openai', 'ollama']);

function validModel(input, fallback) {
  const value = String(input ?? '').trim();
  return /^[\w.:\-/]{2,100}$/.test(value) ? value : fallback;
}

export async function readSettings() {
  const defaults = {
    provider: String(process.env.AI_PROVIDER || 'ollama').toLowerCase() === 'openai' ? 'openai' : 'ollama',
    openaiModel: validModel(process.env.OPENAI_MODEL, 'gpt-4.1-mini'),
    ollamaModel: validModel(process.env.OLLAMA_MODEL, 'qwen3:8b'),
    apiKey: String(process.env.OPENAI_API_KEY || '').trim()
  };
  try {
    const disk = JSON.parse(await fs.readFile(SETTINGS_FILE, 'utf8'));
    return {
      provider: VALID_PROVIDERS.has(disk.provider) ? disk.provider : defaults.provider,
      openaiModel: validModel(disk.openaiModel, defaults.openaiModel),
      ollamaModel: validModel(disk.ollamaModel, defaults.ollamaModel),
      apiKey: String(disk.apiKey || defaults.apiKey)
    };
  } catch (err) {
    if (err.code === 'ENOENT') return defaults;
    throw err;
  }
}

export async function getPublicSettings() {
  const s = await readSettings();
  return {
    provider: s.provider,
    openaiModel: s.openaiModel,
    ollamaModel: s.ollamaModel,
    hasApiKey: Boolean(s.apiKey),
    localModelInfo: 'Free local mode requires Ollama running on your PC with your selected model downloaded.'
  };
}

export async function saveSettings(update = {}) {
  const old = await readSettings();
  if (!VALID_PROVIDERS.has(update.provider)) throw new Error('Choose OpenAI or local Ollama');
  const openaiModel = validModel(update.openaiModel, old.openaiModel);
  const ollamaModel = validModel(update.ollamaModel, old.ollamaModel);
  const newKey = update.apiKey === undefined ? old.apiKey : String(update.apiKey || '').trim();
  if (newKey.length > 350) throw new Error('API key is too long');
  const next = { provider: update.provider, openaiModel, ollamaModel, apiKey: newKey };
  await fs.mkdir(DIRECTORY, { recursive: true, mode: 0o700 });
  const temp = SETTINGS_FILE + '.tmp';
  await fs.writeFile(temp, JSON.stringify(next, null, 2), { encoding: 'utf8', mode: 0o600 });
  await fs.rename(temp, SETTINGS_FILE);
  return getPublicSettings();
}
