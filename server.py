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
import datetime
from urllib.parse import urlparse, parse_qs, urlencode

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ALLOWED_FILES = {'settings.json', 'conversations.json'}
DEFAULT_SEARCH_MAX_RESULTS = 5
MAX_SEARCH_RESULTS = 8


class SearchError(Exception):
    def __init__(self, message, status=400, provider=None):
        super().__init__(message)
        self.message = message
        self.status = status
        self.provider = provider


def _clamp(value, low, high):
    return max(low, min(high, value))


def _clean_snippet(text, limit=420):
    cleaned = ' '.join(str(text or '').split())
    if len(cleaned) <= limit:
        return cleaned
    return f'{cleaned[:limit - 1].rstrip()}…'


def _source_host(url):
    try:
        return urlparse(url).netloc.replace('www.', '', 1)
    except Exception:
        return str(url or '')


def _provider_label(provider):
    provider = str(provider or '').lower()
    if provider == 'tavily':
        return 'Tavily'
    if provider == 'brave':
        return 'Brave'
    return 'Search'


def _extract_error_message(payload, fallback):
    if isinstance(payload, dict):
        error = payload.get('error')
        if isinstance(error, dict):
            for key in ('message', 'detail', 'code'):
                if error.get(key):
                    return str(error[key])
        if isinstance(error, str) and error:
            return error
        for key in ('detail', 'message', 'error_message', 'type'):
            if payload.get(key):
                return str(payload[key])
    return fallback


def _status_color(code_str):
    try:
        c = int(code_str)
    except (TypeError, ValueError):
        return 90
    if 200 <= c < 300:
        return 32
    if 300 <= c < 400:
        return 36
    if 400 <= c < 500:
        return 33
    return 31


