/* Panda reader display preferences: local-only, no server or account required. */
(() => {
  'use strict';
  const KEY = 'panda-reading-mode';
  const VALUES = ['default', 'warm', 'night'];
  const LABELS = {default: '默认', warm: '暖色护眼', night: '深色夜读'};
  const html = document.documentElement;
  let mode = 'default';
  try {
    const saved = localStorage.getItem(KEY);
    if (VALUES.includes(saved)) mode = saved;
  } catch (_) { /* private browser / file origin */ }
  function apply(value, persist = true) {
    mode = VALUES.includes(value) ? value : 'default';
    html.setAttribute('data-theme', mode);
    html.style.colorScheme = mode === 'night' ? 'dark' : 'light';
    const input = document.getElementById('panda-reading-mode');
    if (input) input.value = mode;
    const hint = document.getElementById('panda-theme-label');
    if (hint) hint.textContent = LABELS[mode];
    if (persist) { try {localStorage.setItem(KEY, mode);} catch (_) {} }
  }
  apply(mode, false); // Run in the head to avoid a white flash when opening a night-mode page.
  function mount() {
    if (!document.body || document.getElementById('panda-theme-switcher')) return;
    const aside = document.createElement('div');
    aside.className = 'panda-theme-switcher';
    aside.id = 'panda-theme-switcher';
    const label = document.createElement('label');
    label.htmlFor = 'panda-reading-mode';
    label.textContent = '阅读模式';
    const select = document.createElement('select');
    select.id = 'panda-reading-mode';
    select.setAttribute('aria-label', '全局阅读模式');
    select.title = '所有页面生效；刷新后保留选择';
    VALUES.forEach(value => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = LABELS[value];
      select.append(option);
    });
    select.value = mode;
    select.addEventListener('change', event => apply(event.target.value));
    aside.append(label, select);
    document.body.append(aside);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true});
  else mount();
  window.addEventListener('storage', event => {
    if (event.key === KEY && VALUES.includes(event.newValue)) apply(event.newValue, false);
  });
})();
