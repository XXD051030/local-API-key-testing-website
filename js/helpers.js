// ── Shared helpers (extracted from events.js + render.js) ─────────────────────
import { settings, abortController, useServerStorage, conversations } from './state.js';

// ── DOM & string utilities ────────────────────────────────────────────────────
export function $(sel) { return document.querySelector(sel); }

export function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

export function relTime(ts) {
  const d = Date.now() - ts;
  if (d < 60000)    return 'Just now';
  if (d < 3600000)  return `${Math.floor(d/60000)}m ago`;
  if (d < 86400000) return `${Math.floor(d/3600000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

export function toast(msg, ms = 2800) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), ms);
}

export function copyText(btn, text) {
  navigator.clipboard.writeText(text).then(() => {
    const o = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = o, 1500);
  });
}

export function friendlyError(e) {
  if (e.name === 'TypeError' && e.message === 'Failed to fetch') {
    const onLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (onLocal) {
      return 'Failed to fetch — check your Base URL and network connection.\nIf using a VPN or firewall, try disabling it.';
    }
    return 'Failed to fetch — CORS blocked by browser.\n➜ Run: python3 server.py\n➜ Then open: http://localhost:8080';
  }
  return e.message;
}

export function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 200) + 'px';
}

// ── Proxy fetch ───────────────────────────────────────────────────────────────
export async function proxyFetch(url, options) {
  if (useServerStorage) {
    const proxyResp = await fetch(`${window.location.origin}/proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        method: options.method || 'POST',
        headers: options.headers || {},
        bodyStr: options.body || '',
      }),
      signal: options.signal,
    });
    return proxyResp;
  }
  return fetch(url, options);
}

// ── Data encoding (moved from render.js) ──────────────────────────────────────
export function encodeDataValue(value) {
  return encodeURIComponent(String(value ?? ''));
}

export function decodeDataValue(value) {
  try {
    return decodeURIComponent(String(value ?? ''));
  } catch (_) {
    return String(value ?? '');
  }
}

// ── Send button sync ─────────────────────────────────────────────────────────
export function syncSendButton() {
  const b = $('#send-btn');
  if (!b) return;
  b.disabled = !abortController && !settings.model;
}

export function setSendStop(stop) {
  const b = $('#send-btn');
  b.textContent = stop ? 'Stop' : 'Send';
  b.classList.toggle('stop', stop);
  b.disabled = !stop && !settings.model;
}

// ── Settings drawer ──────────────────────────────────────────────────────────
export function openSettings()  { closeMobileSidebar(); $('#settings-drawer').classList.add('open');  $('#overlay').classList.add('show'); }
export function closeSettings() { $('#settings-drawer').classList.remove('open'); $('#overlay').classList.remove('show'); }

// ── Storage status ───────────────────────────────────────────────────────────
export function updateStorageStatus() {
  const el = $('#storage-status');
  if (useServerStorage) {
    el.className = 'status-badge ok';
    el.innerHTML = `<span class="status-dot"></span> Server — saving to api/ via ${escHtml(window.location.host)}`;
  } else {
    el.className = 'status-badge';
    el.innerHTML = '<span class="status-dot"></span> Browser storage (run python3 server.py for file persistence)';
  }
}

// ── Export conversations ─────────────────────────────────────────────────────
export function exportConversations() {
  const blob = new Blob([JSON.stringify(conversations, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `conversations_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Conversations exported');
}

// ── Mobile sidebar ───────────────────────────────────────────────────────────
export const mobileSidebarQuery = window.matchMedia('(max-width: 760px)');

export function isMobileLayout() {
  return mobileSidebarQuery.matches;
}

export function openMobileSidebar() {
  if (!isMobileLayout()) return;
  document.body.classList.add('mobile-sidebar-open');
}

export function closeMobileSidebar() {
  document.body.classList.remove('mobile-sidebar-open');
}

export function toggleMobileSidebar() {
  if (!isMobileLayout()) return;
  document.body.classList.toggle('mobile-sidebar-open');
}

function handleMobileLayoutChange(e) {
  if (!e.matches) closeMobileSidebar();
}

if (mobileSidebarQuery.addEventListener) mobileSidebarQuery.addEventListener('change', handleMobileLayoutChange);
else if (mobileSidebarQuery.addListener) mobileSidebarQuery.addListener(handleMobileLayoutChange);
