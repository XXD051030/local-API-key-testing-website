// ── Key-bound Model presets ───────────────────────────────────────────────────
function isKeyBoundPresetGroup(g) {
  return g
    && typeof g === 'object'
    && typeof g.keyId === 'string'
    && Array.isArray(g.models);
}

function getPresets() {
  return Array.isArray(settings.presets) ? settings.presets : [];
}

function getPresetByKeyId(keyId) {
  return getPresets().find(group => group?.keyId === keyId) || null;
}

function getPresetDisplayName(group) {
  if (!group) return '';
  const key = settings.apiKeys.find(item => item.id === group.keyId);
  return String(key?.name || group.keyName || group.label || '').trim();
}

function getPresetDefaultModel(group) {
  if (!group || !Array.isArray(group.models) || !group.models.length) return '';
  const defaultModel = String(group.defaultModel || '').trim();
  return group.models.includes(defaultModel) ? defaultModel : group.models[0];
}

function ensureActiveKeySelection() {
  const hasActiveKey = settings.apiKeys.some(key => key.id === settings.activeKeyId);
  if (hasActiveKey) return settings.activeKeyId;
  settings.activeKeyId = settings.apiKeys[0]?.id || null;
  return settings.activeKeyId;
}

function normalizePresetGroup(group, key) {
  const models = Array.from(new Set(
    (Array.isArray(group?.models) ? group.models : [])
      .map(model => String(model || '').trim())
      .filter(Boolean)
  ));
  const keyName = String(key?.name || group?.keyName || group?.label || '').trim();
  const defaultModel = models.includes(String(group?.defaultModel || '').trim())
    ? String(group.defaultModel).trim()
    : (models[0] || '');

  return {
    keyId: String(key?.id || group?.keyId || ''),
    keyName,
    models,
    defaultModel,
  };
}

// Kept for backward compatibility with existing preset-management code paths.
function ensureCustomPresets() {
  if (!Array.isArray(settings.presets)) settings.presets = [];

  // Discard old preset shapes that do not include keyId.
  settings.presets = settings.presets.filter(isKeyBoundPresetGroup);

  // Ensure every API key has exactly one preset group.
  settings.presets = settings.apiKeys.map(key => {
    const existing = getPresetByKeyId(key.id);
    return normalizePresetGroup(existing, key);
  });
}

function buildPresetsHTML(groups) {
  const list = Array.isArray(groups) ? groups : getPresets();
  return list
    .map(g =>
      `<optgroup label="${escHtml(getPresetDisplayName(g))}">${g.models.map(m => `<option value="${escHtml(m)}">${escHtml(m)}</option>`).join('')}</optgroup>`
    )
    .join('');
}

function refreshPresetsDropdowns(options = {}) {
  const sel = $('#model-selector');
  if (!sel) return;

  ensureCustomPresets();
  ensureActiveKeySelection();

  const current = settings.model || '';
  const activeGroup = getPresetByKeyId(settings.activeKeyId);
  const activeGroups = activeGroup ? [activeGroup] : [];
  sel.innerHTML = `<option value="">Select a model...</option>${buildPresetsHTML(activeGroups)}`;

  if (!activeGroup || !activeGroup.models.length) {
    settings.model = '';
    sel.value = '';
    syncSendButton();
    return '';
  }

  const valid = current && activeGroup.models.includes(current);
  const nextModel = options.forceDefault
    ? getPresetDefaultModel(activeGroup)
    : (valid ? current : getPresetDefaultModel(activeGroup));

  settings.model = nextModel || '';
  sel.value = nextModel || '';
  syncSendButton();
  return settings.model;
}

function syncActiveKeyModelSelection(options = {}) {
  ensureCustomPresets();
  ensureActiveKeySelection();
  return refreshPresetsDropdowns(options);
}

function renderPresetList() {
  const container = $('#preset-list');
  const presets = getPresets();
  container.innerHTML = presets.map((g, gi) => `
    <div class="preset-group" data-gi="${gi}">
      <div class="preset-group-header">
        <button class="preset-toggle" title="Expand / Collapse">▶</button>
        <span class="preset-group-label" data-gi="${gi}" title="Click to rename">${escHtml(getPresetDisplayName(g))}</span>
        <span class="preset-model-count">${g.models.length}</span>
      </div>
      <div class="preset-group-body" style="display:none">
        ${g.models.length === 0 ? '<div style="font-size:12px;color:var(--text3);padding:3px 2px">No models yet</div>' : ''}
        ${g.models.map((m, mi) => `
          <div class="preset-model-row">
            <span class="preset-model-name">
              ${escHtml(m)}
              ${Array.isArray(settings.thinkingModels) && settings.thinkingModels.includes(m)
                ? '<span style="color:var(--accent);font-size:11px;margin-left:6px;white-space:nowrap">Thinking</span>'
                : ''}
            </span>
            <button class="preset-default-btn ${getPresetDefaultModel(g) === m ? 'active' : ''}" data-gi="${gi}" data-mi="${mi}" title="${getPresetDefaultModel(g) === m ? 'Default model' : 'Set as default model'}">
              ${getPresetDefaultModel(g) === m ? 'Default' : 'Set Default'}
            </button>
            <button class="key-act-btn del preset-del-model" data-gi="${gi}" data-mi="${mi}" title="Remove">✕</button>
          </div>`).join('')}
        <div class="preset-add-row">
          <input class="field-input preset-new-model" type="text" placeholder="model name..." spellcheck="false" style="font-size:12px;padding:5px 8px">
          <button class="btn-secondary preset-add-model-btn" data-gi="${gi}" style="padding:5px 10px;font-size:12px;flex-shrink:0">Add</button>
          <label class="preset-thinking-mark" title="Whether this model may output reasoning/thought">
            <input type="checkbox" class="preset-thinking-flag"> Thinking
          </label>
        </div>
      </div>
    </div>`).join('');
}

