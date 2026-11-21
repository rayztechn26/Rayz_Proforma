(() => {
  const root = document.querySelector('[data-website-analytics]');
  if (!root) return;
  const status = root.querySelector('[data-analytics-status]');
  let running = false;
  async function refresh() {
    if (running || document.hidden) return;
    running = true;
    try {
      const response = await fetch(root.dataset.endpoint, {headers: {Accept: 'application/json'}, cache: 'no-store'});
      if (!response.ok || !(response.headers.get('content-type') || '').includes('application/json')) throw Error('Unavailable');
      const stats = await response.json();
      if (!stats.pages) throw Error('Unavailable');
      root.querySelectorAll('[data-count]').forEach(cell => {
        const [page, metric] = cell.dataset.count.split('.');
        const value = stats.pages[page]?.[metric];
        if (Number.isSafeInteger(value) && value >= 0) cell.textContent = value.toLocaleString();
      });
      status.textContent = `${root.dataset.updated}: ${new Date(stats.updated_at).toLocaleTimeString()}`;
    } catch { status.textContent = root.dataset.unavailable; }
    finally { running = false; }
  }
  root.querySelector('[data-analytics-retry]').addEventListener('click', refresh);
  document.addEventListener('visibilitychange', refresh);
  refresh(); setInterval(refresh, 15000);
})();