class Handler(http.server.SimpleHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_GET(self):
        self._log_proxy_target = None
        self._log_search_provider = None
        parsed = urlparse(self.path)
        if parsed.path == '/file':
            self._file_read(parse_qs(parsed.query).get('name', [''])[0])
        else:
            super().do_GET()

    def do_POST(self):
        self._log_proxy_target = None
        self._log_search_provider = None
        parsed = urlparse(self.path)
        if parsed.path == '/proxy':
            self._proxy()
        elif parsed.path == '/search':
            self._search()
        elif parsed.path == '/file':
            self._file_write(parse_qs(parsed.query).get('name', [''])[0])
        else:
            self.send_response(404)
            self.end_headers()

    def _send_json(self, status, payload):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self._cors()
        self.end_headers()
        self.wfile.write(json.dumps(payload, ensure_ascii=False).encode('utf-8'))

    def _read_json_request(self):
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length)
        try:
            return json.loads(body or b'{}')
        except json.JSONDecodeError as e:
            raise SearchError(f'Invalid JSON: {str(e)}', status=400)

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

    # ── Web search ─────────────────────────────────────────────────────────────
    def _search(self):
        try:
            data = self._read_json_request()
            provider = str(data.get('provider', 'auto') or 'auto').strip().lower()
            if provider not in ('auto', 'tavily', 'brave'):
                raise SearchError('Unsupported search provider', status=400, provider=provider)

            query = ' '.join(str(data.get('query', '')).split())
            if not query:
                raise SearchError('Search query is required', status=400, provider=provider)

            try:
                max_results = int(data.get('maxResults', DEFAULT_SEARCH_MAX_RESULTS))
            except (TypeError, ValueError):
                max_results = DEFAULT_SEARCH_MAX_RESULTS
            max_results = _clamp(max_results, 1, MAX_SEARCH_RESULTS)

            topic = str(data.get('topic', 'general') or 'general').strip().lower()
            if topic not in ('general', 'news', 'finance'):
                topic = 'general'

            payload = self._run_search(provider, query, max_results, topic, data)
            self._log_search_provider = payload.get('provider') or provider
            self._send_json(200, payload)
        except SearchError as e:
            self._log_search_provider = e.provider or self._log_search_provider
            self._send_json(e.status, {'error': {'message': e.message}})
        except Exception as e:
            self._send_json(500, {'error': {'message': str(e)}})

    def _run_search(self, provider, query, max_results, topic, data):
        tavily_key = str(data.get('tavilyApiKey', '') or '').strip()
        brave_key = str(data.get('braveApiKey', '') or '').strip()

        if provider == 'tavily':
            if not tavily_key:
                raise SearchError('Tavily API key is missing', status=400, provider='tavily')
            candidates = ['tavily']
        elif provider == 'brave':
            if not brave_key:
                raise SearchError('Brave Search API key is missing', status=400, provider='brave')
            candidates = ['brave']
        else:
            candidates = []
            if tavily_key:
                candidates.append('tavily')
            if brave_key:
                candidates.append('brave')
            if not candidates:
                raise SearchError(
                    'Configure a Tavily or Brave API key in Settings before enabling Web Search',
                    status=400,
                    provider='auto',
                )

        errors = []
        for candidate in candidates:
            try:
                if candidate == 'tavily':
                    return self._search_tavily(query, tavily_key, max_results, topic)
                return self._search_brave(query, brave_key, max_results)
            except SearchError as e:
                errors.append(e)
                if provider != 'auto':
                    raise

        if errors:
            detail = ' | '.join(f'{_provider_label(err.provider)}: {err.message}' for err in errors)
            raise SearchError(detail, status=502, provider='auto')

        raise SearchError('No search provider is available', status=500, provider=provider)

    def _search_tavily(self, query, api_key, max_results, topic):
        request_body = {
            'query': query,
            'search_depth': 'basic',
            'topic': topic,
            'max_results': max_results,
            'include_answer': False,
            'include_raw_content': False,
            'include_images': False,
            'include_favicon': False,
        }
        req = urllib.request.Request(
            'https://api.tavily.com/search',
            data=json.dumps(request_body).encode('utf-8'),
            headers={
                'Accept': 'application/json',
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json',
            },
            method='POST',
        )
        data = self._request_json(req, 'tavily')
        results = []
        for item in data.get('results', [])[:max_results]:
            url = str(item.get('url', '') or '').strip()
            if not url:
                continue
            results.append({
                'title': str(item.get('title') or url),
                'url': url,
                'snippet': _clean_snippet(item.get('content') or ''),
                'source': _source_host(url),
            })
        return {
            'provider': 'tavily',
            'query': str(data.get('query') or query),
            'results': results,
        }

    def _search_brave(self, query, api_key, max_results):
        params = urlencode({
            'q': query,
            'count': max_results,
            'extra_snippets': 'true',
            'safesearch': 'moderate',
        })
        req = urllib.request.Request(
            f'https://api.search.brave.com/res/v1/web/search?{params}',
            headers={
                'Accept': 'application/json',
                'X-Subscription-Token': api_key,
            },
            method='GET',
        )
        data = self._request_json(req, 'brave')
        results = []
        for item in data.get('web', {}).get('results', [])[:max_results]:
            url = str(item.get('url', '') or '').strip()
            if not url:
                continue
            parts = [str(item.get('description') or '').strip()]
            extra = item.get('extra_snippets')
            if isinstance(extra, list):
                parts.extend(str(piece or '').strip() for piece in extra if str(piece or '').strip())
            results.append({
                'title': str(item.get('title') or url),
                'url': url,
                'snippet': _clean_snippet(' '.join(part for part in parts if part)),
                'source': _source_host(url),
            })
        return {
            'provider': 'brave',
            'query': str(data.get('query', {}).get('original') or query),
            'results': results,
        }

    def _request_json(self, req, provider):
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                charset = resp.headers.get_content_charset('utf-8')
                raw = resp.read().decode(charset, errors='replace')
                return json.loads(raw or '{}')
        except urllib.error.HTTPError as e:
            raw = e.read().decode('utf-8', errors='replace')
            payload = {}
            if raw:
                try:
                    payload = json.loads(raw)
                except json.JSONDecodeError:
                    payload = {}
            message = _extract_error_message(payload, f'{_provider_label(provider)} search failed (HTTP {e.code})')
            raise SearchError(message, status=e.code, provider=provider)
        except urllib.error.URLError as e:
            raise SearchError(f'{_provider_label(provider)} search failed: {e.reason}', status=502, provider=provider)
        except json.JSONDecodeError:
            raise SearchError(f'{_provider_label(provider)} returned invalid JSON', status=502, provider=provider)

    # ── API proxy ──────────────────────────────────────────────────────────────
    def _proxy(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
            data = json.loads(self.rfile.read(length))
            target_url = data.get('url', '')
            try:
                netloc = urlparse(target_url).netloc
                self._log_proxy_target = netloc or target_url or '?'
            except Exception:
                self._log_proxy_target = '?'

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
                    chunk = resp.read(512)
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
        if not args:
            return
        requestline = args[0]
        code_str = args[1] if len(args) > 1 else '-'
        parts = requestline.split()
        if len(parts) < 2:
            return
        method, req_path = parts[0], parts[1]
        if '/proxy' not in req_path and '/file' not in req_path and '/search' not in req_path:
            return
        ts = datetime.datetime.now().strftime('%H:%M:%S')
        if req_path.startswith('/proxy'):
            label = 'PROXY'
            detail = getattr(self, '_log_proxy_target', None) or '?'
            detail = f'→ {detail}'
        elif req_path.startswith('/search'):
            label = 'SEARCH'
            detail = getattr(self, '_log_search_provider', None) or '?'
        else:
            parsed = urlparse(req_path)
            name = parse_qs(parsed.query).get('name', [''])[0] or '?'
            label = 'SAVE' if method == 'POST' else 'READ'
            detail = name
        use_color = sys.stdout.isatty()
        if use_color:
            code_out = f'\033[{_status_color(code_str)}m{code_str}\033[0m'
        else:
            code_out = code_str
        print(f'  {ts}  {code_out}  {label:5}  {detail}')


if __name__ == '__main__':
    os.chdir(BASE_DIR)
    print(f'\n  API Tester running at http://localhost:{PORT}')
    print(f'  Files stored in: {BASE_DIR}')
    print(f'  Press Ctrl+C to stop\n')
    with http.server.HTTPServer(('', PORT), Handler) as httpd:
        httpd.serve_forever()
