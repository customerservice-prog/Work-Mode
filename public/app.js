const $ = (id) => document.getElementById(id);
let busy = false;
let currentApproval = null;
let lastVersion = 0;
async function api(url, data) {
  const opts = data === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) };
  const res = await fetch(url, opts);
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || 'Request failed');
  return out;
}
function bubble(text, role) {
  $('placeholder')?.remove();
  $('ideas')?.remove();
  const div = document.createElement('div');
  div.className = 'bubble ' + role;
  div.textContent = String(text);
  $('chat').appendChild(div);
  $('chat').scrollTop = $('chat').scrollHeight;
}
function entry(data) {
  if ($('timeline').textContent === 'No actions yet.') $('timeline').textContent = '';
  const row = document.createElement('div');
  row.className = 'item';
  const time = document.createElement('span');
  time.className = 'time';
  time.textContent = new Date(data.at || Date.now()).toLocaleTimeString();
  row.appendChild(time);
  row.appendChild(document.createTextNode(data.message || ''));
  $('timeline').appendChild(row);
  $('timeline').scrollTop = $('timeline').scrollHeight;
}
function setPhase(phase) {
  busy = phase === 'running';
  window.workModeRunningTask = busy;
  $('runTask').disabled = busy || window.workModeCloudBlocked === true;
  $('stopTask').disabled = !busy;
  $('statusDot').className = 'dot ' + (busy ? 'running' : phase === 'done' ? 'done' : phase === 'error' ? 'error' : '');
  $('stateLabel').textContent = ({ running: 'Working', done: 'Last task finished', stopped: 'Stopped', limited: 'Action limit reached', error: 'Needs attention', idle: 'Ready' })[phase] || phase;
  $('stateDetails').textContent = busy ? 'Follow actions on the right. Review any approval prompt.' : 'Open the browser or give another task.';
}
function preview(version, url) {
  if (version <= lastVersion) return;
  lastVersion = version;
  $('screen').src = '/api/screenshot?v=' + version;
  $('screen').style.display = 'block';
  $('preview').classList.remove('empty');
  $('emptyPreview').style.display = 'none';
  if (url) $('browserUrl').textContent = url;
}
function approval(data) {
  currentApproval = data || null;
  $('approval').style.display = data ? 'block' : 'none';
  $('approvalText').textContent = data?.label || '';
  if (data) window.dispatchEvent(new CustomEvent('workmode-approval', { detail: { pending: true } }));
}
async function decide(approve) {
  if (!currentApproval) return;
  const id = currentApproval.id;
  approval(null);
  try { await api('/api/approvals/' + encodeURIComponent(id), { approve }); }
  catch (e) { entry({ message: e.message }); }
}
$('approve').onclick = () => decide(true);
$('deny').onclick = () => decide(false);
$('openBrowser').onclick = async () => {
  $('openBrowser').disabled = true;
  try {
    const state = await api('/api/browser/open', {});
    $('browserUrl').textContent = state.url;
    entry({ message: 'Visible browser launched. Sign in there manually if needed.' });
  } catch (e) { bubble('Browser could not open: ' + e.message, 'ai'); }
  finally { $('openBrowser').disabled = false; }
};
$('stopTask').onclick = async () => {
  try { await api('/api/stop', {}); }
  catch (e) { entry({ message: e.message }); }
};
async function submit() {
  const task = $('taskInput').value.trim();
  if (!task || busy || window.workModeCloudBlocked === true) return;
  $('taskInput').value = '';
  bubble(task, 'user');
  $('runTask').disabled = true;
  try { await api('/api/tasks', { task }); setPhase('running'); }
  catch (e) { bubble(e.message, 'ai'); setPhase('idle'); }
}
$('runTask').onclick = submit;
$('taskInput').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit(); }
});
async function init() {
  try {
    const s = await api('/api/status');
    setPhase(s.phase);
    (s.logs || []).forEach(entry);
    if (s.imageVersion) preview(s.imageVersion, s.browserUrl);
    if (s.browserUrl) $('browserUrl').textContent = s.browserUrl;
    if (s.approval) approval(s.approval);
    if (s.answer) bubble(s.answer, 'ai');
  } catch (e) {
    $('stateLabel').textContent = 'Cannot reach local server';
    entry({ message: e.message });
  }
  const stream = new EventSource('/api/events');
  stream.onmessage = event => {
    const data = JSON.parse(event.data);
    if (data.type === 'log') entry(data);
    if (data.type === 'image') preview(data.version, data.url);
    if (data.type === 'approval') approval(data);
    if (data.type === 'approval-cleared') approval(null);
    if (data.type === 'status') {
      setPhase(data.phase);
      if (data.answer && ['done','error','stopped','limited'].includes(data.phase)) bubble(data.answer, 'ai');
    }
  };
  stream.onerror = () => { $('stateDetails').textContent = 'Connection interrupted; the page will retry.'; };
}
void init();
