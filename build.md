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

The macOS build uses PyInstaller's **onedir** mode: nothing is extracted at
runtime, so the app starts in under a second. (The previous onefile layout
re-extracted the whole runtime to a fresh temp dir on every launch, which
forced macOS to re-verify every library each time — cold starts took 30+
seconds.) `dist/APITester/` is PyInstaller's intermediate folder with the same
contents; ship only the `.app`.

To distribute, zip with `ditto` (preserves symlinks and the code signature —
plain `zip` can break both):

```bash
ditto -c -k --keepParent dist/APITester.app dist/APITester-macOS.zip
```

Note: the app is unsigned, so on first launch macOS Gatekeeper may show
"unidentified developer". Right-click the app → **Open** → **Open** to allow it
(only needed once). Code signing / notarization is out of scope.

If the build ends with `Error while signing the bundle … resource fork, Finder
information, or similar detritus not allowed`, some bundled file carries macOS
extended attributes (e.g. an icon re-saved via Preview, or folders synced by
iCloud). Strip them and re-sign:

```bash
xattr -cr dist/APITester.app
codesign -s - --force --all-architectures --timestamp --deep dist/APITester.app
```

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

## Single instance

On startup the app takes an exclusive lock on `app.lock` in the data dir.
Launching it again while an instance is running — double-clicking twice while
it starts, `open -n`, or re-running the exe — makes the new process exit
immediately, so two instances can never fight over the same data files. The
lock is released by the OS when the process exits (even after a crash); a
leftover `app.lock` file is harmless.

## CLI mode still works

`python3 server.py [port]` is unchanged — serves the app at
`http://localhost:8080` (or the given port) for browser-based / LAN use.
