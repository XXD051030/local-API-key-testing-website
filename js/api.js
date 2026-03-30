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

  const assistantMsg = createAssistantDraft();
  conv.messages.push(assistantMsg);
  appendMsgRow(assistantMsg, conv.messages.length - 1);

  const lastRow   = $('#messages').lastElementChild;
  const contentEl = lastRow.querySelector('.msg-content');

  setSendStop(true);
  abortController = new AbortController();
  try {
    await callAPI(conv, contentEl, assistantMsg, activeKey);
  } catch(e) {
    assistantMsg.pendingState = '';
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

function setAssistantSearchRuns(assistantMsg, runs) {
  const normalizedRuns = Array.isArray(runs)
    ? runs.filter(run => run && typeof run === 'object' && run.query)
    : [];
  assistantMsg.searches = normalizedRuns;
  assistantMsg.search = normalizedRuns[0] || null;
}

function createAssistantDraft() {
  return {
    role: 'assistant',
    content: '',
    thinking: '',
    hasThinking: false,
    pendingState: 'thinking',
    time: Date.now(),
    model: settings.model,
    search: null,
    searches: [],
  };
}

function resetAssistantDraft(assistantMsg, contentEl) {
  assistantMsg.content = '';
  assistantMsg.thinking = '';
  assistantMsg.hasThinking = false;
  assistantMsg.pendingState = '';
  contentEl.innerHTML = renderAssistantContentHTML(assistantMsg, false);
}

function setAssistantPendingState(assistantMsg, contentEl, pendingState) {
  assistantMsg.pendingState = pendingState || '';
  if (!assistantMsg.content && !assistantMsg.thinking) {
    contentEl.innerHTML = renderAssistantContentHTML(assistantMsg, false);
  }
}

function buildChatMessages(conv, options = {}) {
  const msgs = [];
  const extraSystemMessages = Array.isArray(options.extraSystemMessages)
    ? options.extraSystemMessages.filter(Boolean)
    : [];

  if (settings.systemPrompt) msgs.push({ role: 'system', content: settings.systemPrompt });
  extraSystemMessages.forEach(content => msgs.push({ role: 'system', content }));

  if (Array.isArray(options.messages)) return msgs.concat(options.messages);

  conv.messages.slice(0, -1).forEach(m => msgs.push({ role: m.role, content: m.content }));
  return msgs;
}

function buildChatRequestBody(messages, options = {}) {
  const body = {
    model: settings.model,
    messages,
    stream: options.stream ?? settings.stream,
    temperature: options.temperature ?? settings.temperature,
  };
  if (settings.maxTokens) body.max_tokens = parseInt(settings.maxTokens);
  if (Array.isArray(options.tools) && options.tools.length) body.tools = options.tools;
  if (options.toolChoice) body.tool_choice = options.toolChoice;
  return body;
}

async function requestChatCompletion(activeKey, body, signal) {
  const resp = await proxyFetch(`${activeKey.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${activeKey.key}` },
    body: JSON.stringify(body),
    signal,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    let errMsg = `HTTP ${resp.status}`;
    try { const j = JSON.parse(errText); errMsg = j.error?.message || errMsg; } catch(_) {}
    throw new Error(errMsg);
  }

  return resp;
}

async function requestChatJSON(activeKey, body, signal) {
  const resp = await requestChatCompletion(activeKey, body, signal);
  return resp.json();
}

function applyAssistantMessageData(assistantMsg, data, contentEl) {
  const message = data?.choices?.[0]?.message || {};
  assistantMsg.pendingState = '';
  assistantMsg.content = message.content || '';
  assistantMsg.thinking = message.reasoning_content || message.reasoning || message.thought || '';
  normalizeAssistantMessage(assistantMsg);
  if (data?.usage) assistantMsg.tokens = data.usage;
  contentEl.innerHTML = renderAssistantContentHTML(assistantMsg, false);
  return message;
}