// ── Key management ────────────────────────────────────────────────────────────
function getActiveKey() {
  return settings.apiKeys.find(k => k.id === settings.activeKeyId) || null;
}

function deleteKey(id) {
  if (!confirm('Delete this API key?')) return;
  settings.apiKeys = settings.apiKeys.filter(k => k.id !== id);
  if (settings.activeKeyId === id) {
    settings.activeKeyId = settings.apiKeys[0]?.id || null;
  }
  if (editingKeyId === id) editingKeyId = null;

  if (Array.isArray(settings.presets)) {
    settings.presets = settings.presets.filter(p => p.keyId !== id);
  }

  // If current model belongs to removed key, we will clear it after refresh.
  renderKeyList();
  renderKeySelector();
  syncActiveKeyModelSelection({ forceDefault: true });
  renderPresetList();
  persistSettings();
}

function saveKeyFromForm(form) {
  const name  = form.querySelector('.kf-name').value.trim();
  const url   = form.querySelector('.kf-url').value.trim().replace(/\/$/, '');
  const key   = form.querySelector('.kf-key').value.trim();

  if (!name)  { toast('Name is required'); return; }
  if (!url)   { toast('Base URL is required'); return; }
  if (!key)   { toast('API Key is required'); return; }

  const editId = form.dataset.editing;
  if (editId === 'new') {
    const newK = { id: 'key_' + Date.now(), name, baseUrl: url, key };
    settings.apiKeys.push(newK);
    if (settings.apiKeys.length === 1) {
      settings.activeKeyId = newK.id;
    }

    ensureCustomPresets();

    const formModelInput = form.querySelector('.kf-model');
    const initialModel = formModelInput ? formModelInput.value.trim() : '';
    if (initialModel) {
      const group = settings.presets.find(p => p.keyId === newK.id);
      if (group && !group.models.includes(initialModel)) {
        group.models.push(initialModel);
      }
      if (group && !group.defaultModel) group.defaultModel = initialModel;
      const thinkingFlag = form.querySelector('.kf-thinking-flag');
      if (thinkingFlag?.checked) {
        if (!Array.isArray(settings.thinkingModels)) settings.thinkingModels = [];
        if (!settings.thinkingModels.includes(initialModel)) settings.thinkingModels.push(initialModel);
      }
    }
  } else {
    const existing = settings.apiKeys.find(k => k.id === editId);
    if (existing) { existing.name = name; existing.baseUrl = url; existing.key = key; }
    ensureCustomPresets();
  }

  editingKeyId = null;
  renderKeyList();
  renderKeySelector();
  syncActiveKeyModelSelection();
  renderPresetList();
  persistSettings();
  toast('Key saved');
}

async function testKeyFromForm(form) {
  const url   = form.querySelector('.kf-url').value.trim().replace(/\/$/, '');
  const key   = form.querySelector('.kf-key').value.trim();
  const editId = form.dataset.editing;
  const chatModel = settings.model || '';

  if (!url || !key) { toast('Base URL and API Key are required'); return; }

  let modelToUse = '';
  if (editId === 'new') {
    const formModelInput = form.querySelector('.kf-model');
    modelToUse = formModelInput ? formModelInput.value.trim() : '';
    if (!modelToUse) { toast('Enter a model name above to test this connection'); return; }
  } else {
    const group = Array.isArray(settings.presets) ? settings.presets.find(p => p.keyId === editId) || null : null;
    modelToUse = (group?.models || []).find(m => m === chatModel) || getPresetDefaultModel(group) || '';
  }

  if (!modelToUse) {
    toast('This key has no models yet. Add at least one model in Settings -> Model Presets, then try Test Connection again');
    return;
  }

  const statusEl = form.querySelector('.kf-test-status');
  const testBtn  = form.querySelector('.kf-test-btn');

  statusEl.className = 'kf-test-status status-badge show';
  statusEl.innerHTML = '<span class="status-dot"></span> Testing...';
  testBtn.disabled = true;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 20000);

  try {
    const resp = await proxyFetch(`${url}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: modelToUse, messages: [{ role: 'user', content: 'Hi' }], max_tokens: 1, stream: false }),
      signal: ac.signal,
    });
    clearTimeout(timer);
    if (resp.ok || resp.status === 400) {
      statusEl.className = 'kf-test-status status-badge show ok';
      statusEl.innerHTML = '<span class="status-dot"></span> Connected ✓';
    } else {
      let errMsg = `HTTP ${resp.status}`;
      try {
        const t = await Promise.race([resp.text(), new Promise((_, r) => setTimeout(() => r('timeout'), 5000))]);
        const j = JSON.parse(t);
        if (j.error?.message) errMsg = j.error.message;
      } catch(_) {}
      statusEl.className = 'kf-test-status status-badge show err';
      statusEl.innerHTML = `<span class="status-dot"></span> ${escHtml(errMsg)}`;
    }
  } catch(e) {
    clearTimeout(timer);
    statusEl.className = 'kf-test-status status-badge show err';
    const msg = e.name === 'AbortError' ? 'Connection timed out (20s)' : friendlyError(e);
    statusEl.style.cssText += ';white-space:pre-wrap;max-width:100%;border-radius:6px;padding:8px 10px';
    statusEl.innerHTML = `<span class="status-dot" style="flex-shrink:0"></span> <span>${escHtml(msg)}</span>`;
  } finally {
    testBtn.disabled = false;
  }
}
