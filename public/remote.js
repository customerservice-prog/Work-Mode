const $r = id => document.getElementById(id);
const setRemoteMessage = msg => { $r('remoteMessage').textContent = String(msg || ''); };
async function remoteRequest(path, payload) {
  const response = await fetch(path, {
    method: 'POST', credentials: 'same-origin',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(payload || {})
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(body.error || 'Remote browser request failed');
  if (body.imageVersion && typeof preview === 'function') preview(body.imageVersion, body.url);
  return body;
}
function lockManualControls() {
  if (typeof busy !== 'undefined' && busy) {
    throw Error('Stop or finish the AI task before controlling the browser manually');
  }
}
async function remoteAction(path, data) {
  lockManualControls();
  setRemoteMessage('Working…');
  try {
    const result = await remoteRequest(path, data);
    setRemoteMessage('Browser updated');
    return result;
  } catch (err) {
    setRemoteMessage(err.message);
    throw err;
  }
}
async function refreshCloudUsage() {
  if (!document.body.classList.contains('cloud-mode')) return;
  const usageEl=$r('cloudUsage');
  if (window.workModeCloudAiBackend === 'compatible') {
    usageEl.textContent = 'Self-hosted AI model configured; no Work-Mode API token quota applies. Server compute and hosting still have costs.';
    return;
  }
  if (window.workModeCloudAiReady === false) {
    usageEl.textContent = 'Basic browser commands: no AI API fees or message credits. Railway hosting still uses billable resources.';
    return;
  }
  try {
    const res=await fetch('/api/cloud/usage',{credentials:'same-origin',cache:'no-store'});
    if (!res.ok) throw Error('Cannot read usage limits');
    const v=await res.json();
    usageEl.textContent = 'AI tokens used: ' + Number(v.dayTokens).toLocaleString() + ' / ' +
      Number(v.dailyLimit).toLocaleString() + ' today, and ' +
      Number(v.monthTokens).toLocaleString() + ' / ' +
      Number(v.monthlyLimit).toLocaleString() + ' this month. API charges are separate.';
  } catch {
    usageEl.textContent='AI usage could not be verified; stop new tasks until the server reports its limits.';
  }
}
function applyCloudReadiness(state) {
  const aiReady = Boolean(state.aiConfigured);
  const storageReady = Boolean(state.dataDirectoryConfigured && state.dataDirectoryWritable && state.volumeAttached);
  const browserReady = storageReady && Boolean(state.browserInstalled) && ['passed','container-isolated'].includes(state.browserSandboxStatus);
  const containerOnly = state.browserSandboxStatus === 'container-isolated';
  const canRun = browserReady;
  window.workModeCloudBlocked = !browserReady;
  window.workModeCloudAiReady = aiReady;
  window.workModeCloudAiBackend = state.aiBackend || 'basic';
  window.workModeCloudBrowserBlocked = !browserReady;
  if (!aiReady && browserReady) {
    const ideas = $r('ideas');
    if (ideas) ideas.textContent = 'Examples: Open https://www.google.com and tell me the page title; Read the page; Scroll down; Click Search; Help. Complex AI work is unavailable without a model.';
    const task = $r('taskInput');
    if (task) task.placeholder = 'Try: Open google.com and tell me the page title';
  }
  void refreshCloudUsage();
  if (typeof setPhase === 'function') setPhase(window.workModeRunningTask ? 'running' : 'idle');

  const issues = [];
  if (!aiReady) issues.push('AI is not connected to Railway');
  if (state.browserSandboxStatus === 'failed') issues.push('the remote browser cannot start on this host');
  else if (!browserReady) issues.push('remote browser startup has not been confirmed');
  if (containerOnly) issues.push('browser uses Railway container isolation without Chromium sandbox; avoid untrusted sites with sensitive accounts');
  if (!storageReady) issues.push('browser storage is not fully ready');
  if (!state.browserInstalled) issues.push('the browser executable is missing');

  const banner = $r('cloudSetupBanner');
  banner.hidden = aiReady && browserReady && !containerOnly;
  if (!browserReady) {
    $r('cloudBannerTitle').textContent = 'Work-Mode needs server setup';
    $r('cloudBannerText').textContent = issues.join('; ') + '. This is a server-side issue.';
  } else if (!aiReady) {
    $r('cloudBannerTitle').textContent = 'Basic browser commands are ready — advanced AI is not connected';
    $r('cloudBannerText').textContent =
      'You can now type Hi, Help, Open https://www.google.com and tell me the page title, Scroll down, or Read the page. ' +
      'This free command mode follows a limited set of instructions; it is not an autonomous AI model. ' +
      (containerOnly ? 'Security: Chromium sandbox is off; avoid sensitive accounts and untrusted sites.' : '');
  } else if (containerOnly) {
    $r('cloudBannerTitle').textContent = 'Browser running with reduced isolation';
    $r('cloudBannerText').textContent = 'Chromium sandbox is disabled on this Railway host. Avoid sensitive accounts and untrusted websites.';
  }
  $r('cloudStatus').textContent = browserReady
    ? (aiReady ? (state.aiBackend === 'compatible' ? 'Self-hosted AI endpoint configured; connectivity not yet verified. ' : 'Advanced AI API configured. ')
      : 'Basic browser commands available without an API. Advanced AI not configured. ') +
      (containerOnly ? 'Chromium sandbox is off.' : 'Browser isolation checks passed.')
    : 'Workspace not ready: ' + issues.join('; ') + '.';

  const runButton = $r('runTask');
  if (runButton) {
    runButton.disabled = !canRun || Boolean(window.workModeRunningTask);
    runButton.title = canRun ? (aiReady ? '' : 'Run a supported browser command without AI') : 'Browser setup must be completed on the server';
  }
  const openButton = $r('openBrowser');
  if (openButton) {
    openButton.disabled = !browserReady;
    openButton.title = browserReady ? '' : 'The secure browser cannot start on the current host';
  }
  const manualControls = $r('remoteControls');
  for (const field of manualControls.querySelectorAll('button, input')) {
    field.disabled = !browserReady;
  }
}

async function initializeRemote() {
  try {
    const response = await fetch('/api/mode', { credentials:'same-origin' });
    if (!response.ok) return;
    const mode = await response.json();
    if (!mode.cloud) return;
    document.body.classList.add('cloud-mode');
    $r('settingsButton').textContent = 'Cloud status';
    $r('cloudSetupBanner').hidden = false;
    $r('cloudBannerTitle').textContent = 'Checking server setup…';
    $r('cloudBannerText').textContent = 'Verifying AI connection, secure browser and saved data.';
    $r('runTask').disabled = true;
    $r('openBrowser').disabled = true;
    window.workModeCloudBlocked = true;
    void refreshCloudUsage();
    try {
      const response=await fetch('/api/cloud/readiness',{credentials:'same-origin',cache:'no-store'});
      if (!response.ok) throw Error('Readiness endpoint unavailable');
      applyCloudReadiness(await response.json());
    } catch {
      $r('cloudBannerTitle').textContent='Cannot verify server setup';
      $r('cloudBannerText').textContent='Work-Mode is not ready for tasks until AI and secure browser availability can be checked.';
      $r('cloudStatus').textContent='Could not check the private server configuration.';
    }
    $r('remoteControls').hidden = false;
    $r('cloudLogout').hidden = false;
    $r('installHelp').hidden = false;
    const caption = document.querySelector('.side .kicker');
    if (caption) caption.textContent = 'Your private cloud assistant';
    const description = document.querySelector('.side p.hint');
    if (description) description.textContent = 'The browser runs on Railway. Basic commands work without an AI API; advanced AI requires a separate model. Your phone, iPad, or laptop is the controller.';
    const browserPanelTitle = document.querySelector('#browserPanel .paneltitle');
    if (browserPanelTitle) browserPanelTitle.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.includes('Live browser preview')) {
        node.textContent = 'Remote browser preview ';
      }
    });
    $r('remoteEnableClick').checked = false;
    if (window.showMobileView) window.showMobileView('chat');
  } catch {}
}
$r('remoteNavigate').addEventListener('submit', event => {
  event.preventDefault();
  const url = $r('remoteUrl').value.trim();
  void remoteAction('/api/remote/navigate', { url }).catch(() => {});
});
$r('remoteType').addEventListener('submit', event => {
  event.preventDefault();
  const text = $r('remoteText').value;
  $r('remoteText').value = '';
  if (!text) return;
  void remoteAction('/api/remote/type', { text }).catch(() => {});
});
$r('remoteHideText').addEventListener('change', () => {
  $r('remoteText').type = $r('remoteHideText').checked ? 'password' : 'text';
  $r('remoteText').value = '';
});
$r('remoteScrollUp').onclick = () => void remoteAction('/api/remote/scroll', { direction:'up' }).catch(() => {});
$r('remoteScrollDown').onclick = () => void remoteAction('/api/remote/scroll', { direction:'down' }).catch(() => {});
$r('remoteTab').onclick = () => void remoteAction('/api/remote/key', { key:'Tab' }).catch(() => {});
$r('remoteEnter').onclick = () => void remoteAction('/api/remote/key', { key:'Enter' }).catch(() => {});
$r('remoteBackspace').onclick = () => void remoteAction('/api/remote/key', { key:'Backspace' }).catch(() => {});
$r('screen').addEventListener('click', event => {
  if (!document.body.classList.contains('cloud-mode') || !$r('remoteEnableClick').checked) return;
  const screen=$r('screen');
  if (!screen.naturalWidth || !screen.naturalHeight) return;
  const rect=screen.getBoundingClientRect();
  const x=Math.round((event.clientX-rect.left)*screen.naturalWidth/rect.width);
  const y=Math.round((event.clientY-rect.top)*screen.naturalHeight/rect.height);
  void remoteAction('/api/remote/click', { x, y }).catch(() => {});
});
$r('cloudLogout').onclick = async () => {
  if (!confirm('Sign out of your remote Work-Mode session on this device?')) return;
  try {
    await remoteRequest('/api/auth/logout', {});
    window.location.href = '/login';
  } catch (e) { setRemoteMessage(e.message); }
};
void initializeRemote();

$r('installHelp').onclick = () => $r('installDialog').showModal();
$r('closeInstallHelp').onclick = () => $r('installDialog').close();

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) void refreshCloudUsage();
});
setInterval(() => { if (!document.hidden) void refreshCloudUsage(); }, 60000);

$r('cloudBannerStatus').addEventListener('click', () => {
  if (typeof openAISettings === 'function') void openAISettings();
});
