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
  const browserReady = storageReady && Boolean(state.browserInstalled) && state.browserSandboxStatus === 'passed';
  const canRun = aiReady && browserReady;
  window.workModeCloudBlocked = !canRun;
  window.workModeCloudBrowserBlocked = !browserReady;

  const issues = [];
  if (!aiReady) issues.push('AI is not connected to Railway');
  if (state.browserSandboxStatus === 'failed') issues.push('the secure remote browser cannot start on this host');
  else if (state.browserSandboxStatus !== 'passed') issues.push('secure browser startup has not been confirmed');
  if (!storageReady) issues.push('browser storage is not fully ready');
  if (!state.browserInstalled) issues.push('the browser executable is missing');

  const banner = $r('cloudSetupBanner');
  banner.hidden = canRun;
  if (!canRun) {
    $r('cloudBannerTitle').textContent = 'Work-Mode needs server setup';
    $r('cloudBannerText').textContent = issues.join('; ') +
      '. These are server-side issues, not a problem with your computer. Tasks are paused until fixed.';
  }
  $r('cloudStatus').textContent = canRun
    ? 'Basic AI, browser and storage checks passed. Verify individual actions before relying on them.'
    : 'Workspace not ready: ' + issues.join('; ') + '.';

  const runButton = $r('runTask');
  if (runButton) {
    runButton.disabled = !canRun || Boolean(window.workModeRunningTask);
    runButton.title = canRun ? '' : 'AI and secure browser setup must be completed on the server';
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
    if (description) description.textContent = 'The AI and browser run on your private hosted computer. Your phone, iPad or laptop is a lightweight controller. Actions require your approval.';
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
