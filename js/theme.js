// ── Light/dark theme switching ────────────────────────────────────────────────
// Resolution order: explicit user choice (settings.theme), else the OS theme.
// The choice is persisted in settings.json: the desktop app serves the UI from
// a fresh random port on every launch, so origin-scoped localStorage cannot
// survive restarts there. First paint (before settings load) is handled by the
// head script in index.html: ?theme= URL param (set by the desktop launcher
// from settings.json), else the localStorage cache (browser same-origin
// reloads), else prefers-color-scheme. localStorage caches only an explicit
// choice so an unpinned UI keeps following the OS.
import { settings } from './state.js';
import { persistSettings } from './storage.js';

const KEY = 'apitester-theme';
const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

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

function explicitTheme() {
  return settings.theme === 'dark' || settings.theme === 'light' ? settings.theme : null;
}

function systemTheme() {
  return media && media.matches ? 'dark' : 'light';
}

function syncCache() {
  try {
    const explicit = explicitTheme();
    if (explicit) localStorage.setItem(KEY, explicit);
    else localStorage.removeItem(KEY);
  } catch { /* private mode etc. */ }
}

export function initTheme() {
  apply(explicitTheme() || systemTheme());
  syncCache();
  if (media && media.addEventListener) {
    media.addEventListener('change', () => {
      if (!explicitTheme()) apply(systemTheme());
    });
  }
  const btn = document.getElementById('btn-theme');
  if (btn) {
    btn.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      settings.theme = next;
      persistSettings();
      apply(next);
      syncCache();
    });
  }
}
