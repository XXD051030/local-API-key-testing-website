// ── File storage via server (or localStorage fallback) ────────────────────────
import {
  settings, setSettings, conversations, setConversations,
  useServerStorage, setUseServerStorage,
  SETTINGS_FILE, CONV_FILE,
  normalizeSearchSettings, normalizeConversations
} from './state.js';
import { $, updateStorageStatus } from './helpers.js';
import { ensureCustomPresets, ensureActiveKeySelection, refreshPresetsDropdowns, renderPresetList } from './keys.js';
import { renderKeySelector, renderKeyList, renderConvList } from './render.js';
import { switchConv } from './conversations.js';
import { applySearchSettingsToUI, readSearchSettingsFromUI } from './search.js';

export async function detectServerBackend() {
  setUseServerStorage(false);
  if (!/^https?:$/.test(window.location.protocol)) return false;

  try {
    const resp = await fetch('/file?name=__codex_probe__', { cache: 'no-store' });
    const contentType = (resp.headers.get('Content-Type') || '').toLowerCase();
    setUseServerStorage(resp.status === 403 && contentType.includes('application/json'));
  } catch(_) {
    setUseServerStorage(false);
  }
  return useServerStorage;
}

async function readFile(filename) {
  if (useServerStorage) {
    try {
      const resp = await fetch(`/file?name=${encodeURIComponent(filename)}`);
      if (resp.ok) return await resp.json();
    } catch(_) {}
    return null;
  }
  try {
    const s = localStorage.getItem(`apitester_${filename}`);
    return s ? JSON.parse(s) : null;
  } catch(_) { return null; }
}

async function writeFile(filename, data) {
  if (useServerStorage) {
    try {
      const resp = await fetch(`/file?name=${encodeURIComponent(filename)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return resp.ok;
    } catch(_) { return false; }
  }
  try {
    localStorage.setItem(`apitester_${filename}`, JSON.stringify(data));
    return true;
  } catch(_) { return false; }
}

// ── Settings persistence ──────────────────────────────────────────────────────
export async function persistSettings() {
  return await writeFile(SETTINGS_FILE, settings);
}

export async function loadSettingsFromFile() {
  const data = await readFile(SETTINGS_FILE);
  let shouldPersist = false;
  if (data && typeof data === 'object') {
    const rawPresets = JSON.stringify(Array.isArray(data.presets) ? data.presets : []);
    setSettings({
      ...settings,
      ...data,
      search: normalizeSearchSettings(data.search),
    });
    // Ensure apiKeys is array
    if (!Array.isArray(settings.apiKeys)) settings.apiKeys = [];
    if (!Array.isArray(settings.thinkingModels)) settings.thinkingModels = [];
    if (!Array.isArray(settings.presets)) settings.presets = [];

    // Discard old presets without keyId and ensure groups exist for keys.
    ensureCustomPresets();
    shouldPersist = rawPresets !== JSON.stringify(settings.presets);
  }
  settings.search = normalizeSearchSettings(settings.search);
  if (shouldPersist) await persistSettings();
}

export function applySettingsToUI() {
  $('#s-system-prompt').value = settings.systemPrompt || '';
  $('#s-include-time-context').value = (settings.includeTimeContext !== false).toString();
  $('#s-temperature').value   = settings.temperature ?? 0.7;
  $('#temp-val').textContent  = settings.temperature ?? 0.7;
  $('#s-max-tokens').value    = settings.maxTokens || '';
  $('#s-stream').value        = (settings.stream !== false).toString();

  ensureCustomPresets();
  ensureActiveKeySelection();
  renderKeySelector();
  refreshPresetsDropdowns();
  renderKeyList();
  renderPresetList();
  applySearchSettingsToUI();
}

export function readGeneralFromUI() {
  settings.systemPrompt = $('#s-system-prompt').value;
  settings.includeTimeContext = $('#s-include-time-context')?.value !== 'false';
  settings.temperature  = parseFloat($('#s-temperature').value);
  settings.maxTokens    = $('#s-max-tokens').value;
  settings.stream       = $('#s-stream').value === 'true';
  settings.model        = $('#model-selector').value;
  readSearchSettingsFromUI();
}

// ── Conversations persistence ─────────────────────────────────────────────────
export async function persistConversations() {
  return await writeFile(CONV_FILE, conversations);
}

export async function loadConversationsFromFile() {
  const data = await readFile(CONV_FILE);
  if (data && Array.isArray(data)) {
    setConversations(data);
    if (normalizeConversations(conversations)) await persistConversations();
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
export async function init() {
  await detectServerBackend();
  await loadSettingsFromFile();
  await loadConversationsFromFile();
  const previousActiveKeyId = settings.activeKeyId;
  const previousModel = settings.model;
  applySettingsToUI();
  if (settings.activeKeyId !== previousActiveKeyId || settings.model !== previousModel) {
    await persistSettings();
  }
  renderConvList();
  if (conversations.length > 0) switchConv(conversations[0].id);
  updateStorageStatus();
}
