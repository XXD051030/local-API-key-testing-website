# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for API Tester desktop app.
# Build:  pyinstaller build.spec   (run on the target OS — no cross-compiling)
# Output: macOS -> dist/APITester.app ; Windows -> dist/APITester.exe

import sys

# App icon: macOS uses .icns (on the BUNDLE), Windows uses .ico (on the EXE).
icon_file = 'img/icon.icns' if sys.platform == 'darwin' else 'img/icon.ico'

# Bundle the read-only frontend assets next to the app. At runtime app.py reads
# them from sys._MEIPASS. settings.json / conversations.json are intentionally
# NOT bundled — they are written to the per-user data dir.
datas = [
    ('index.html', '.'),
    ('style.css', '.'),
    ('js', 'js'),
]

a = Analysis(
    ['app.py'],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)
pyz = PYZ(a.pure)

if sys.platform == 'darwin':
    # onedir mode. onefile is a bad fit for macOS: every launch re-extracts
    # the whole runtime to a fresh temp dir, so Gatekeeper re-verifies every
    # library each time (~tens of seconds cold start), and until the window
    # finally appears extra Finder clicks spawn extra instances. With onedir
    # nothing is extracted at runtime and the .app hides the folder anyway.
    exe = EXE(
        pyz,
        a.scripts,
        [],
        exclude_binaries=True,
        name='APITester',
        debug=False,
        bootloader_ignore_signals=False,
        strip=False,
        upx=False,  # UPX does not support macOS binaries
        console=False,  # GUI app, no terminal window
        disable_windowed_traceback=False,
        target_arch=None,
        codesign_identity=None,
        entitlements_file=None,
        icon=icon_file,
    )
    coll = COLLECT(
        exe,
        a.binaries,
        a.datas,
        strip=False,
        upx=False,
        name='APITester',
    )
    app = BUNDLE(
        coll,
        name='APITester.app',
        icon='img/icon.icns',
        bundle_identifier='com.apitester.desktop',
        info_plist={
            'NSHighResolutionCapable': True,
            'CFBundleName': 'API Tester',
            'CFBundleDisplayName': 'API Tester',
        },
    )
else:
    # Windows keeps onefile: a single portable APITester.exe is the expected
    # distribution format there. The single-instance lock in app.py covers
    # the double-launch problem on both platforms.
    exe = EXE(
        pyz,
        a.scripts,
        a.binaries,
        a.datas,
        [],
        name='APITester',
        debug=False,
        bootloader_ignore_signals=False,
        strip=False,
        upx=True,
        runtime_tmpdir=None,
        console=False,  # GUI app, no terminal window
        disable_windowed_traceback=False,
        target_arch=None,
        codesign_identity=None,
        entitlements_file=None,
        icon=icon_file,
    )
