const settingsEl = id => document.getElementById(id);
let settingsBusy = false;
let hostedSettings = false;

async function settingsRequest(url, data) {
  const options = data === undefined ? {} : {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  };
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Work-Mode could not complete this request');
  return body;
}
function updateProviderVisibility() {
  const local = settingsEl('aiProvider').value === 'ollama';
  settingsEl('localFields').style.display = local ? 'block' : 'none';
  settingsEl('apiFields').style.display = local ? 'none' : 'block';
}
async function refreshLocalAI() {
  if (settingsEl('aiProvider').value !== 'ollama') return;
  const statusEl = settingsEl('localAIStatus');
  statusEl.textContent = 'Checking local AI…';
  settingsEl('downloadLocalModel').disabled = true;
  try {
    const status = await settingsRequest('/api/local-ai/status');
    const dl = status.downloading || {};
    if (dl.running) {
      const percentage = dl.percent == null ? '' : ' (' + dl.percent + '% of the current download layer)';
      statusEl.textContent = (dl.status || 'Downloading AI model…') + percentage;
    } else if (!status.running) {
      statusEl.textContent = 'Ollama is not running. Click the Ollama installation link above, install and open it, then click Check again.';
    } else if (status.installed) {
      statusEl.textContent = 'Ready: ' + status.model + ' is installed. Save settings and start using Work-Mode.';
    } else {
      statusEl.textContent = 'Ollama is running, but ' + status.model + ' is not downloaded. Click Download AI model.';
    }
    if (!dl.running && dl.error) statusEl.textContent += ' Download error: ' + dl.error;
    settingsEl('downloadLocalModel').disabled = !status.running || status.installed || Boolean(dl.running);
    settingsEl('cancelLocalModel').style.display = dl.running ? 'inline-flex' : 'none';
  } catch (err) {
    statusEl.textContent = 'Could not check local AI: ' + err.message;
  }
}
async function saveAISettings() {
  const data = {
    provider: settingsEl('aiProvider').value,
    openaiModel: settingsEl('apiModel').value.trim(),
    ollamaModel: settingsEl('ollamaModel').value.trim()
  };
  if (settingsEl('apiKey').value.trim()) data.apiKey = settingsEl('apiKey').value.trim();
  const result = await settingsRequest('/api/settings', data);
  settingsEl('apiKey').value = '';
  settingsEl('keyNote').textContent = result.hasApiKey
    ? 'An API key is saved locally. Leave this field blank to keep it.'
    : 'No API key is saved.';
  return result;
}
async function openAISettings() {
  try {
    const config = await settingsRequest('/api/settings');
    hostedSettings = Boolean(config.cloud);
    const dialog = settingsEl('settingsDialog');
    dialog.classList.toggle('hosted-settings', hostedSettings);
    settingsEl('settingsHeading').textContent = hostedSettings ? 'Cloud setup status' : 'Choose your AI';
    settingsEl('settingsIntro').textContent = hostedSettings
      ? 'Your browser runs on Railway, not your computer. Simple browser commands work without AI. Advanced AI needs a separately configured model or API.'
      : 'Work-Mode can use AI running on your PC for no per-message model fee, or an OpenAI API key for a more capable paid option.';
    settingsEl('settingsClose').textContent = hostedSettings ? 'Close' : 'Cancel';
    settingsEl('aiProvider').value = config.provider;
    const freeOption = settingsEl('aiProvider').querySelector('option[value="ollama"]');
    if (freeOption) freeOption.disabled = Boolean(config.cloud);
    if (config.cloud) settingsEl('aiProvider').value = 'openai';
    settingsEl('apiModel').value = config.openaiModel;
    settingsEl('ollamaModel').value = config.ollamaModel;
    settingsEl('apiKey').value = '';
    settingsEl('keyNote').textContent = config.cloud
      ? (config.aiBackend === 'compatible'
        ? 'An OpenAI-compatible model endpoint is configured. Its hosting may still incur computing costs.'
        : config.hasApiKey ? 'AI API access is configured for this private server.'
        : 'No hosted AI model is configured; basic browser commands remain available.')
      : (config.hasApiKey ? 'An API key is saved locally. Leave this blank to keep it.' : 'No API key saved. Paste one from your OpenAI API account.');
    settingsEl('settingsMessage').textContent = '';
    updateProviderVisibility();
    if (hostedSettings) {
      try {
        const response = await settingsRequest('/api/cloud/readiness');
        const problems = [];
        if (!response.aiConfigured) problems.push('Advanced AI is not configured. Basic browser commands need no AI API. Optional advanced AI requires a privately configured OPENAI_API_KEY (paid), or WORKMODE_AI_BASE_URL and WORKMODE_AI_MODEL (self-hosted computing costs).');
        if (response.aiBackend === 'compatible') problems.push('Self-hosted AI settings are present, but connectivity has not yet been proven.');
        if (response.browserSandboxStatus === 'failed') problems.push('The secure browser cannot start on the current Railway host. This requires a compatible isolated browser host.');
        if (!response.dataDirectoryConfigured || !response.dataDirectoryWritable || !response.volumeAttached) problems.push('Persistent browser storage is not ready.');
        if (!response.browserInstalled) problems.push('The remote browser executable is missing.');
        if (response.browserSandboxStatus === 'pending') problems.push('The secure browser startup check has not finished.');
        settingsEl('settingsMessage').textContent = problems.join(' ') ||
          'Basic checks pass. Site-specific browser actions still require verification.';
      } catch {
        settingsEl('settingsMessage').textContent = 'Could not verify cloud setup. The server may be temporarily unavailable.';
      }
    }
    settingsEl('settingsDialog').showModal();
    if (!hostedSettings && config.provider === 'ollama') await refreshLocalAI();
  } catch (err) {
    if (typeof entry === 'function') entry({ message: 'AI settings error: ' + err.message });
  }
}
settingsEl('aiProvider').addEventListener('change', () => {
  updateProviderVisibility();
  void refreshLocalAI();
});
settingsEl('checkLocalAI').addEventListener('click', () => void refreshLocalAI());
settingsEl('settingsButton').addEventListener('click', () => void openAISettings());
settingsEl('settingsClose').addEventListener('click', () => settingsEl('settingsDialog').close());
settingsEl('settingsForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (settingsBusy) return;
  if (hostedSettings) {
    settingsEl('settingsMessage').textContent = 'Cloud settings are managed on the private Railway server, not through this website.';
    return;
  }
  settingsBusy = true;
  const message = settingsEl('settingsMessage');
  message.textContent = 'Saving AI settings…';
  try {
    const settings = await saveAISettings();
    if (settings.provider === 'openai' && !settings.hasApiKey) {
      message.textContent = 'To use OpenAI API mode, enter an API key. Or choose Free local AI.';
      return;
    }
    if (settings.provider === 'ollama') {
      const state = await settingsRequest('/api/local-ai/status');
      if (!state.running || !state.installed) {
        message.textContent = 'Settings saved. Install Ollama and download the AI model above before running tasks.';
        await refreshLocalAI();
        return;
      }
    }
    message.textContent = 'AI is configured.';
    if (typeof entry === 'function') entry({ message: 'AI is configured: ' + settings.provider });
    settingsEl('settingsDialog').close();
  } catch (err) {
    message.textContent = err.message;
  } finally { settingsBusy = false; }
});
settingsEl('downloadLocalModel').addEventListener('click', async () => {
  const message = settingsEl('settingsMessage');
  try {
    const settings = await saveAISettings();
    if (settings.provider !== 'ollama') throw new Error('Select Free local AI first.');
    message.textContent = 'Starting the model download. This may be several gigabytes.';
    const result = await settingsRequest('/api/local-ai/pull', {});
    if (result.installed) message.textContent = 'The selected AI model is already installed.';
    await refreshLocalAI();
  } catch (err) {
    message.textContent = err.message;
    await refreshLocalAI();
  }
});
settingsEl('cancelLocalModel').addEventListener('click', async () => {
  try {
    await settingsRequest('/api/local-ai/cancel', {});
    settingsEl('settingsMessage').textContent = 'Download cancellation requested.';
  } catch (err) { settingsEl('settingsMessage').textContent = err.message; }
});
const aiDownloadEvents = new EventSource('/api/events');
aiDownloadEvents.onmessage = event => {
  try {
    const info = JSON.parse(event.data);
    if (info.type !== 'model-progress' || !settingsEl('settingsDialog').open) return;
    const percentage = info.percent == null ? '' : ' · ' + info.percent + '% of the current file';
    settingsEl('localAIStatus').textContent = (info.status || 'Downloading…') + percentage + (info.error ? ' — ' + info.error : '');
    settingsEl('downloadLocalModel').disabled = Boolean(info.running);
    settingsEl('cancelLocalModel').style.display = info.running ? 'inline-flex' : 'none';
    if (!info.running) void refreshLocalAI();
  } catch {}
};
void (async () => {
  try {
    const config = await settingsRequest('/api/settings');
    if (config.cloud) return; // The hosted website has no client-side API-key setup flow.
    if (config.provider === 'openai' && !config.hasApiKey) {
      await openAISettings();
    } else if (config.provider === 'ollama') {
      const state = await settingsRequest('/api/local-ai/status');
      if (!state.running || !state.installed) await openAISettings();
    }
  } catch {}
})();
