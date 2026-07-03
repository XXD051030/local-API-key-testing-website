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

import os
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

    webview.create_window(
        WINDOW_TITLE,
        f'http://127.0.0.1:{port}',
        width=1200,
        height=820,
        min_size=(720, 560),
    )
    # Blocks until the window is closed; the daemon thread then dies with us.
    webview.start()


if __name__ == '__main__':
    main()
