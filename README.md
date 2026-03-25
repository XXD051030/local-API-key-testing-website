# local-API-key-testing-website
A local API key testing website that supports models from multiple providers.

This project provides a simple, local web interface and backend to test your API keys across various AI model providers.

## Requirements

* Python 3.x

## Usage

1. Open a terminal in the project directory.
2. Start the local server:
   ```bash
   python3 server.py
   ```
3. Open your web browser and navigate to `http://localhost:8080`.
4. To access it from other devices on the same LAN, open `http://<your-local-ip>:8080` on those devices.

## Files Included

* `index.html`: Main page structure and script/style references.
* `style.css`: Extracted frontend styles.
* `js/`: Frontend JavaScript files split by responsibility (`state/storage/keys/conversations/render/api/events`).
* `server.py`: The backend script for handling API key testing.

## Updates
### v1.0.1 23
- Harden frontend rendering: make `marked` code-block rendering compatible across marked versions.
- Security hardening: escape `${` when generating `Copy` button template strings to reduce injection risk.
- UX/stability: add `maxlength` to the message input to avoid huge requests/rendering overhead.
- Improve local server robustness: add CORS headers + JSON error body for forbidden `/file` reads/writes.
- Improve local server robustness: return `400 Invalid JSON` for malformed `/file` payloads.
- Stability: add `timeout=30` to the upstream proxy request to prevent hanging.

### v1.1
- Presets-only model selection: remove the topbar free-text model input; models must be selected from Settings -> Model Presets.
- UI update: move the model selector to sit above the chat input box.
- Remove per-API-key “Default Model” logic: API keys no longer carry a default model; model is global.
- UX: disable the `Send` button until a valid model is selected; improve empty-state guidance.

### v1.2
- Thinking display: when `stream` delta includes `reasoning_content/reasoning/thought`, show a streaming `<details>` "Thinking" section and collapse it when done.
- Stream stability: throttle UI re-render during streaming to avoid bursty/jerky updates.
- Server streaming granularity: reduce proxy chunk size to improve SSE token pacing.
- Model presets UX: when adding a new model in Settings -> Model Presets, prompt to mark it as a thinking-capable model (stored in `settings.thinkingModels`).

### v1.3
- Key-bound models: model selection is now bound to the active API key (chat dropdown only shows models for the selected key).
- Thinking styling: make the "Thinking" area visually distinct with muted colors/borders.
- UI hint: add a small label next to the `key-selector` so users know it controls the active API key.

### v1.3.1
- Thinking collapse fix: when streaming ends, the "Thinking" section now reliably collapses immediately.
- Gentle thinking mark: adding a model in Settings now uses an inline checkbox (no blocking `confirm()` popup).

### v1.3.2
- Test Connection now auto-uses the first model bound to the tested key (no longer depends on the chat model selector).
- Block Test Connection for unsaved (draft) keys with a clear toast guiding the user to save first.
- UI: replace the center empty-state logo with "XXD" branding.

### v1.3.2.1
- Add Key testing: draft keys now include an optional "Initial Model" so you can Test Connection immediately (without filling the chat model).
- Saving draft keys: the optional "Initial Model" is written into that key's bound preset group (and optionally marked as Thinking).
- Stability: `Test Connection` uses a 20-second timeout to avoid the page freezing.

### v1.3.2.2
- Thinking stream consistency: avoid reopening the "Thinking" panel after normal content has started streaming.
- UI stability: prevent mixed/unstable thinking display in later replies of the same conversation.

### v2.0
- Refactor architecture: split the original monolithic `index.html` into dedicated files (`style.css` + `js/*.js`) to improve maintainability.
- Keep behavior unchanged: all existing chat, streaming, key management, presets, and local proxy features remain compatible.
- Clarify script loading order in `index.html` so global dependencies initialize predictably.

### v2.1
- LAN access support: when the app is opened through a local-network IP, it now correctly detects the bundled `server.py` backend instead of falling back to browser-only mode.
- Shared persistence on LAN: IP-based access continues to use `/file` so `settings.json` and `conversations.json` stay stored on the host machine.
- Proxy support on LAN: IP-based access also keeps using `/proxy`, so chat requests still avoid browser CORS issues.
- UX: storage status now shows the active host so it is clearer which server instance the page is using.

### v2.1.1
- Mobile-responsive layout: convert the conversation sidebar into a small-screen drawer so the chat area can use the full viewport width on phones.
- Small-screen usability: reflow the top bar, model selector, input area, and settings sections to avoid clipped controls and cramped text on narrow screens.
- Touch improvements: make message/conversation actions easier to access on touch devices instead of relying on hover-only behavior.
- Mobile viewport polish: add safer dynamic viewport sizing and toast wrapping to reduce content cutoff on phone browsers while keeping the desktop layout unchanged.
