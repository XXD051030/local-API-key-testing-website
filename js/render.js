// ── Render ────────────────────────────────────────────────────────────────────
function renderKeySelector() {
  const sel = $('#key-selector');
  if (!settings.apiKeys.length) {
    sel.innerHTML = '<option value="">No keys — add in Settings</option>';
    return;
  }
  sel.innerHTML = settings.apiKeys.map(k =>
    `<option value="${escHtml(k.id)}" ${k.id === settings.activeKeyId ? 'selected' : ''}>${escHtml(k.name)}</option>`
  ).join('');
}

function applyModelInput() {
  // Model selection is controlled by #model-selector (presets-only).
  // This function is kept for backward compatibility with older code paths.
}

function renderKeyList() {
  const container = $('#key-list');
  let html = '';

  if (editingKeyId === 'new') html += buildKeyForm({ id: 'new', name: '', baseUrl: '', key: '' });

  if (!settings.apiKeys.length && editingKeyId !== 'new') {
    html += '<div class="key-empty">No API keys yet. Click "+ Add Key" above.</div>';
  }

  for (const k of settings.apiKeys) {
    html += editingKeyId === k.id ? buildKeyForm(k) : buildKeyItem(k);
  }

  container.innerHTML = html;
}

function buildKeyItem(k) {
  const isActive = k.id === settings.activeKeyId;
  const masked   = k.key ? '•'.repeat(Math.min(k.key.length - 4, 8)) + k.key.slice(-4) : '—';
  const urlShort = k.baseUrl.replace(/^https?:\/\//, '').slice(0, 32);
  return `
    <div class="key-item ${isActive ? 'active' : ''}" data-id="${escHtml(k.id)}">
      <div class="key-item-main">
        <div class="key-item-name">${escHtml(k.name)}</div>
        <div class="key-item-meta">
          <span class="key-item-url">${escHtml(urlShort)}</span>
        </div>
        <div class="key-item-masked">${masked}</div>
      </div>
      <div class="key-item-btns">
        <button class="key-act-btn edit" title="Edit">✎</button>
        <button class="key-act-btn del"  title="Delete">✕</button>
      </div>
    </div>`;
}

function buildKeyForm(k) {
  const isNew = k.id === 'new';
  return `
    <div class="key-form" data-editing="${escHtml(k.id)}">
      <div class="field-group">
        <label class="field-label">Name / Remark</label>
        <input class="field-input kf-name" type="text" value="${escHtml(k.name)}" placeholder="e.g. OpenAI Personal">
      </div>
      <div class="field-group">
        <label class="field-label">Base URL</label>
        <input class="field-input kf-url" type="text" value="${escHtml(k.baseUrl)}" placeholder="https://api.openai.com/v1" spellcheck="false">
      </div>
      <div class="field-group">
        <label class="field-label">API Key</label>
        <div class="row-group">
          <input class="field-input kf-key" type="password" value="${escHtml(k.key || '')}" placeholder="sk-..." autocomplete="off">
          <button class="btn-secondary kf-toggle-key" type="button" style="flex-shrink:0">Show</button>
        </div>
      </div>
      ${isNew ? `
      <div class="field-group">
        <label class="field-label">Initial Model <span style="font-weight:400;color:var(--text3)">(optional, for testing)</span></label>
        <div style="display:flex;gap:8px;align-items:center">
          <input class="field-input kf-model" type="text" placeholder="e.g. gpt-4o" spellcheck="false" style="flex:1">
          <label class="preset-thinking-mark" title="Mark as thinking-capable model">
            <input type="checkbox" class="kf-thinking-flag"> Thinking
          </label>
        </div>
      </div>` : ''}
      <div class="key-form-test">
        <button class="btn-secondary kf-test-btn" type="button">Test Connection</button>
        <div class="kf-test-status status-badge"></div>
      </div>
      <div class="key-form-btns">
        <button class="btn-secondary kf-cancel-btn" type="button">Cancel</button>
        <button class="btn-primary kf-save-btn" type="button">${isNew ? 'Add Key' : 'Save'}</button>
      </div>
    </div>`;
}

function renderConvList() {
  const list = $('#conv-list');
  if (!conversations.length) {
    list.innerHTML = '<div style="padding:16px 10px;font-size:12px;color:var(--text3);text-align:center">No conversations</div>';
    return;
  }
  list.innerHTML = conversations.map(c => `
    <div class="conv-item ${c.id === activeConvId ? 'active' : ''}" data-id="${c.id}">
      <div class="conv-item-text">
        <div class="conv-item-name">${escHtml(c.name)}</div>
        <div class="conv-item-date">${relTime(c.created)}</div>
      </div>
      <button class="conv-del" data-del="${c.id}">✕</button>
    </div>`).join('');
}

function renderMessages() {
  const conv      = activeConv();
  const container = $('#messages');
  if (!conv || !conv.messages.length) {
    container.innerHTML = `
      <div id="empty-state">
        <div class="es-icon">XXD</div>
        <h2>${conv ? 'Start the conversation' : 'Select or create a chat'}</h2>
        <p>${conv ? 'Type a message below to begin. Make sure a model is selected above.' : 'Use the sidebar to manage conversations.'}</p>
      </div>`;
    return;
  }
  container.innerHTML = conv.messages.map((m, i) => buildMsgHTML(m, i)).join('');
  container.scrollTop = container.scrollHeight;
}

function buildMsgHTML(msg, idx) {
  const isUser  = msg.role === 'user';
  const content = isUser
    ? `<div class="msg-content">${escHtml(msg.content).replace(/\n/g, '<br>')}</div>`
    : `<div class="msg-content">${renderAssistantContentHTML(msg, false)}</div>`;
  const metaParts = [];
  if (msg.model) metaParts.push(`<span style="color:var(--accent);background:rgba(108,99,255,.1);padding:1px 7px;border-radius:10px">${escHtml(msg.model)}</span>`);
  if (msg.tokens) metaParts.push(`↑${msg.tokens.prompt_tokens||0} ↓${msg.tokens.completion_tokens||0} · total ${msg.tokens.total_tokens||0}`);
  const tokenInfo = metaParts.length ? `<div class="token-info" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">${metaParts.join('')}</div>` : '';
  // Copy button uses backtick template literals: escape `${` to prevent injection
  const escapedContent = msg.content
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
  return `
    <div class="msg-row ${msg.role}">
      <div class="msg-avatar">${isUser ? 'U' : 'AI'}</div>
      <div class="msg-body">
        <div class="msg-meta">
          <span class="msg-role">${isUser ? 'You' : 'Assistant'}</span>
          ${msg.time ? `<span>${new Date(msg.time).toLocaleTimeString()}</span>` : ''}
        </div>
        ${content}
        ${tokenInfo}
        <div class="msg-actions">
          <button class="action-btn" onclick="copyText(this,\`${escapedContent}\`)">Copy</button>
          ${!isUser ? `<button class="action-btn" onclick="regenFrom(${idx})">Regenerate</button>` : ''}
        </div>
      </div>
    </div>`;
}

// Render assistant message content with optional thinking (collapsed by default)
function renderAssistantContentHTML(msg, thinkingOpen) {
  const thinking = msg.thinking || '';
  const content = msg.content || '';
  const thinkingHtml = thinking
    ? `<details class="thinking-details"${thinkingOpen ? ' open' : ''}><summary>Thinking</summary>${marked.parse(thinking)}</details>`
    : '';
  return `${thinkingHtml}${content ? marked.parse(content) : ''}`;
}

function appendMsgRow(msg, idx) {
  const empty = $('#empty-state');
  if (empty) empty.remove();
  const tmp = document.createElement('div');
  tmp.innerHTML = buildMsgHTML(msg, idx);
  $('#messages').appendChild(tmp.firstElementChild);
  $('#messages').scrollTop = $('#messages').scrollHeight;
}

function updateRegenBtn() {
  const conv = activeConv();
  const has  = conv && conv.messages.some(m => m.role === 'assistant');
  $('#btn-regen').style.display = has ? '' : 'none';
}
