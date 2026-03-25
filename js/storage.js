// ── File storage via server (or localStorage fallback) ────────────────────────
function isLocalhost() {
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

async function readFile(filename) {
  if (isLocalhost()) {
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
  if (isLocalhost()) {
    try {
      await fetch(`/file?name=${encodeURIComponent(filename)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return true;
    } catch(_) { return false; }
  }
  try {
    localStorage.setItem(`apitester_${filename}`, JSON.stringify(data));
    return true;
  } catch(_) { return false; }
}

// ── Settings persistence ──────────────────────────────────────────────────────
async function persistSettings() {
  await writeFile(SETTINGS_FILE, settings);
}

async function loadSettingsFromFile() {
  const data = await readFile(SETTINGS_FILE);
  if (data && typeof data === 'object') {
    settings = { ...settings, ...data };
    // Ensure apiKeys is array
    if (!Array.isArray(settings.apiKeys)) settings.apiKeys = [];
    if (!Array.isArray(settings.thinkingModels)) settings.thinkingModels = [];
    if (!Array.isArray(settings.presets)) settings.presets = [];

    // Discard old presets without keyId and ensure groups exist for keys.
    ensureCustomPresets();
  }
}

function applySettingsToUI() {
  $('#s-system-prompt').value = settings.systemPrompt || '';
  $('#s-temperature').value   = settings.temperature ?? 0.7;
  $('#temp-val').textContent  = settings.temperature ?? 0.7;
  $('#s-max-tokens').value    = settings.maxTokens || '';
  $('#s-stream').value        = (settings.stream !== false).toString();

  refreshPresetsDropdowns();

  renderKeySelector();
  renderKeyList();
  renderPresetList();
}

function readGeneralFromUI() {
  settings.systemPrompt = $('#s-system-prompt').value;
  settings.temperature  = parseFloat($('#s-temperature').value);
  settings.maxTokens    = $('#s-max-tokens').value;
  settings.stream       = $('#s-stream').value === 'true';
  settings.model        = $('#model-selector').value;
}

// ── Conversations persistence ─────────────────────────────────────────────────
async function persistConversations() {
  await writeFile(CONV_FILE, conversations);
}

async function loadConversationsFromFile() {
  const data = await readFile(CONV_FILE);
  if (data && Array.isArray(data)) conversations = data;
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  await loadSettingsFromFile();
  await loadConversationsFromFile();
  applySettingsToUI();
  renderConvList();
  if (conversations.length > 0) switchConv(conversations[0].id);
  updateStorageStatus();
}
