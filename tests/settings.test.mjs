import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'workmode-settings-test-'));
process.env.NODE_ENV = 'test';
process.env.WORKMODE_TEST_SETTINGS_DIR = directory;
const { readSettings, saveSettings, getPublicSettings } = await import('../lib/settings.js');

test('AI provider settings persist locally and never expose saved keys', async () => {
  try {
    const prior = await readSettings();
    assert.ok(prior.provider === 'openai' || prior.provider === 'ollama');
    const saved = await saveSettings({
      provider: 'ollama', ollamaModel: 'qwen3:8b', openaiModel: 'gpt-4.1-mini',
      apiKey: 'test-only-not-a-real-key'
    });
    assert.equal(saved.provider, 'ollama');
    assert.equal(saved.hasApiKey, true);
    assert.equal(JSON.stringify(saved).includes('test-only-not-a-real-key'), false);
    assert.equal((await readSettings()).apiKey, 'test-only-not-a-real-key');
    const changed = await saveSettings({ provider: 'openai', openaiModel: 'gpt-4.1-mini', ollamaModel: 'qwen3:8b' });
    assert.equal(changed.provider, 'openai');
    assert.equal((await getPublicSettings()).hasApiKey, true);
    await assert.rejects(() => saveSettings({ provider: 'unsupported' }), /Choose/);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
