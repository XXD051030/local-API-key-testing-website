// ── State ─────────────────────────────────────────────────────────────────────
let settings = {
  activeKeyId: null,
  apiKeys: [],        // [{id, name, baseUrl, key}]
  model: '',
  systemPrompt: '',
  includeTimeContext: true,
  temperature: 0.7,
  maxTokens: '',
  stream: true,
  presets: [],        // Key-bound model groups: [{label, keyId, models: string[]}]
  thinkingModels: [],
  search: {
    enabled: false,
    provider: 'brave',
    tavilyApiKey: '',
    braveApiKey: '',
    maxResults: 5,
  },
};
let conversations = [];
let activeConvId = null;
let abortController = null;
let editingKeyId = null;  // null | 'new' | '<id>'
let useServerStorage = false;

const SETTINGS_FILE = 'settings.json';
const CONV_FILE     = 'conversations.json';

const THINK_OPEN_TAG  = '<think>';
const THINK_CLOSE_TAG = '</think>';
const SEARCH_PROVIDERS = ['brave', 'tavily'];
const DEFAULT_SEARCH_SETTINGS = Object.freeze({
  enabled: false,
  provider: 'brave',
  tavilyApiKey: '',
  braveApiKey: '',
  maxResults: 5,
});

function normalizeSearchSettings(search) {
  const next = {
    ...DEFAULT_SEARCH_SETTINGS,
    ...(search && typeof search === 'object' ? search : {}),
  };
  const parsedMaxResults = parseInt(next.maxResults, 10);
  const provider = String(next.provider || DEFAULT_SEARCH_SETTINGS.provider).toLowerCase();

  next.enabled = !!next.enabled;
  next.tavilyApiKey = String(next.tavilyApiKey || '');
  next.braveApiKey = String(next.braveApiKey || '');
  if (SEARCH_PROVIDERS.includes(provider)) {
    next.provider = provider;
  } else if (provider === 'auto') {
    next.provider = next.braveApiKey || !next.tavilyApiKey ? 'brave' : 'tavily';
  } else {
    next.provider = DEFAULT_SEARCH_SETTINGS.provider;
  }
  next.maxResults = Number.isFinite(parsedMaxResults)
    ? Math.min(8, Math.max(1, parsedMaxResults))
    : DEFAULT_SEARCH_SETTINGS.maxResults;

  return next;
}

function partialTagSuffixLength(text, tag) {
  const source = String(text || '');
  for (let len = Math.min(source.length, tag.length - 1); len > 0; len--) {
    if (source.endsWith(tag.slice(0, len))) return len;
  }
  return 0;
}

function splitEmbeddedThinking(rawContent) {
  const source = String(rawContent || '');
  const trimmedStart = source.trimStart();
  if (!trimmedStart) return { content: source, thinking: '', inThink: false };
  if (!trimmedStart.startsWith(THINK_OPEN_TAG) && !THINK_OPEN_TAG.startsWith(trimmedStart)) {
    return { content: source, thinking: '', inThink: false };
  }

  const sourceToParse = source.slice(source.length - trimmedStart.length);
  let content = '';
  let thinking = '';
  let cursor = 0;
  let inThink = false;

  while (cursor < sourceToParse.length) {
    const rest = sourceToParse.slice(cursor);

    if (inThink) {
      if (rest.startsWith(THINK_CLOSE_TAG)) {
        inThink = false;
        cursor += THINK_CLOSE_TAG.length;
        continue;
      }

      const nextClose = sourceToParse.indexOf(THINK_CLOSE_TAG, cursor);
      if (nextClose === -1) {
        const tail = sourceToParse.slice(cursor);
        const hidden = partialTagSuffixLength(tail, THINK_CLOSE_TAG);
        thinking += tail.slice(0, tail.length - hidden);
        return { content, thinking, inThink: true };
      }

      thinking += sourceToParse.slice(cursor, nextClose);
      cursor = nextClose;
      continue;
    }

    if (rest.startsWith(THINK_OPEN_TAG)) {
      inThink = true;
      cursor += THINK_OPEN_TAG.length;
      continue;
    }

    if (rest.startsWith(THINK_CLOSE_TAG)) {
      cursor += THINK_CLOSE_TAG.length;
      continue;
    }

    const nextOpen = sourceToParse.indexOf(THINK_OPEN_TAG, cursor);
    const nextClose = sourceToParse.indexOf(THINK_CLOSE_TAG, cursor);
    const nextTag =
      nextOpen === -1 ? nextClose :
      nextClose === -1 ? nextOpen :
      Math.min(nextOpen, nextClose);

    if (nextTag === -1) {
      const tail = sourceToParse.slice(cursor);
      const hidden = Math.max(
        partialTagSuffixLength(tail, THINK_OPEN_TAG),
        partialTagSuffixLength(tail, THINK_CLOSE_TAG),
      );
      content += tail.slice(0, tail.length - hidden);
      break;
    }

    content += sourceToParse.slice(cursor, nextTag);
    cursor = nextTag;
  }

  if (thinking && content) content = content.replace(/^\s+/, '');
  return { content, thinking, inThink };
}

function mergeThinkingParts(primaryThinking, embeddedThinking) {
  const primary = String(primaryThinking || '');
  const embedded = String(embeddedThinking || '');
  if (!primary) return embedded;
  if (!embedded) return primary;
  if (primary.trim() === embedded.trim()) return primary;
  return `${primary}${primary.endsWith('\n') ? '\n' : '\n\n'}${embedded}`;
}

function normalizeAssistantMessage(msg) {
  if (!msg || msg.role !== 'assistant') return false;

  const originalContent = String(msg.content || '');
  const originalThinking = String(msg.thinking || '');
  const split = splitEmbeddedThinking(originalContent);
  const mergedThinking = mergeThinkingParts(originalThinking, split.thinking);
  const hasThinking = !!mergedThinking;

  const changed =
    originalContent !== split.content ||
    originalThinking !== mergedThinking ||
    !!msg.hasThinking !== hasThinking;

  msg.content = split.content;
  msg.thinking = mergedThinking;
  msg.hasThinking = hasThinking;

  return changed;
}

function normalizeConversations(list) {
  if (!Array.isArray(list)) return false;

  let changed = false;
  for (const conv of list) {
    if (!conv || !Array.isArray(conv.messages)) continue;
    for (const msg of conv.messages) {
      changed = normalizeAssistantMessage(msg) || changed;
    }
  }

  return changed;
}
