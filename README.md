# local-API-key-testing-website
A local API key testing website that supports models from multiple providers.

This project provides a simple, local web interface and backend to test your API keys across various AI model providers.

## Requirements

* Python 3.x

## Usage

1. Open a terminal in the project directory.
2. Start the local server using Python's built-in HTTP server:
   ```bash
   python3 -m http.server 8080
   ```
3. Open your web browser and navigate to `http://localhost:8080` (or the specific port you used).
4. Run the backend server to handle API requests (if `server.py` requires separate execution, start it according to its specific instructions, typically `python3 server.py`).

## Files Included

* `index.html`: The main frontend interface.
* `server.py`: The backend script for handling API key testing.

## Updates
### v1.0.1
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
- Thinking display (Rule A): when `stream` delta includes `reasoning_content/reasoning/thought`, show a streaming `<details>` "Thinking" section and collapse it when done.
- Stream stability: throttle UI re-render during streaming to avoid bursty/jerky updates.
- Server streaming granularity: reduce proxy chunk size to improve SSE token pacing.
- Model presets UX: when adding a new model in Settings -> Model Presets, prompt to mark it as a thinking-capable model (stored in `settings.thinkingModels`).
