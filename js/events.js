// ── UI helpers ─────────────────────────────────────────────────────────────────
function $(sel) { return document.querySelector(sel); }
function friendlyError(e) {
  if (e.name === 'TypeError' && e.message === 'Failed to fetch') {
    const onLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (onLocal) {
      return 'Failed to fetch — check your Base URL and network connection.\nIf using a VPN or firewall, try disabling it.';
    }
    return 'Failed to fetch — CORS blocked by browser.\n➜ Run: python3 server.py\n➜ Then open: http://localhost:8080';
  }
  return e.message;
}

// Routes API fetch through local proxy whenever the page is served by server.py
async function proxyFetch(url, options) {
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

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function relTime(ts) {
  const d = Date.now() - ts;
  if (d < 60000)    return 'Just now';
  if (d < 3600000)  return `${Math.floor(d/60000)}m ago`;
  if (d < 86400000) return `${Math.floor(d/3600000)}h ago`;
  return new Date(ts).toLocaleDateString();
}
function toast(msg, ms = 2800) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), ms);
}
function copyText(btn, text) {
  navigator.clipboard.writeText(text).then(() => {
    const o = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = o, 1500);
  });
}
function syncSendButton() {
  const b = $('#send-btn');
  if (!b) return;
  // When streaming (stop mode), keep it clickable even if model gets cleared.
  b.disabled = !abortController && !settings.model;
}
function setSendStop(stop) {
  const b = $('#send-btn');
  b.textContent = stop ? 'Stop' : 'Send';
  b.classList.toggle('stop', stop);
  b.disabled = !stop && !settings.model;
}
function openSettings()  { closeMobileSidebar(); $('#settings-drawer').classList.add('open');  $('#overlay').classList.add('show'); }
function closeSettings() { $('#settings-drawer').classList.remove('open'); $('#overlay').classList.remove('show'); }
let settingsAutoSaveTimer = null;
async function persistSettingsSafely(showSuccess = false) {
  const ok = await persistSettings();
  if (!ok) {
    toast('Failed to save settings');
    return false;
  }
  if (showSuccess) toast('Settings saved');
  return true;
}
function autoSaveGeneralSettings(delay = 0) {
  clearTimeout(settingsAutoSaveTimer);
  const run = async () => {
    readGeneralFromUI();
    await persistSettingsSafely(false);
  };
  if (delay > 0) {
    settingsAutoSaveTimer = setTimeout(run, delay);
  } else {
    run();
  }
}
function syncSearchSettingsInMemory() {
  if (typeof readSearchSettingsFromUI === 'function') readSearchSettingsFromUI();
}
function updateStorageStatus() {
  const el = $('#storage-status');
  if (useServerStorage) {
    el.className = 'status-badge ok';
    el.innerHTML = `<span class="status-dot"></span> Server — saving to api/ via ${escHtml(window.location.host)}`;
  } else {
    el.className = 'status-badge';
    el.innerHTML = '<span class="status-dot"></span> Browser storage (run python3 server.py for file persistence)';
  }
}
function exportConversations() {
  const blob = new Blob([JSON.stringify(conversations, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `conversations_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Conversations exported');
}
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 200) + 'px';
}
const mobileSidebarQuery = window.matchMedia('(max-width: 760px)');
function isMobileLayout() {
  return mobileSidebarQuery.matches;
}
function openMobileSidebar() {
  if (!isMobileLayout()) return;
  document.body.classList.add('mobile-sidebar-open');
}
function closeMobileSidebar() {
  document.body.classList.remove('mobile-sidebar-open');
}
function toggleMobileSidebar() {
  if (!isMobileLayout()) return;
  document.body.classList.toggle('mobile-sidebar-open');
}
function handleMobileLayoutChange(e) {
  if (!e.matches) closeMobileSidebar();
}
if (mobileSidebarQuery.addEventListener) mobileSidebarQuery.addEventListener('change', handleMobileLayoutChange);
else if (mobileSidebarQuery.addListener) mobileSidebarQuery.addListener(handleMobileLayoutChange);

// ── Events ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await init();
  if (typeof queueSearchToggleHeightSync === 'function') queueSearchToggleHeightSync();

  // Sidebar
  $('#btn-new').addEventListener('click', () => {
    closeMobileSidebar();
    newConv();
  });
  $('#btn-sidebar-toggle').addEventListener('click', toggleMobileSidebar);
  $('#sidebar-overlay').addEventListener('click', closeMobileSidebar);
  $('#conv-list').addEventListener('click', e => {
    const del  = e.target.closest('[data-del]');
    const item = e.target.closest('.conv-item');
    if (del)  { e.stopPropagation(); deleteConv(del.dataset.del); return; }
    if (item) {
      closeMobileSidebar();
      switchConv(item.dataset.id);
    }
  });
  $('#btn-clear-all').addEventListener('click', () => {
    closeMobileSidebar();
    clearAll();
  });
  $('#btn-export').addEventListener('click', () => {
    closeMobileSidebar();
    exportConversations();
  });
  $('#messages').addEventListener('click', e => {
    const copyBtn = e.target.closest('.msg-copy-btn');
    if (copyBtn) {
      const idx = parseInt(copyBtn.dataset.msgIdx, 10);
      const msg = activeConv()?.messages?.[idx];
      copyText(copyBtn, String(msg?.content || ''));
      return;
    }

    const regenBtn = e.target.closest('.msg-regen-btn');
    if (regenBtn) {
      const idx = parseInt(regenBtn.dataset.msgIdx, 10);
      if (Number.isFinite(idx)) regenFrom(idx);
      return;
    }

    const codeCopyBtn = e.target.closest('.code-copy-btn');
    if (codeCopyBtn) {
      copyText(codeCopyBtn, decodeDataValue(codeCopyBtn.dataset.copyCode));
    }
  });

  // Topbar — key selector
  $('#key-selector').addEventListener('change', e => {
    settings.activeKeyId = e.target.value || null;
    renderKeyList();
    renderKeySelector();
    syncActiveKeyModelSelection({ forceDefault: true });
    persistSettings();
  });

  // Model selector (presets-only)
  $('#model-selector').addEventListener('change', e => {
    settings.model = e.target.value;
    const activePreset = typeof getPresetByKeyId === 'function'
      ? getPresetByKeyId(settings.activeKeyId)
      : null;
    if (activePreset && settings.model && activePreset.models.includes(settings.model)) {
      activePreset.defaultModel = settings.model;
    }
    syncSendButton();
    persistSettings();
  });
  $('#search-toggle').addEventListener('change', e => {
    settings.search = normalizeSearchSettings({
      ...getSearchSettings(),
      enabled: e.target.checked,
    });
    persistSettings();
    if (e.target.checked && !useServerStorage) {
      toast('Web Search requires python3 server.py and http://localhost:8080');
    }
  });

  // Topbar — regen
  $('#btn-regen').addEventListener('click', () => {
    const conv = activeConv();
    if (!conv) return;
    const last = conv.messages.map(m => m.role).lastIndexOf('assistant');
    if (last >= 0) regenFrom(last);
  });

  // Settings drawer
  $('#btn-settings').addEventListener('click', openSettings);
  $('#btn-close-settings').addEventListener('click', closeSettings);
  $('#overlay').addEventListener('click', closeSettings);
  $('#s-search-provider')?.addEventListener('change', () => {
    if (typeof updateSearchProviderFields === 'function') updateSearchProviderFields();
    autoSaveGeneralSettings();
  });
  $('#s-system-prompt')?.addEventListener('input', () => autoSaveGeneralSettings(400));
  $('#s-include-time-context')?.addEventListener('change', () => autoSaveGeneralSettings());
  $('#s-max-tokens')?.addEventListener('input', () => autoSaveGeneralSettings(300));
  $('#s-stream')?.addEventListener('change', () => autoSaveGeneralSettings());
  $('#settings-drawer').addEventListener('click', e => {
    const toggleSecretBtn = e.target.closest('.toggle-secret-btn');
    if (!toggleSecretBtn) return;
    const target = document.getElementById(toggleSecretBtn.dataset.target || '');
    if (!target) return;
    target.type = target.type === 'password' ? 'text' : 'password';
    toggleSecretBtn.textContent = target.type === 'password' ? 'Show' : 'Hide';
  });

  $('#s-temperature').addEventListener('input', e => {
    $('#temp-val').textContent = e.target.value;
    autoSaveGeneralSettings(150);
  });
  $('#s-brave-api-key')?.addEventListener('input', () => {
    syncSearchSettingsInMemory();
    autoSaveGeneralSettings(400);
  });
  $('#s-tavily-api-key')?.addEventListener('input', () => {
    syncSearchSettingsInMemory();
    autoSaveGeneralSettings(400);
  });

  // ── Preset management ─────────────────────────────────────────────────────
  $('#preset-list').addEventListener('click', e => {
    const delGroup  = e.target.closest('.preset-del-group');
    const delModel  = e.target.closest('.preset-del-model');
    const defaultBtn = e.target.closest('.preset-default-btn');
    const addModel  = e.target.closest('.preset-add-model-btn');
    const label     = e.target.closest('.preset-group-label');
    const header    = e.target.closest('.preset-group-header');

    if (delGroup) {
      const gi = parseInt(delGroup.dataset.gi);
      if (!confirm(`Delete group "${getPresetDisplayName(getPresets()[gi])}"?`)) return;
      ensureCustomPresets();
      const groupModels = settings.presets[gi]?.models || [];
      settings.presets.splice(gi, 1);
      if (!Array.isArray(settings.thinkingModels)) settings.thinkingModels = [];
      settings.thinkingModels = settings.thinkingModels.filter(m => !groupModels.includes(m));
      persistSettings(); renderPresetList(); refreshPresetsDropdowns();
      return;
    }
    if (delModel) {
      const gi = parseInt(delModel.dataset.gi), mi = parseInt(delModel.dataset.mi);
      ensureCustomPresets();
      const deletedModel = settings.presets[gi]?.models?.[mi];
      if (!deletedModel) return;
      if (!confirm(`Remove model "${deletedModel}" from this key?`)) return;
      settings.presets[gi].models.splice(mi, 1);
      if (settings.presets[gi] && settings.presets[gi].defaultModel === deletedModel) {
        settings.presets[gi].defaultModel = settings.presets[gi].models[0] || '';
      }
      if (!Array.isArray(settings.thinkingModels)) settings.thinkingModels = [];
      if (deletedModel) settings.thinkingModels = settings.thinkingModels.filter(m => m !== deletedModel);
      renderPresetList(); refreshPresetsDropdowns(); persistSettings();
      // Re-expand group
      const g = document.querySelector(`.preset-group[data-gi="${gi}"] .preset-group-body`);
      if (g) { g.style.display = ''; g.closest('.preset-group').querySelector('.preset-toggle').textContent = '▼'; }
      return;
    }
    if (defaultBtn) {
      const gi = parseInt(defaultBtn.dataset.gi);
      const mi = parseInt(defaultBtn.dataset.mi);
      const model = settings.presets[gi]?.models?.[mi];
      if (!model) return;
      settings.presets[gi].defaultModel = model;
      if (settings.presets[gi]?.keyId === settings.activeKeyId) {
        settings.model = model;
      }
      renderPresetList(); refreshPresetsDropdowns({ forceDefault: settings.presets[gi]?.keyId === settings.activeKeyId }); persistSettings();
      const g = document.querySelector(`.preset-group[data-gi="${gi}"] .preset-group-body`);
      if (g) { g.style.display = ''; g.closest('.preset-group').querySelector('.preset-toggle').textContent = '▼'; }
      return;
    }
    if (addModel) {
      const gi = parseInt(addModel.dataset.gi);
      const inp = addModel.previousElementSibling;
      const model = inp.value.trim();
      if (!model) return;
      ensureCustomPresets();
      const isNew = !settings.presets[gi].models.includes(model);
      if (isNew) {
        settings.presets[gi].models.push(model);
        if (!settings.presets[gi].defaultModel) settings.presets[gi].defaultModel = model;
        if (!Array.isArray(settings.thinkingModels)) settings.thinkingModels = [];
        const row = addModel.closest('.preset-add-row');
        const thinkingFlag = row?.querySelector('.preset-thinking-flag')?.checked;
        if (thinkingFlag && !settings.thinkingModels.includes(model)) settings.thinkingModels.push(model);
      }
      renderPresetList(); refreshPresetsDropdowns(); persistSettings();
      // Re-expand group
      const g = document.querySelector(`.preset-group[data-gi="${gi}"] .preset-group-body`);
      if (g) { g.style.display = ''; g.closest('.preset-group').querySelector('.preset-toggle').textContent = '▼'; }
      return;
    }
    if (label) {
      // Inline rename
      const gi = parseInt(label.dataset.gi);
      const group = getPresets()[gi];
      const keyId = group?.keyId;
      const input = document.createElement('input');
      input.className = 'preset-group-label-input';
      input.value = getPresetDisplayName(group);
      label.replaceWith(input);
      input.focus(); input.select();
      const save = () => {
        const v = input.value.trim();
        if (v && keyId) {
          const k = settings.apiKeys.find(x => x.id === keyId);
          if (k) k.name = v;
          ensureCustomPresets();
          persistSettings();
          renderKeyList();
          renderKeySelector();
          refreshPresetsDropdowns();
        }
        renderPresetList();
        // Re-expand if was expanded
      };
      input.addEventListener('blur', save);
      input.addEventListener('keydown', ev => {
        if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); }
        if (ev.key === 'Escape') renderPresetList();
      });
      return;
    }
    // Toggle expand/collapse on header click
    if (header && !e.target.closest('.key-act-btn')) {
      const body = header.nextElementSibling;
      const arrow = header.querySelector('.preset-toggle');
      const open = body.style.display !== 'none';
      body.style.display = open ? 'none' : '';
      arrow.textContent = open ? '▶' : '▼';
    }
  });

  // Enter key on add-model inputs
  $('#preset-list').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.classList.contains('preset-new-model')) {
      e.preventDefault();
      e.target.nextElementSibling?.click();
    }
  });

  // Add group
  const showAddGroup = () => {
    $('#preset-add-group-row').style.display = 'flex';
    $('#btn-add-preset-group').style.display = 'none';
    $('#preset-new-group').value = '';
    $('#preset-new-group').focus();
  };
  const hideAddGroup = () => {
    $('#preset-add-group-row').style.display = 'none';
    $('#btn-add-preset-group').style.display = '';
  };
  const confirmAddGroup = () => {
    toast('Preset groups are created automatically from API Keys');
    hideAddGroup();
  };

  $('#btn-add-preset-group').addEventListener('click', showAddGroup);
  $('#preset-add-group-confirm').addEventListener('click', confirmAddGroup);
  $('#preset-add-group-cancel').addEventListener('click', hideAddGroup);
  $('#preset-new-group').addEventListener('keydown', e => {
    if (e.key === 'Enter') confirmAddGroup();
    if (e.key === 'Escape') hideAddGroup();
  });

  // Reset presets
  $('#btn-reset-presets').addEventListener('click', () => {
    if (!confirm('Reset to built-in defaults? All custom presets will be lost.')) return;
    settings.presets = null;
    settings.thinkingModels = [];
    persistSettings(); renderPresetList(); refreshPresetsDropdowns();
    toast('Presets reset to defaults');
  });

  // Add key button
  $('#btn-add-key').addEventListener('click', () => {
    editingKeyId = 'new';
    renderKeyList();
    // Scroll to top of key-list
    $('#key-list').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // Key list delegation (clicks + changes)
  $('#key-list').addEventListener('click', e => {
    const editBtn   = e.target.closest('.key-act-btn.edit');
    const delBtn    = e.target.closest('.key-act-btn.del');
    const cancelBtn = e.target.closest('.kf-cancel-btn');
    const saveBtn   = e.target.closest('.kf-save-btn');
    const testBtn   = e.target.closest('.kf-test-btn');
    const toggleBtn = e.target.closest('.kf-toggle-key');
    const keyItem   = e.target.closest('.key-item');

    if (editBtn) {
      editingKeyId = editBtn.closest('.key-item').dataset.id;
      renderKeyList();
    } else if (delBtn) {
      deleteKey(delBtn.closest('.key-item').dataset.id);
    } else if (cancelBtn) {
      editingKeyId = null;
      renderKeyList();
    } else if (saveBtn) {
      saveKeyFromForm(saveBtn.closest('.key-form'));
    } else if (testBtn) {
      testKeyFromForm(testBtn.closest('.key-form'));
    } else if (toggleBtn) {
      const inp = toggleBtn.previousElementSibling;
      inp.type = inp.type === 'password' ? 'text' : 'password';
      toggleBtn.textContent = inp.type === 'password' ? 'Show' : 'Hide';
    } else if (keyItem && !e.target.closest('.key-item-btns')) {
      // Click on key item to make it active
      settings.activeKeyId = keyItem.dataset.id;
      renderKeyList();
      renderKeySelector();
      syncActiveKeyModelSelection({ forceDefault: true });
      persistSettings();
    }
  });

  // Input
  const inputEl = $('#user-input');
  inputEl.addEventListener('input', () => autoResize(inputEl));
  inputEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (abortController) abortController.abort();
      else sendMessage();
    }
  });
  $('#send-btn').addEventListener('click', () => {
    if (abortController) abortController.abort();
    else sendMessage();
  });
});

if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    if (typeof queueSearchToggleHeightSync === 'function') queueSearchToggleHeightSync();
  });
}
