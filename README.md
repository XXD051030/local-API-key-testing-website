<h1 align="center">local-API-key-testing-website</h1>

<p align="center"><strong>A local API key testing website for multiple AI providers.</strong></p>

<p align="center">
  A simple local web interface and backend for testing API keys across different AI model providers.
</p>

<p align="center">
</p>

<p align="center">English | <a href="./READMECN.md">Chinese</a></p>

## Requirements

* Python 3.x

## Usage

### Windows

1. Open `PowerShell` or `Command Prompt` in the project directory.
2. Start the local server on the default port `8080`:
   ```powershell
   py server.py
   ```
3. Or start it on a custom port, for example `9000`:
   ```powershell
   py server.py 9000
   ```
4. Open your browser and visit `http://localhost:8080`, or `http://localhost:<your-port>` if you used a custom port.
5. To access it from other devices on the same LAN, open `http://<your-local-ip>:8080` or `http://<your-local-ip>:<your-port>`.

### macOS/Linux

1. Open `Terminal` in the project directory.
2. Start the local server on the default port `8080`:
   ```bash
   python3 server.py
   ```
3. Or start it on a custom port, for example `9000`:
   ```bash
   python3 server.py 9000
   ```
4. Open your browser and visit `http://localhost:8080`, or `http://localhost:<your-port>` if you used a custom port.
5. To access it from other devices on the same LAN, open `http://<your-local-ip>:8080` or `http://<your-local-ip>:<your-port>`.

## Live Web Search

The app can now search the web before sending your prompt to the selected chat model.

1. Start the local backend with `python3 server.py` or `py server.py`.
2. Open the app through that backend URL, such as `http://localhost:8080`.
3. In `Settings -> Web Search`, choose either `Brave` or `Tavily`.
4. Expand `Provider API Key`, then save the API key for the currently selected provider.
5. Use the `Web Search` switch next to the model selector to turn live search on or off per chat request.
6. When enabled, the model decides whether to call `search_web`, and the assistant reply will include a compact `Sources` block when search was used.

Notes:

* Live web search requires the local backend; it is not available in browser-only mode.
* Live web search now defaults to `Model decides`, so your current chat model needs OpenAI-compatible tool calling support.
* Only one search provider is active at a time: `Brave` or `Tavily`.
* While the model is deciding whether to search and before the first streamed tokens arrive, the assistant row now shows `Thinking...` immediately instead of staying blank.

## Files Included

* `index.html`: Main page structure and external asset references.
* `style.css`: Extracted frontend styles.
* `js/`: Frontend JavaScript files split by responsibility (`state/keys/storage/conversations/render/api/marked/events`).
* `js/search.js`: Web search settings, provider selection, query preparation, and result normalization.
* `server.py`: The backend script for handling API key testing.

## Current Version

### v2.3.1
- `Web Search` enabled chats now show `Thinking...` immediately when a new assistant reply starts, instead of leaving a blank gap before the first response state appears.
- In `Model decides` mode, the UI now transitions cleanly from `Thinking...` to `Searching the web...` only when the model actually requests live search.
