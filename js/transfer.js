// ── One-click backup: export / import conversations + settings ────────────────
import {
  settings, conversations, setSettings, setConversations, setActiveConvId,
  normalizeSearchSettings, normalizeConversations,
} from './state.js';
import { $, escHtml, toast } from './helpers.js';
import { ensureCustomPresets, ensureActiveKeySelection } from './keys.js';
import { persistSettings, persistConversations, applySettingsToUI } from './storage.js';
import { renderConvList, renderMessages, updateRegenBtn } from './render.js';
import { switchConv } from './conversations.js';

export const BACKUP_TYPE = 'apitester-backup';
export const BACKUP_VERSION = 1;

// ── Pure: build the wrapped backup object ─────────────────────────────────────
export function buildBackup(settingsObj, conversationsArr) {
  return {
    type: BACKUP_TYPE,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings: settingsObj,
    conversations: Array.isArray(conversationsArr) ? conversationsArr : [],
  };
}

// ── Pure: validate a parsed backup object ─────────────────────────────────────
export function validateBackup(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { ok: false, errors: ['File is not a valid backup object.'] };
  }

  const errors = [];
  if (obj.type !== BACKUP_TYPE) {
    errors.push('File is not an API Tester backup (missing type marker).');
  }

  const hasSettings = obj.settings !== undefined && obj.settings !== null;
  const hasConvs = obj.conversations !== undefined && obj.conversations !== null;

  if (hasSettings && (typeof obj.settings !== 'object' || Array.isArray(obj.settings))) {
    errors.push('"settings" must be an object.');
  }
  if (hasConvs && !Array.isArray(obj.conversations)) {
    errors.push('"conversations" must be an array.');
  }
  if (!hasSettings && !hasConvs) {
    errors.push('Backup contains neither settings nor conversations.');
  }
  if (errors.length) return { ok: false, errors };

  const warnings = [];
  if (typeof obj.version === 'number' && obj.version > BACKUP_VERSION) {
    warnings.push(`Backup version ${obj.version} is newer than this app supports (${BACKUP_VERSION}); importing best-effort.`);
  }

  return {
    ok: true,
    errors: [],
    warnings,
    settings: hasSettings ? obj.settings : null,
    conversations: hasConvs ? obj.conversations : [],
  };
}

// ── Pure: merge incoming data into current. mode: 'replace' | 'merge' ─────────
export function mergeData(current, incoming, mode) {
  if (mode === 'replace') {
    return {
      settings: incoming.settings ? { ...incoming.settings } : { ...current.settings },
      conversations: Array.isArray(incoming.conversations) ? incoming.conversations.slice() : [],
    };
  }

  // merge: keep current scalar settings, union the collections by id / keyId
  const nextSettings = { ...current.settings };
  const inc = incoming.settings || {};
  nextSettings.apiKeys = mergeById(current.settings.apiKeys, inc.apiKeys, 'id');
  nextSettings.presets = mergeById(current.settings.presets, inc.presets, 'keyId');
  nextSettings.thinkingModels = unionPrimitive(current.settings.thinkingModels, inc.thinkingModels);

  return {
    settings: nextSettings,
    conversations: mergeById(current.conversations, incoming.conversations, 'id'),
  };
}

// Union two arrays of objects by a key field; incoming overwrites on collision.
function mergeById(currentArr, incomingArr, key) {
  const base = Array.isArray(currentArr) ? currentArr.slice() : [];
  if (!Array.isArray(incomingArr)) return base;
  const index = new Map(base.map((item, i) => [item?.[key], i]));
  for (const item of incomingArr) {
    if (!item || item[key] === undefined) { base.push(item); continue; }
    const at = index.get(item[key]);
    if (at === undefined) { index.set(item[key], base.length); base.push(item); }
    else base[at] = item;
  }
  return base;
}

function unionPrimitive(a, b) {
  const out = Array.isArray(a) ? a.slice() : [];
  const seen = new Set(out);
  if (Array.isArray(b)) for (const v of b) if (!seen.has(v)) { seen.add(v); out.push(v); }
  return out;
}

// ── Export ────────────────────────────────────────────────────────────────────
export function exportBackup() {
  const data = buildBackup(settings, conversations);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `apitester_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Backup exported');
}

// ── Import ────────────────────────────────────────────────────────────────────
let pendingImport = null;

export async function importBackupFromFile(file) {
  if (!file) return;

  let text;
  try { text = await file.text(); }
  catch { toast('Could not read the file'); return; }

  let parsed;
  try { parsed = JSON.parse(text); }
  catch { toast('File is not valid JSON'); return; }

  const result = validateBackup(parsed);
  if (!result.ok) { toast(`Import failed: ${result.errors[0]}`); return; }

  openImportModal(result);
}

function openImportModal(result) {
  pendingImport = result;
  const s = result.settings || {};
  const keyCount = Array.isArray(s.apiKeys) ? s.apiKeys.length : 0;
  const convCount = Array.isArray(result.conversations) ? result.conversations.length : 0;

  const lines = [
    '<p>This backup contains:</p>',
    `<ul><li><b>${convCount}</b> conversation(s)</li><li><b>${keyCount}</b> API key(s)</li></ul>`,
    result.settings
      ? '<p class="modal-note">Settings are included.</p>'
      : '<p class="modal-note">This file has no settings — only conversations.</p>',
  ];
  if (result.warnings?.length) {
    lines.push(`<p class="modal-warn">${result.warnings.map(escHtml).join('<br>')}</p>`);
  }
  lines.push(
    '<p class="modal-note"><b>Replace</b> overwrites all current data. ' +
    '<b>Merge</b> adds the backup’s keys, presets and conversations while keeping your current general settings.</p>'
  );

  $('#import-summary').innerHTML = lines.join('');
  $('#import-modal').classList.add('show');
}

export function closeImportModal() {
  $('#import-modal').classList.remove('show');
  pendingImport = null;
}

export function confirmImport(mode) {
  if (!pendingImport) return;
  const result = pendingImport;
  closeImportModal();
  applyImport(result, mode);
}

function applyImport(result, mode) {
  // Snapshot current data so we can roll back if anything throws.
  const snapSettings = structuredClone(settings);
  const snapConvs = structuredClone(conversations);

  try {
    const merged = mergeData(
      { settings, conversations },
      { settings: result.settings, conversations: result.conversations },
      mode,
    );
    setSettings(merged.settings);
    setConversations(merged.conversations);

    // Sanitize using the same normalizers the loader uses.
    settings.search = normalizeSearchSettings(settings.search);
    if (!Array.isArray(settings.apiKeys)) settings.apiKeys = [];
    if (!Array.isArray(settings.thinkingModels)) settings.thinkingModels = [];
    if (!Array.isArray(settings.presets)) settings.presets = [];
    ensureCustomPresets();
    ensureActiveKeySelection();
    normalizeConversations(conversations);

    // Re-render the whole UI from the new state.
    applySettingsToUI();
    setActiveConvId(null);
    renderConvList();
    if (conversations.length > 0) {
      switchConv(conversations[0].id);
    } else {
      renderMessages();
      updateRegenBtn();
    }

    Promise.all([persistSettings(), persistConversations()]).then(([okS, okC]) => {
      if (!okS || !okC) toast('Imported, but saving to storage failed');
    });
    toast(mode === 'replace' ? 'Backup imported (replaced)' : 'Backup imported (merged)');
  } catch (_) {
    // Roll back to the snapshot.
    setSettings(snapSettings);
    setConversations(snapConvs);
    applySettingsToUI();
    renderConvList();
    renderMessages();
    updateRegenBtn();
    toast('Import failed — your data was restored');
  }
}
