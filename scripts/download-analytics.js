(() => {
  const uuid = () => crypto.randomUUID();
  let visitor;
  try {
    // A different random identifier each day; no fingerprint, account or IP sent.
    const key = `rayz-analytics-${new Date().toISOString().slice(0, 10)}`;
    visitor = localStorage.getItem(key);
    if (!visitor) { visitor = uuid(); localStorage.setItem(key, visitor); }
    Object.keys(localStorage).filter(k => k.startsWith('rayz-analytics-') && k !== key).forEach(k => localStorage.removeItem(k));
  } catch { try { visitor = uuid(); } catch { visitor = null; } }
  const event = visitor ? uuid() : null;
  let recorded = false;
  async function track() {
    if (document.hidden || !visitor) return;
    try {
      const result = await fetch('/api/analytics/events', {method: 'POST', credentials: 'omit', headers: {'Content-Type':'application/x-www-form-urlencoded'}, body: new URLSearchParams({page:'download', kind:recorded ? 'heartbeat' : 'view', visitor, event})});
      if (result.ok) recorded = true;
    } catch { /* The page and download links remain usable. */ }
  }
  document.querySelectorAll('[data-apk-download]').forEach(link => {
    link.addEventListener('click', () => {
      try { link.href = `/api/analytics/apk?event=${uuid()}`; } catch { link.href = '/api/analytics/apk'; }
    });
  });
  let running = false;
  async function refresh() {
    if (running || document.hidden) return;
    running = true;
    try {
      const response = await fetch('/api/analytics/public', {credentials: 'omit', cache:'no-store', headers: {Accept:'application/json'}});
      if (!response.ok || !(response.headers.get('content-type') || '').includes('application/json')) throw Error('Unavailable');
      const stats = await response.json();
      if (!stats.download) throw Error('Unavailable');
      document.querySelectorAll('[data-public-count]').forEach(cell => {
        const value = stats.download[cell.dataset.publicCount];
        if (Number.isSafeInteger(value) && value >= 0) cell.textContent = value.toLocaleString();
      });
      document.querySelectorAll('[data-count-status]').forEach(el => { el.textContent = `${el.dataset.updated} ${new Date(stats.updated_at).toLocaleTimeString()}`; });
    } catch {
      document.querySelectorAll('[data-count-status]').forEach(el => { el.textContent = el.dataset.unavailable; });
    } finally { running = false; }
  }
  document.querySelectorAll('[data-count-retry]').forEach(el => el.addEventListener('click', refresh));
  document.addEventListener('visibilitychange', () => { track(); refresh(); });
  track(); refresh(); setInterval(track, 30000); setInterval(refresh, 15000);
})();
