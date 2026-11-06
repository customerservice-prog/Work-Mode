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
async function initializeRemote() {
  try {
    const response = await fetch('/api/mode', { credentials:'same-origin' });
    if (!response.ok) return;
    const mode = await response.json();
    if (!mode.cloud) return;
    document.body.classList.add('cloud-mode');
    $r('remoteControls').hidden = false;
    $r('cloudLogout').hidden = false;
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
