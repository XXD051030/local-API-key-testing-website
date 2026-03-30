// ── Marked setup ──────────────────────────────────────────────────────────────
const mdRenderer = new marked.Renderer();
mdRenderer.code = (...args) => {
  // marked version compatibility: renderer.code signature differs by version
  let code = '';
  let lang = '';
  if (typeof args[0] === 'string') {
    code = args[0] || '';
    lang = args[1] || '';
  } else if (args[0] && typeof args[0] === 'object') {
    // token form: { text, lang, ... }
    code = args[0].text ?? args[0].code ?? '';
    lang = args[0].lang ?? args[0].language ?? '';
  }
  let highlighted;
  try {
    highlighted = lang && hljs.getLanguage(lang)
      ? hljs.highlight(code, { language: lang }).value
      : hljs.highlightAuto(code).value;
  } catch (_) { highlighted = escHtml(code); }
  const langLabel = String(lang || 'text');
  const safeLangClass = langLabel.replace(/[^\w-]/g, '') || 'text';
  const encodedCode = escHtml(encodeDataValue(code));
  return `<div class="code-block">
    <div class="code-header">
      <span>${escHtml(langLabel)}</span>
      <button class="copy-btn code-copy-btn" type="button" data-copy-code="${encodedCode}">Copy</button>
    </div>
    <pre><code class="hljs language-${safeLangClass}">${highlighted}</code></pre>
  </div>`;
};
marked.use({ renderer: mdRenderer, breaks: true, gfm: true });
