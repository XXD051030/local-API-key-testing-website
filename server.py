#!/usr/bin/env python3
"""
API Tester - Local Server
=========================
Serves index.html, handles file persistence, and proxies API calls to bypass CORS.

Usage:
    python3 server.py          # starts on port 8080
    python3 server.py 9000     # starts on custom port

Then open: http://localhost:8080
"""

import http.server
import urllib.request
import urllib.error
import json
import os
import sys
from urllib.parse import urlparse, parse_qs

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ALLOWED_FILES = {'settings.json', 'conversations.json'}


class Handler(http.server.SimpleHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == '/file':
            self._file_read(parse_qs(parsed.query).get('name', [''])[0])
        else:
            super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == '/proxy':
            self._proxy()
        elif parsed.path == '/file':
            self._file_write(parse_qs(parsed.query).get('name', [''])[0])
        else:
            self.send_response(404)
            self.end_headers()

    # ── File read ──────────────────────────────────────────────────────────────
    def _file_read(self, name):
        if name not in ALLOWED_FILES:
            self.send_response(403)
            self._cors()
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({'error': {'message': 'Forbidden file'}}).encode())
            return
        filepath = os.path.join(BASE_DIR, name)
        if not os.path.exists(filepath):
            self.send_response(404)
            self._cors()
            self.end_headers()
            return
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self._cors()
        self.end_headers()
        self.wfile.write(content.encode('utf-8'))

    # ── File write ─────────────────────────────────────────────────────────────
    def _file_write(self, name):
        if name not in ALLOWED_FILES:
            self.send_response(403)
            self._cors()
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({'error': {'message': 'Forbidden file'}}).encode())
            return
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length)
        filepath = os.path.join(BASE_DIR, name)
        try:
            data = json.loads(body)
        except json.JSONDecodeError as e:
            self.send_response(400)
            self._cors()
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({'error': {'message': f'Invalid JSON: {str(e)}'}}).encode())
            return
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(json.dumps(data, indent=2, ensure_ascii=False))
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self._cors()
        self.end_headers()
        self.wfile.write(b'{"ok":true}')

    # ── API proxy ──────────────────────────────────────────────────────────────
    def _proxy(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
            data = json.loads(self.rfile.read(length))

            req = urllib.request.Request(
                data['url'],
                data=data.get('bodyStr', '').encode('utf-8') or None,
                headers=data.get('headers', {}),
                method=data.get('method', 'POST'),
            )

            try:
                resp = urllib.request.urlopen(req, timeout=30)
                content_type = resp.headers.get('Content-Type', 'application/json')
                self.send_response(resp.status)
                self.send_header('Content-Type', content_type)
                self.send_header('Cache-Control', 'no-cache')
                self._cors()
                self.end_headers()
                while True:
                    chunk = resp.read(1024)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    self.wfile.flush()

            except urllib.error.HTTPError as e:
                error_body = e.read()
                self.send_response(e.code)
                self.send_header('Content-Type', 'application/json')
                self._cors()
                self.end_headers()
                self.wfile.write(error_body)

        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self._cors()
            self.end_headers()
            self.wfile.write(json.dumps({'error': {'message': str(e)}}).encode())

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    def log_message(self, fmt, *args):
        path = args[0] if args else ''
        if '/proxy' in path or '/file' in path:
            print(f'  {args[1] if len(args) > 1 else ""}  {path}')


if __name__ == '__main__':
    os.chdir(BASE_DIR)
    print(f'\n  API Tester running at http://localhost:{PORT}')
    print(f'  Files stored in: {BASE_DIR}')
    print(f'  Press Ctrl+C to stop\n')
    with http.server.HTTPServer(('', PORT), Handler) as httpd:
        httpd.serve_forever()