function isToolCallingUnsupportedError(err) {
  const message = String(err?.message || '');
  return (
    /unrecognized request argument.*tools?/i.test(message) ||
    /tool_choice/i.test(message) ||
    (
      /(tools?|functions?|function_call)/i.test(message) &&
      /(unsupported|not supported|does not support|invalid|unknown|unrecognized|not available)/i.test(message)
    )
  );
}

async function callAPI(conv, contentEl, assistantMsg, activeKey) {
  const search = getSearchSettings();
  if (usesAgentSearch(search)) {
    return callAPIWithAgentSearch(conv, contentEl, assistantMsg, activeKey);
  }
  return callAPIWithOptionalSearch(conv, contentEl, assistantMsg, activeKey);
}

async function callAPIWithOptionalSearch(conv, contentEl, assistantMsg, activeKey, options = {}) {
  const currentDateTimeContext = buildCurrentDateTimeContext();
  let search = null;
  if (options.forceSearch) {
    const query = buildSearchQuery(conv);
    if (query) {
      setAssistantPendingState(assistantMsg, contentEl, 'searching');
      search = await searchWebQuery(query, {}, abortController.signal);
    }
  } else {
    search = await maybeSearchWeb(conv, abortController.signal);
  }

  setAssistantSearchRuns(assistantMsg, search ? [{
    query: search.query,
    provider: search.provider,
    results: search.results,
  }] : []);

  await requestFinalAssistantResponse(conv, contentEl, assistantMsg, activeKey, {
    extraSystemMessages: [
      currentDateTimeContext,
      ...(search?.context ? [search.context] : []),
    ],
  });
}

async function callAPIWithAgentSearch(conv, contentEl, assistantMsg, activeKey) {
  const currentDateTimeContext = buildCurrentDateTimeContext();
  const decisionMsgs = buildChatMessages(conv, {
    extraSystemMessages: [currentDateTimeContext, buildSearchAgentInstructions()],
  });
  const tools = buildSearchToolDefinitions();
  const searchRuns = [];

  let data;
  try {
    data = await requestChatJSON(activeKey, buildChatRequestBody(decisionMsgs, {
      stream: false,
      temperature: 0,
      tools,
      toolChoice: 'auto',
    }), abortController.signal);
  } catch (err) {
    if (!searchRuns.length && isToolCallingUnsupportedError(err)) {
      toast('Current model/provider does not support tool calling. Falling back to Always search.');
      return callAPIWithOptionalSearch(conv, contentEl, assistantMsg, activeKey, { forceSearch: true });
    }
    throw err;
  }

  const message = data?.choices?.[0]?.message || {};
  const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls.filter(Boolean) : [];
  if (!toolCalls.length) {
    setAssistantSearchRuns(assistantMsg, []);
    if (!settings.stream) {
      applyAssistantMessageData(assistantMsg, data, contentEl);
      return;
    }
    resetAssistantDraft(assistantMsg, contentEl);
    return requestFinalAssistantResponse(conv, contentEl, assistantMsg, activeKey, {
      extraSystemMessages: [currentDateTimeContext],
    });
  }

  const searchToolCalls = toolCalls.filter(toolCall => toolCall?.function?.name === 'search_web');
  const unsupportedTools = toolCalls.filter(toolCall => toolCall?.function?.name !== 'search_web');
  if (unsupportedTools.length) {
    throw new Error(`Model requested unsupported tool: ${unsupportedTools[0]?.function?.name || 'unknown'}`);
  }

  const limitedToolCalls = searchToolCalls.slice(0, 3);
  if (searchToolCalls.length > limitedToolCalls.length) {
    toast('Model requested many searches. Using the first 3 queries.');
  }

  assistantMsg.content = '';
  assistantMsg.thinking = '';
  assistantMsg.hasThinking = false;
  setAssistantPendingState(assistantMsg, contentEl, 'searching');

  const searchContexts = [];
  for (const toolCall of limitedToolCalls) {
    const executed = await executeSearchToolCall(toolCall, abortController.signal);
    if (executed.search) searchRuns.push(executed.search);
    if (executed.context) searchContexts.push(executed.context);
    setAssistantSearchRuns(assistantMsg, searchRuns);
    updateMsgMeta(contentEl, assistantMsg);
  }

  resetAssistantDraft(assistantMsg, contentEl);
  return requestFinalAssistantResponse(conv, contentEl, assistantMsg, activeKey, {
    extraSystemMessages: [currentDateTimeContext, ...searchContexts],
  });
}

