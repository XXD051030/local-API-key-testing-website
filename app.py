#!/usr/bin/env python3
"""
API Tester - Desktop App
========================
Launches the local HTTP backend on a background thread and opens it in a
native window (pywebview). No browser, no manual `python3 server.py`.

Run from source:
    pip install -r requirements.txt
    python3 app.py

Packaged build (PyInstaller): see build.md.
"""

import json
import os
import subprocess
import sys
import threading

import webview

import server

APP_NAME = 'APITester'
WINDOW_TITLE = 'API Tester'


def static_dir():
    """Read-only frontend assets (index.html / style.css / js/)."""
    if getattr(sys, 'frozen', False):
        # PyInstaller unpacks bundled data files here at runtime.
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))


def data_dir():
    """Writable per-user storage for settings.json / conversations.json.

    Uses the OS-standard location so data survives app upgrades/reinstalls
    and never lives inside the read-only app bundle.
    """
    if sys.platform == 'darwin':
        base = os.path.expanduser('~/Library/Application Support')
    elif sys.platform == 'win32':
        base = os.environ.get('APPDATA') or os.path.expanduser('~')
    else:  # Linux / other
        base = os.environ.get('XDG_DATA_HOME') or os.path.expanduser('~/.local/share')
    path = os.path.join(base, APP_NAME)
    os.makedirs(path, exist_ok=True)
    return path


def saved_theme(data_dirpath):
    """Explicit theme choice from settings.json ('dark'/'light'), else None.

    None means the user never picked a theme; the UI then follows the OS via
    prefers-color-scheme.
    """
    try:
        with open(os.path.join(data_dirpath, 'settings.json'), encoding='utf-8') as f:
            theme = json.load(f).get('theme')
    except (OSError, ValueError):
        theme = None
    return theme if theme in ('dark', 'light') else None


def system_prefers_dark():
    """Best-effort OS dark-mode detection, only used to color the native
    window background before the page paints."""
    try:
        if sys.platform == 'darwin':
            out = subprocess.run(
                ['defaults', 'read', '-g', 'AppleInterfaceStyle'],
                capture_output=True, text=True, timeout=2,
            )
            return out.stdout.strip() == 'Dark'
        if sys.platform == 'win32':
            import winreg
            key_path = r'Software\Microsoft\Windows\CurrentVersion\Themes\Personalize'
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path) as key:
                return winreg.QueryValueEx(key, 'AppsUseLightTheme')[0] == 0
    except Exception:
        pass
    return False


def acquire_single_instance_lock(lock_path):
    """Take an exclusive lock; return the open handle, or None if another
    instance already holds it.

    The handle must stay open for the app's lifetime. The OS releases the
    lock when the process exits — even on a crash — so a leftover lock file
    is harmless.
    """
    lock_file = None
    try:
        lock_file = open(lock_path, 'w')
        if sys.platform == 'win32':
            import msvcrt
            msvcrt.locking(lock_file.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        if lock_file:
            lock_file.close()
        return None
    return lock_file


def main():
    data = data_dir()

    # Enforce a single instance: impatient re-launches while the first one is
    # still starting must not spawn extra windows, and two processes would
    # fight over the same settings.json / conversations.json.
    lock = acquire_single_instance_lock(os.path.join(data, 'app.lock'))
    if lock is None:
        return

    # Bind to an OS-assigned free port on loopback only.
    httpd = server.run_server(
        host='127.0.0.1',
        port=0,
        static_dir=static_dir(),
        data_dir=data,
        serve_forever=False,
    )
    port = httpd.server_address[1]

    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()

    # localStorage is origin-scoped and the port changes every launch, so the
    # page cannot know the saved theme before its first paint. Hand it over in
    # the URL; no param means "follow the OS" (prefers-color-scheme).
    theme = saved_theme(data)
    url = f'http://127.0.0.1:{port}'
    if theme:
        url += f'/?theme={theme}'
    dark = theme == 'dark' if theme else system_prefers_dark()

    webview.create_window(
        WINDOW_TITLE,
        url,
        width=1200,
        height=820,
        min_size=(720, 560),
        # Shown while the page loads; must match the theme or startup flashes.
        background_color='#1b1a17' if dark else '#f7f7f4',
    )
    # Blocks until the window is closed; the daemon thread then dies with us.
    webview.start()


if __name__ == '__main__':
    main()
