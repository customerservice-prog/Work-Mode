const mobileButtons = Array.from(document.querySelectorAll('[data-mobile-view]'));
function showMobileView(view) {
  if (!['chat', 'browser'].includes(view)) return;
  document.body.dataset.mobileView = view;
  for (const button of mobileButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.mobileView === view));
  }
}
for (const button of mobileButtons) {
  button.addEventListener('click', () => showMobileView(button.dataset.mobileView));
}
showMobileView('chat');
window.addEventListener('workmode-approval', () => showMobileView('browser'));
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  });
}
