// Auxiliary UI for tabs, screenshot refresh, and local task history.
// The main chat app stays intentionally simple.
const extraApi = async (url, data) => {
  const options = data === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  };
  const res = await fetch(url, options);
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || 'Action failed');
  return out;
};
const extraEl = id => document.getElementById(id);
let refreshingTabs = false;

async function refreshTabBar() {
  if (refreshingTabs) return;
  refreshingTabs = true;
  try {
    const { tabs } = await extraApi('/api/tabs');
    const root = extraEl('tabbar');
    root.replaceChildren();
    if (!tabs.length) {
      root.textContent = 'Open Browser to start.';
      return;
    }
    for (const tab of tabs) {
      const btn = document.createElement('button');
      btn.className = 'tab' + (tab.active ? ' active' : '');
      btn.textContent = (tab.title || tab.url || 'New tab').slice(0, 55);
      btn.title = tab.url;
      btn.onclick = async () => {
        try {
          if (typeof busy !== 'undefined' && busy) throw new Error('Stop or finish the task before manually switching tabs.');
          await extraApi('/api/tabs/select', { index: tab.index });
          const response = await extraApi('/api/browser/refresh', {});
          if (typeof preview === 'function') preview(response.version, response.url);
          await refreshTabBar();
        } catch (err) {
          if (typeof entry === 'function') entry({ message: err.message });
        }
      };
      root.appendChild(btn);
    }
  } catch {
    extraEl('tabbar').textContent = 'Tab list unavailable';
  } finally {
    refreshingTabs = false;
  }
}
async function refreshHistoryList() {
  const root = extraEl('historyList');
  try {
    const { history } = await extraApi('/api/history');
    root.replaceChildren();
    if (!history.length) { root.textContent = 'No completed tasks yet'; return; }
    for (const item of history.slice(0, 7)) {
      const btn = document.createElement('button');
      btn.className = 'historyItem';
      btn.textContent = item.task.slice(0, 80);
      const subtitle = document.createElement('span');
      subtitle.textContent = new Date(item.finishedAt).toLocaleString() + ' · ' + item.phase;
      btn.appendChild(subtitle);
      btn.onclick = () => {
        extraEl('taskInput').value =
          'Continue this earlier task if unfinished: ' + item.task +
          '\nPrevious outcome: ' + item.phase + ' — ' + item.answer +
          '\nInspect the live browser first and verify before saying it is done.';
        extraEl('taskInput').focus();
      };
      root.appendChild(btn);
    }
  } catch { root.textContent = 'Local history unavailable'; }
}
extraEl('refreshPreview').onclick = async () => {
  try {
    const r = await extraApi('/api/browser/refresh', {});
    if (typeof preview === 'function') preview(r.version, r.url);
    await refreshTabBar();
  } catch (e) {
    if (typeof entry === 'function') entry({ message: e.message });
  }
};
const newTabButton = document.createElement('button');
newTabButton.textContent = 'New Tab';
newTabButton.className = 'ghost';
newTabButton.onclick = async () => {
  try {
    if (typeof busy !== 'undefined' && busy) throw new Error('Finish the current task before opening a manual tab');
    await extraApi('/api/browser/new', {});
    await refreshTabBar();
  } catch (e) {
    if (typeof entry === 'function') entry({ message: e.message });
  }
};
document.querySelector('.topright').prepend(newTabButton);
void refreshTabBar();
void refreshHistoryList();
setInterval(() => { void refreshTabBar(); }, 5000);
setInterval(() => { void refreshHistoryList(); }, 15000);
