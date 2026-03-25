// ── State ─────────────────────────────────────────────────────────────────────
let settings = {
  activeKeyId: null,
  apiKeys: [],        // [{id, name, baseUrl, key}]
  model: '',
  systemPrompt: '',
  temperature: 0.7,
  maxTokens: '',
  stream: true,
  presets: [],        // Key-bound model groups: [{label, keyId, models: string[]}]
  thinkingModels: [],
};
let conversations = [];
let activeConvId = null;
let abortController = null;
let editingKeyId = null;  // null | 'new' | '<id>'
let useServerStorage = false;

const SETTINGS_FILE = 'settings.json';
const CONV_FILE     = 'conversations.json';
