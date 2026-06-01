# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for API Tester desktop app.
# Build:  pyinstaller build.spec   (run on the target OS — no cross-compiling)
# Output: macOS -> dist/APITester.app ; Windows -> dist/APITester.exe

import sys

block_cipher = None

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
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
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

# On macOS wrap the executable in a proper .app bundle.
if sys.platform == 'darwin':
    app = BUNDLE(
        exe,
        name='APITester.app',
        icon='img/icon.icns',
        bundle_identifier='com.apitester.desktop',
        info_plist={
            'NSHighResolutionCapable': True,
            'CFBundleName': 'API Tester',
            'CFBundleDisplayName': 'API Tester',
        },
    )
