// ── Light/dark theme switching ────────────────────────────────────────────────
// The preference is persisted in settings.json: the desktop app serves the UI
// from a fresh random port on every launch, so origin-scoped localStorage
// cannot survive restarts there. localStorage stays as a same-origin cache so
// browser reloads paint the right theme before settings load (head FOUC guard).
import { settings } from './state.js';
import { persistSettings } from './storage.js';

const KEY = 'apitester-theme';

const MOON_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
const SUN_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';

function apply(theme) {
  if (theme === 'dark') document.documentElement.dataset.theme = 'dark';
  else delete document.documentElement.dataset.theme;
  const light = document.getElementById('hljs-light');
  const dark = document.getElementById('hljs-dark');
  if (light && dark) {
    light.disabled = theme === 'dark';
    dark.disabled = theme !== 'dark';
  }
  const btn = document.getElementById('btn-theme');
  if (btn) {
    btn.innerHTML = theme === 'dark' ? SUN_SVG : MOON_SVG;
    btn.title = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
  }
}

export function initTheme() {
  let cached = null;
  try { cached = localStorage.getItem(KEY); } catch { /* private mode etc. */ }
  const fromSettings = settings.theme === 'dark' || settings.theme === 'light'
    ? settings.theme
    : null;
  const theme = fromSettings || (cached === 'dark' ? 'dark' : 'light');
  apply(theme);
  try { localStorage.setItem(KEY, theme); } catch { /* ignore */ }
  const btn = document.getElementById('btn-theme');
  if (btn) {
    btn.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
      settings.theme = next;
      persistSettings();
      apply(next);
    });
  }
}