async function requestFinalAssistantResponse(conv, contentEl, assistantMsg, activeKey, options = {}) {
  const msgs = buildChatMessages(conv, {
    extraSystemMessages: options.extraSystemMessages,
  });
  const body = buildChatRequestBody(msgs, {
    stream: settings.stream,
  });
  setAssistantPendingState(assistantMsg, contentEl, 'thinking');
  const resp = await requestChatCompletion(activeKey, body, abortController.signal);
  if (settings.stream) {
    await readStream(resp, contentEl, assistantMsg);
  } else {
    const data = await resp.json();
    applyAssistantMessageData(assistantMsg, data, contentEl);
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
  let cursorActive = false;
  let contentStarted = !!assistantMsg.content;
  let rawContent = assistantMsg.content || '';
  let rawThinking = assistantMsg.thinking || '';

  const syncAssistantMessage = () => {
    const split = splitEmbeddedThinking(rawContent);
    assistantMsg.content = split.content;
    assistantMsg.thinking = mergeThinkingParts(rawThinking, split.thinking);
    assistantMsg.hasThinking = !!assistantMsg.thinking;
    if (assistantMsg.content) contentStarted = true;
  };

  const renderNow = () => {
    lastRenderAt = Date.now();
    contentEl.innerHTML = renderAssistantContentHTML(assistantMsg, thinkingDetailsOpen);
    $('#messages').scrollTop = $('#messages').scrollHeight;
  };

  const ensureStreamingCursor = () => {
    if (cursorActive) return;
    cursorActive = true;
    contentEl.classList.add('streaming-cursor');
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
    if (!assistantMsg.content && !assistantMsg.thinking) assistantMsg.pendingState = '';
    if (renderTimerId) {
      clearTimeout(renderTimerId);
      renderTimerId = null;
    }
    if (cursorActive) {
      contentEl.classList.remove('streaming-cursor');
      cursorActive = false;
    }
    renderNow();
  };

  syncAssistantMessage();

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
          assistantMsg.pendingState = '';
          ensureStreamingCursor();
          rawContent += deltaContent;
          syncAssistantMessage();
          // If we already have thinking content, collapse it as soon as output starts.
          if (contentStarted && assistantMsg.thinking && thinkingDetailsOpen) {
            thinkingDetailsOpen = false;
          }
          requestRender();
        }

        if (typeof deltaThinking === 'string' && deltaThinking) {
          assistantMsg.pendingState = '';
          ensureStreamingCursor();
          rawThinking += deltaThinking;
          syncAssistantMessage();
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

  const assistantMsg = createAssistantDraft();
  conv.messages.push(assistantMsg);
  appendMsgRow(assistantMsg, conv.messages.length - 1);
  const lastRow   = $('#messages').lastElementChild;
  const contentEl = lastRow.querySelector('.msg-content');

  setSendStop(true);
  abortController = new AbortController();
  try {
    await callAPI(conv, contentEl, assistantMsg, activeKey);
  } catch(e) {
    assistantMsg.pendingState = '';
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
  const actionsEl = body.querySelector('.msg-actions');
  const metaHTML = buildAssistantMetaHTML(msg);
  if (!metaHTML) {
    if (metaEl) metaEl.remove();
  } else if (metaEl) {
    metaEl.outerHTML = metaHTML;
  } else {
    actionsEl.insertAdjacentHTML('beforebegin', metaHTML);
  }

  let sourcesEl = body.querySelector('.search-sources');
  const sourcesHTML = buildSearchSourcesHTML(msg);
  if (!sourcesHTML) {
    if (sourcesEl) sourcesEl.remove();
    return;
  }
  if (sourcesEl) {
    sourcesEl.outerHTML = sourcesHTML;
  } else {
    actionsEl.insertAdjacentHTML('beforebegin', sourcesHTML);
  }
}
