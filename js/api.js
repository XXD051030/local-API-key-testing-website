// ── Chat ──────────────────────────────────────────────────────────────────────
async function sendMessage() {
  const input = $('#user-input');
  const text  = input.value.trim();
  if (!text || abortController) return;

  const activeKey = getActiveKey();
  if (!activeKey) { toast('Add an API key in Settings first'); openSettings(); return; }
  if (!settings.model) { toast('Select a model above the chat box'); return; }

  if (!activeConvId) newConv();

  const conv = activeConv();
  const userMsg = { role: 'user', content: text, time: Date.now() };
  conv.messages.push(userMsg);
  autoNameConv(conv);
  persistConversations();
  renderConvList();
  appendMsgRow(userMsg, conv.messages.length - 1);

  input.value = '';
  input.style.height = 'auto';

  const assistantMsg = { role: 'assistant', content: '', thinking: '', hasThinking: false, time: Date.now(), model: settings.model };
  conv.messages.push(assistantMsg);
  appendMsgRow(assistantMsg, conv.messages.length - 1);

  const lastRow   = $('#messages').lastElementChild;
  const contentEl = lastRow.querySelector('.msg-content');
  contentEl.classList.add('streaming-cursor');

  setSendStop(true);
  abortController = new AbortController();
  try {
    await callAPI(conv, contentEl, assistantMsg, activeKey);
  } catch(e) {
    if (e.name !== 'AbortError') {
      const msg = friendlyError(e);
      assistantMsg.content = `**Error:** ${msg}`;
    } else {
      if (!assistantMsg.content) assistantMsg.content = '*[Stopped]*';
    }
  } finally {
    contentEl.classList.remove('streaming-cursor');
    contentEl.innerHTML = renderAssistantContentHTML(assistantMsg, false);
    updateMsgMeta(contentEl, assistantMsg);
    setSendStop(false);
    abortController = null;
    persistConversations();
    updateRegenBtn();
    $('#messages').scrollTop = $('#messages').scrollHeight;
  }
}

async function callAPI(conv, contentEl, assistantMsg, activeKey) {
  const msgs = [];
  if (settings.systemPrompt) msgs.push({ role: 'system', content: settings.systemPrompt });
  conv.messages.slice(0, -1).forEach(m => msgs.push({ role: m.role, content: m.content }));

  const body = {
    model: settings.model,
    messages: msgs,
    stream: settings.stream,
    temperature: settings.temperature,
  };
  if (settings.maxTokens) body.max_tokens = parseInt(settings.maxTokens);

  const resp = await proxyFetch(`${activeKey.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${activeKey.key}` },
    body: JSON.stringify(body),
    signal: abortController.signal,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    let errMsg = `HTTP ${resp.status}`;
    try { const j = JSON.parse(errText); errMsg = j.error?.message || errMsg; } catch(_) {}
    throw new Error(errMsg);
  }

  if (settings.stream) {
    await readStream(resp, contentEl, assistantMsg);
  } else {
    const data = await resp.json();
    const message = data.choices?.[0]?.message || {};
    assistantMsg.content = message.content || '';
    assistantMsg.thinking = message.reasoning_content || message.reasoning || message.thought || '';
    assistantMsg.hasThinking = !!assistantMsg.thinking;
    if (data.usage) assistantMsg.tokens = data.usage;
    contentEl.innerHTML = renderAssistantContentHTML(assistantMsg, false);
  }
}

