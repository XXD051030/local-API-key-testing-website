// ── Conversation management ───────────────────────────────────────────────────
function newConv() {
  const id   = Date.now().toString();
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

function switchConv(id) {
  activeConvId = id;
  renderConvList();
  renderMessages();
  updateRegenBtn();
}

function deleteConv(id) {
  const conv = conversations.find(c => c.id === id) || null;
  const label = conv?.name ? ` "${conv.name}"` : '';
  if (!confirm(`Delete conversation${label}? This cannot be undone.`)) return;
  conversations = conversations.filter(c => c.id !== id);
  if (activeConvId === id) activeConvId = conversations[0]?.id || null;
  persistConversations();
  renderConvList();
  renderMessages();
  updateRegenBtn();
}

function clearAll() {
  if (!confirm('Delete all conversations? This cannot be undone.')) return;
  conversations = [];
  activeConvId  = null;
  persistConversations();
  renderConvList();
  renderMessages();
  updateRegenBtn();
}

function activeConv() {
  return conversations.find(c => c.id === activeConvId) || null;
}

function autoNameConv(conv) {
  if (conv.name !== 'New Chat') return;
  const first = conv.messages.find(m => m.role === 'user');
  if (first) conv.name = first.content.slice(0, 42) + (first.content.length > 42 ? '…' : '');
}
