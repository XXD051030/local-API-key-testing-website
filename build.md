# Building the Desktop App

The app uses **pywebview** (native window) + **PyInstaller** (standalone bundle).
PyInstaller does not cross-compile: build the macOS app on a Mac and the
Windows app on Windows.

## Run from source (no packaging)

```bash
pip install -r requirements.txt
python3 app.py
```

A native window opens; the Python backend runs on a random loopback port.

## macOS — build `.app`

```bash
pip install -r requirements.txt
pyinstaller build.spec
open dist/APITester.app
```

Output: `dist/APITester.app`. Double-click to run; no Python needed on the
target machine.

Note: the app is unsigned, so on first launch macOS Gatekeeper may show
"unidentified developer". Right-click the app → **Open** → **Open** to allow it
(only needed once). Code signing / notarization is out of scope.

## Windows — build `.exe`

```powershell
pip install -r requirements.txt
pyinstaller build.spec
dist\APITester.exe
```

Output: `dist\APITester.exe`. Requires the Edge **WebView2** runtime, which
ships with Windows 10/11 by default. On older systems install it from
Microsoft's "Evergreen WebView2 Runtime" page.

SmartScreen may warn about an unknown publisher on first run → **More info** →
**Run anyway**.

## Where data is stored

User data lives outside the bundle, in the OS-standard per-user location:

- macOS: `~/Library/Application Support/APITester/`
- Windows: `%APPDATA%\APITester\`

This holds `settings.json` and `conversations.json`. It is created on first run
and preserved across app upgrades/reinstalls.

## CLI mode still works

`python3 server.py [port]` is unchanged — serves the app at
`http://localhost:8080` (or the given port) for browser-based / LAN use.
