const settingsEl = id => document.getElementById(id);
function updateProviderVisibility() {
  const local = settingsEl('aiProvider').value === 'ollama';
  settingsEl('localFields').style.display = local ? 'block' : 'none';
  settingsEl('apiFields').style.display = local ? 'none' : 'block';
}
settingsEl('aiProvider').addEventListener('change', updateProviderVisibility);
settingsEl('settingsButton').addEventListener('click', async () => {
  try {
    const res = await fetch('/api/settings');
    const config = await res.json();
    if (!res.ok) throw new Error(config.error || 'Settings could not be loaded');
    settingsEl('aiProvider').value = config.provider;
    settingsEl('apiModel').value = config.openaiModel;
    settingsEl('ollamaModel').value = config.ollamaModel;
    settingsEl('apiKey').value = '';
    settingsEl('keyNote').textContent = config.hasApiKey
      ? 'An API key is already saved locally. Leave this blank to keep it.'
      : 'No API key saved. Paste one from your OpenAI API account.';
    settingsEl('settingsMessage').textContent = '';
    updateProviderVisibility();
    settingsEl('settingsDialog').showModal();
  } catch (err) {
    if (typeof entry === 'function') entry({ message: 'Settings error: ' + err.message });
  }
});
settingsEl('settingsClose').addEventListener('click', () => settingsEl('settingsDialog').close());
settingsEl('settingsForm').addEventListener('submit', async event => {
  event.preventDefault();
  const data = {
    provider: settingsEl('aiProvider').value,
    openaiModel: settingsEl('apiModel').value.trim(),
    ollamaModel: settingsEl('ollamaModel').value.trim()
  };
  const key = settingsEl('apiKey').value.trim();
  if (key) data.apiKey = key;
  const msg = settingsEl('settingsMessage');
  msg.textContent = 'Saving…';
  try {
    const response = await fetch('/api/settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not save AI settings');
    msg.textContent = 'Settings saved locally.';
    settingsEl('apiKey').value = '';
    if (typeof entry === 'function') entry({ message: 'AI mode saved: ' + result.provider });
    settingsEl('settingsDialog').close();
  } catch (err) {
    msg.textContent = err.message;
  }
});
