// ── Conversation management ───────────────────────────────────────────────────
import { settings, conversations, activeConvId, setConversations, setActiveConvId } from './state.js';
import { normalizeSearchSettings } from './state.js';
import { $ } from './helpers.js';
import { getSearchSettings } from './search.js';
import { persistSettings, persistConversations } from './storage.js';
import { renderConvList, renderMessages, updateRegenBtn } from './render.js';

export function newConv() {
  const id   = crypto.randomUUID();
  const conv = { id, name: 'New Chat', created: Date.now(), messages: [] };
  conversations.unshift(conv);
  settings.search = normalizeSearchSettings({
    ...getSearchSettings(),
    enabled: false,
  });
  const searchToggle = $('#search-toggle');
  if (searchToggle) searchToggle.checked = false;
  persistSettings();
  persistConversations();
  renderConvList();
  switchConv(id);
}

export function switchConv(id) {
  setActiveConvId(id);
  renderConvList();
  renderMessages();
  updateRegenBtn();
}

export function deleteConv(id) {
  const conv = conversations.find(c => c.id === id) || null;
  const label = conv?.name ? ` "${conv.name}"` : '';
  if (!confirm(`Delete conversation${label}? This cannot be undone.`)) return;
  setConversations(conversations.filter(c => c.id !== id));
  if (activeConvId === id) setActiveConvId(conversations[0]?.id || null);
  persistConversations();
  renderConvList();
  renderMessages();
  updateRegenBtn();
}

export function clearAll() {
  if (!confirm('Delete all conversations? This cannot be undone.')) return;
  setConversations([]);
  setActiveConvId(null);
  persistConversations();
  renderConvList();
  renderMessages();
  updateRegenBtn();
}

export function activeConv() {
  return conversations.find(c => c.id === activeConvId) || null;
}

export function autoNameConv(conv) {
  if (conv.name !== 'New Chat') return;
  const first = conv.messages.find(m => m.role === 'user');
  if (first) conv.name = first.content.slice(0, 42) + (first.content.length > 42 ? '…' : '');
}