async function readStream(resp, contentEl, assistantMsg) {
  const reader  = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const RENDER_INTERVAL_MS = 80;
  let lastRenderAt = 0;
  let renderTimerId = null;
  let thinkingDetailsOpen = true;
  let streamFinished = false;
  let contentStarted = !!assistantMsg.content;

  const renderNow = () => {
    lastRenderAt = Date.now();
    contentEl.innerHTML = renderAssistantContentHTML(assistantMsg, thinkingDetailsOpen);
    $('#messages').scrollTop = $('#messages').scrollHeight;
  };

  const requestRender = () => {
    if (streamFinished) return;
    if (renderTimerId) return;
    const now = Date.now();
    const wait = Math.max(0, RENDER_INTERVAL_MS - (now - lastRenderAt));
    renderTimerId = setTimeout(() => {
      renderTimerId = null;
      renderNow();
    }, wait);
  };

  const finishStream = () => {
    if (streamFinished) return;
    streamFinished = true;
    thinkingDetailsOpen = false;
    if (renderTimerId) {
      clearTimeout(renderTimerId);
      renderTimerId = null;
    }
    renderNow();
  };

  // Initial render (thinking open while streaming)
  contentEl.innerHTML = renderAssistantContentHTML(assistantMsg, true);

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      finishStream();
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') {
        finishStream();
        return;
      }
      try {
        const json  = JSON.parse(data);
        const delta = json.choices?.[0]?.delta || {};
        const deltaContent = delta.content;
        const deltaThinking =
          delta.reasoning_content ??
          delta.reasoning ??
          delta.thought;

        if (typeof deltaContent === 'string' && deltaContent) {
          assistantMsg.content += deltaContent;
          contentStarted = true;
          // If we already have thinking content, collapse it as soon as output starts.
          if (assistantMsg.thinking && thinkingDetailsOpen) {
            thinkingDetailsOpen = false;
          }
          requestRender();
        }

        if (typeof deltaThinking === 'string' && deltaThinking) {
          assistantMsg.thinking += deltaThinking;
          assistantMsg.hasThinking = true;
          // Do not reopen thinking once normal content has started streaming.
          if (!contentStarted && !streamFinished) thinkingDetailsOpen = true;
          requestRender();
        }

        if (json.usage) assistantMsg.tokens = json.usage;
      } catch(_) {}
    }
  }
}

async function regenFrom(idx) {
  const conv = activeConv();
  if (!conv || abortController) return;
  conv.messages = conv.messages.slice(0, idx);
  persistConversations();
  renderMessages();
  // Re-trigger send using trimmed conv
  const activeKey = getActiveKey();
  if (!activeKey) { toast('No active API key'); return; }
  if (!settings.model) { toast('Select a model above the chat box'); return; }

  const assistantMsg = { role: 'assistant', content: '', thinking: '', hasThinking: false, time: Date.now(), model: settings.model };
  conv.messages.push(assistantMsg);
  appendMsgRow(assistantMsg, conv.messages.length - 1);
  const lastRow   = $('#messages').lastElementChild;
  const contentEl = lastRow.querySelector('.msg-content');
  contentEl.classList.add('streaming-cursor');

  setSendStop(true);
  abortController = new AbortController();
  try {
    await callAPI(conv, contentEl, assistantMsg, activeKey);
  } catch(e) {
    if (e.name !== 'AbortError') assistantMsg.content = `**Error:** ${friendlyError(e)}`;
  } finally {
    contentEl.classList.remove('streaming-cursor');
    contentEl.innerHTML = renderAssistantContentHTML(assistantMsg, false);
    updateMsgMeta(contentEl, assistantMsg);
    setSendStop(false);
    abortController = null;
    persistConversations();
    updateRegenBtn();
  }
}

// Updates the model tag + token info below an assistant message after API completes
function updateMsgMeta(contentEl, msg) {
  const body = contentEl.parentElement; // .msg-body
  let metaEl = body.querySelector('.token-info');
  const metaParts = [];
  if (msg.model) metaParts.push(`<span style="color:var(--accent);background:rgba(108,99,255,.1);padding:1px 7px;border-radius:10px">${escHtml(msg.model)}</span>`);
  if (msg.tokens) metaParts.push(`↑${msg.tokens.prompt_tokens||0} ↓${msg.tokens.completion_tokens||0} · total ${msg.tokens.total_tokens||0}`);
  if (!metaParts.length) return;
  if (!metaEl) {
    metaEl = document.createElement('div');
    metaEl.className = 'token-info';
    metaEl.style.cssText = 'display:flex;align-items:center;gap:6px;flex-wrap:wrap';
    contentEl.after(metaEl);
  }
  metaEl.innerHTML = metaParts.join('');
}

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

// Routes API fetch through local proxy when on localhost (avoids CORS restrictions)
async function proxyFetch(url, options) {
  const onLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (onLocal) {
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
