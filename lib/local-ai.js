/**
 * Local Ollama setup helper.
 * Production always communicates with Ollama over the loopback interface.
 * A test URL can be supplied by unit tests but is not exposed as an HTTP setting.
 */
const OLLAMA_URL = 'http://127.0.0.1:11434';
function validModelName(name) {
  const value = String(name || '');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{1,99}$/.test(value)) {
    throw new Error('Enter a valid Ollama model name');
  }
  return value;
}

export async function detectOllama(modelName, baseUrl = OLLAMA_URL) {
  const model = validModelName(modelName);
  try {
    const response = await fetch(baseUrl + '/api/tags', { signal: AbortSignal.timeout(2500) });
    if (!response.ok) throw new Error('Ollama returned HTTP ' + response.status);
    const parsed = await response.json();
    const names = (Array.isArray(parsed.models) ? parsed.models : [])
      .map(m => String(m.name || m.model || ''))
      .filter(Boolean)
      .slice(0, 100);
    const installed = names.some(name => name === model || (model.endsWith(':latest') && name === model.slice(0,-7)));
    return { running: true, installed, model, models: names, status: installed ? 'ready' : 'model-missing' };
  } catch {
    return { running: false, installed: false, model, models: [], status: 'ollama-not-running' };
  }
}

export async function pullOllama(modelName, onProgress, signal, baseUrl = OLLAMA_URL) {
  const model = validModelName(modelName);
  const response = await fetch(baseUrl + '/api/pull', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, stream: true }),
    signal
  });
  if (!response.ok || !response.body) {
    throw new Error('Ollama could not download the model (HTTP ' + response.status + ')');
  }
  let completed = false;
  let carry = '';
  const decoder = new TextDecoder();
  for await (const chunk of response.body) {
    carry += decoder.decode(chunk, { stream: true });
    if (carry.length > 500000) throw new Error('Unexpectedly large Ollama download response');
    const lines = carry.split('\n');
    carry = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      let item;
      try { item = JSON.parse(line); }
      catch { throw new Error('Ollama sent malformed download status'); }
      if (item.error) throw new Error(String(item.error).slice(0, 200));
      if (item.status === 'success') completed = true;
      const total = Number(item.total) || 0;
      const downloaded = Number(item.completed) || 0;
      onProgress?.({
        status: String(item.status || 'Downloading model').slice(0, 110),
        percent: total > 0 ? Math.min(100, Math.round(downloaded / total * 100)) : null,
        model
      });
    }
  }
  if (!completed) throw new Error('Model download ended without a success confirmation');
  return { ok: true, model };
}
