#!/usr/bin/env python3
""""MapleSpike — AI-friendly dev server.

Serves the static portal with:
  - Accept: text/markdown content negotiation
  - /index.md → raw Markdown for any page
  - /llms.txt / /llms-full.txt (standard AI discovery files)
  - x-markdown-tokens header for context window planning
  - SPA-style .md suffix rewriting for docs pages
"""

import os, sys, json, re
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse
import http.client

# Upstream API for the /api/ reverse proxy. The portal frontend now talks to
# the same origin, and this server forwards those requests to the real API.
API_UPSTREAM = os.environ.get("API_UPSTREAM", "http://localhost:8082")

# Reject request/response bodies larger than this to avoid memory exhaustion.
MAX_BODY_BYTES = int(os.environ.get("PROXY_MAX_BODY_BYTES", "1048576"))

# HSTS value — single source of truth, used by both static and API responses.
HSTS_VALUE = "max-age=63072000; includeSubDomains; preload"

PORT = int(os.environ.get("PORT", "4321"))
# Resolve the static-site root. Two layouts are supported:
#   1. Production: Dockerfile.portal copies `dist/` contents + server.py into
#      /app/, so server.py's directory contains the rendered .html files. The
#      source-tree marker `src/` is absent.
#   2. Source tree: server.py at packages/portal/server.py alongside `src/`,
#      `public/`, and a sibling `dist/` with the built .html files we
#      actually want to serve.
# Discriminate by the presence of `src/` (a layout marker that only exists
# in the source tree), and override via PORTAL_STATIC_DIR when set.

def _pick_static_dir(override: str, here: str) -> str:
    if override and os.path.isdir(override):
        return override
    # Source-tree marker: presence of `src/` indicates we are running against
    # the unreleased workspace (server.py's checkout) and should serve the
    # built sibling `dist/`. Production copies never include `src/`.
    if os.path.isdir(os.path.join(here, "src")):
        sibling_dist = os.path.join(here, "dist")
        if os.path.isdir(sibling_dist):
            return sibling_dist
    return here

DIRECTORY = _pick_static_dir(
    os.environ.get("PORTAL_STATIC_DIR") or "",
    os.path.dirname(os.path.abspath(__file__)),
)
DOCS_DIR = os.path.join(DIRECTORY, "docs")
print(f"[portal] serving static from {DIRECTORY}", file=sys.stderr)

# ── Markdown conversion helpers ─────────────────────────────────────

def html_to_md(html_path, full_path):
    """Quick HTML→Markdown extraction for docs-style pages."""
    import html.parser

    class MDExtractor(html.parser.HTMLParser):
        def __init__(self):
            super().__init__()
            self.lines = []
            self.in_code = False
            self.code_lang = ""
            self.code_buf = []
            self.in_skip = False
            self.skip_tags = {"nav", "footer", "aside", "script", "style"}
            self.tag_stack = []

        def handle_starttag(self, tag, attrs):
            tag = tag.lower()
            self.tag_stack.append(tag)
            if tag in self.skip_tags:
                self.in_skip = True
            if tag == "code" and not self.in_code:
                # Check parent for pre
                pass
            if tag == "div" and ("code-block", "") in attrs or any(
                v and "code-block" in v for k, v in attrs
            ):
                self.in_code = True
                self.code_lang = ""
                self.code_buf = []
            if tag == "pre":
                self.in_code = True
                self.code_lang = ""
                self.code_buf = []

        def handle_endtag(self, tag):
            tag = tag.lower()
            if self.tag_stack and self.tag_stack[-1] == tag:
                self.tag_stack.pop()
            if tag in self.skip_tags and self.in_skip:
                self.in_skip = False
            if tag in ("div", "pre") and self.in_code and self.code_buf:
                code = "".join(self.code_buf)
                lang = self.code_lang or ""
                self.lines.append(f"```{lang}\n{code}\n```")
                self.in_code = False
                self.code_buf = []

        def handle_data(self, data):
            if self.in_skip:
                return
            if self.in_code:
                self.code_buf.append(data)
            else:
                text = data.strip()
                if text:
                    # Determine heading level from parent tags
                    h_match = re.search(r'h(\d)', str(self.tag_stack))
                    if h_match:
                        level = int(h_match.group(1))
                        self.lines.append(f"{'#' * level} {text}")
                    elif self.tag_stack and self.tag_stack[-1] in ("li",):
                        self.lines.append(f"- {text}")
                    elif self.tag_stack and self.tag_stack[-1] in ("th", "td"):
                        self.lines.append(f"| {text} |")
                    else:
                        self.lines.append(text)

    extractor = MDExtractor()
    try:
        with open(full_path) as f:
            extractor.feed(f.read())
    except Exception:
        return None

    # Post-process: clean up
    md = "\n".join(extractor.lines)
    md = re.sub(r'\n{3,}', '\n\n', md)
    return md.strip()


def make_md_fallback(path):
    """Generate minimal Markdown from path for pages we can't parse."""
    name = os.path.splitext(os.path.basename(path))[0].replace("-", " ").title()
    return f"# {name}\n\nDocumentation page. See the [MapleSpike docs](/) for full content."


# ── Custom handler ──────────────────────────────────────────────────

class QuillHandler(SimpleHTTPRequestHandler):

    # Security headers (migrated from Cloudflare Pages _headers file)
    SECURITY_HEADERS = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Strict-Transport-Security": HSTS_VALUE,
        "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
    }

    # CANONICAL POLICY. This string, public/_headers and nginx.conf are three
    # copies for three servers, and tests/server-csp.test.ts asserts they carry
    # exactly the same directives with the same sources. Do not edit one copy:
    # edit all three, or the test fails. Drift here is not cosmetic — the copy
    # Cloudflare Pages actually serves was missing https://js.stripe.com and
    # frame-src, and the payment form could not load for any visitor.
    #
    # Notes on the deliberate choices:
    #   'unsafe-inline' and 'unsafe-eval' in script-src  both are measured, not
    #     inherited. 'unsafe-inline' because pages carry inline event handlers
    #     (script-src-attr), which no hash can authorise. 'unsafe-eval' because
    #     /api-reference loads Scalar, which calls new Function — the only eval
    #     user the 2026-11-23 audit found. data: was removed that day and nothing
    #     needed it. Attempting Astro's security.csp instead broke 83 inline
    #     scripts/handlers site-wide and was reverted within the hour; the way out
    #     is deleting the handlers and replacing Scalar, which e2e/csp-audit.mjs
    #     will confirm when it lands.
    #   object-src 'none'        no plugins, ever — cheap and removes a whole class.
    #   base-uri 'self'          stops <base> injection rewriting every relative URL.
    #   frame-ancestors 'none'   quoted keyword: a bare `none` is an invalid source
    #     expression and the directive is discarded.
    #   frame-src                the Stripe payment form is an iframe; without this
    #     directive it falls back to default-src 'self' and never renders.
    CSP = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com https://plausible.io https://js.stripe.com; "
        "style-src 'self' 'unsafe-inline'; "
        "font-src 'self'; "
        "img-src 'self' data: blob: https://*.stripe.com; "
        "connect-src 'self' https://*.maplespike.ca https://*.quill.maplespike.ca https://cloudflareinsights.com https://plausible.io https://api.stripe.com; "
        "frame-src 'self' https://js.stripe.com https://hooks.stripe.com; "
        "media-src 'self' data: blob:; worker-src 'self' blob:; "
        "object-src 'none'; base-uri 'self'; form-action 'self'; "
        "frame-ancestors 'none'; upgrade-insecure-requests"
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    # ── API reverse proxy ───────────────────────────────────────────────

    def _proxy_api(self):
        """Forward a request whose path starts with /api/ to the upstream API."""
        # Handle CORS preflight locally. Since the frontend calls the same
        # origin this should rarely be needed, but ad blockers / strict
        # privacy browsers may still issue preflights for some requests.
        if self.command == "OPTIONS":
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
            self.send_header("Access-Control-Max-Age", "86400")
            self.send_header("Content-Length", "0")
            SimpleHTTPRequestHandler.end_headers(self)
            return

        parsed_upstream = urlparse(API_UPSTREAM)
        host = parsed_upstream.hostname or "localhost"
        port = parsed_upstream.port or (443 if parsed_upstream.scheme == "https" else 80)
        is_https = parsed_upstream.scheme == "https"

        # Strip the /api prefix so /api/v1/health becomes /v1/health
        target = self.path[len("/api"):] if self.path.startswith("/api") else self.path
        if not target.startswith("/"):
            target = "/" + target

        # Read request body if present (bounded to prevent memory exhaustion)
        content_length = self.headers.get("Content-Length")
        transfer_encoding = self.headers.get("Transfer-Encoding", "")
        body = None
        if content_length:
            try:
                length = int(content_length)
                if length > MAX_BODY_BYTES:
                    err = json.dumps({"error": "Payload Too Large"}).encode("utf-8")
                    self.send_response(413)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Content-Length", str(len(err)))
                    SimpleHTTPRequestHandler.end_headers(self)
                    self.wfile.write(err)
                    return
                body = self.rfile.read(length)
            except ValueError:
                body = None
        elif "chunked" in transfer_encoding.lower():
            # http.server does not decode chunked bodies; reject rather than
            # forwarding an empty/mis-framed body.
            err = json.dumps({"error": "Length Required"}).encode("utf-8")
            self.send_response(411)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(err)))
            SimpleHTTPRequestHandler.end_headers(self)
            self.wfile.write(err)
            return

        # Filter hop-by-hop headers and add forwarding headers
        hop_by_hop = {
            "connection", "keep-alive", "proxy-authenticate",
            "proxy-authorization", "te", "trailers", "transfer-encoding",
            "upgrade", "host",
        }
        headers = {}
        for key, value in self.headers.items():
            if key.lower() not in hop_by_hop:
                headers[key] = value
        # Append to existing X-Forwarded-For chain rather than overwriting it.
        existing_xff = self.headers.get("X-Forwarded-For")
        headers["X-Forwarded-For"] = f"{existing_xff}, {self.client_address[0]}" if existing_xff else self.client_address[0]
        # Default to https since all production traffic comes through the
        # tunnel which terminates TLS. This prevents the upstream API from
        # issuing a 307 redirect to HTTPS, which the portal proxy is not
        # designed to follow.
        headers["X-Forwarded-Proto"] = "https"
        headers["X-Forwarded-Host"] = self.headers.get("Host", host)

        conn = None
        try:
            ConnClass = http.client.HTTPSConnection if is_https else http.client.HTTPConnection
            conn = ConnClass(host, port, timeout=30)
            conn.request(self.command, target, body=body, headers=headers)
            resp = conn.getresponse()

            self.send_response(resp.status)
            # http.client decodes chunked bodies, so drop hop-by-hop headers
            # (including Transfer-Encoding) to avoid framing mismatches.
            for key, value in resp.getheaders():
                if key.lower() not in hop_by_hop:
                    self.send_header(key, value)
            # Keep baseline security headers on API responses without injecting
            # the static-site CSP. Only send HSTS when the request is actually
            # served over HTTPS (as signaled by the ingress/TLS terminator).
            if self.headers.get("X-Forwarded-Proto") == "https":
                self.send_header("Strict-Transport-Security", HSTS_VALUE)
            self.send_header("X-Content-Type-Options", "nosniff")
            # The upstream may have sent chunked data; http.client decodes it.
            # Tell the client to close the connection so the streamed body end
            # is unambiguous when we don't have a Content-Length.
            self.send_header("Connection", "close")
            # Use the base end_headers so we don't inject the static-site CSP
            # headers into API responses.
            SimpleHTTPRequestHandler.end_headers(self)
            # Stream the response body so SSE / LLM token streams work.
            # read1() avoids blocking until the full 8KB buffer is filled.
            read_fn = getattr(resp, "read1", resp.read)
            while True:
                chunk = read_fn(8192)
                if not chunk:
                    break
                self.wfile.write(chunk)
        except Exception as e:
            print(f"[portal] API proxy error: {e}", file=sys.stderr)
            err = json.dumps({"error": "Bad Gateway", "message": str(e)}).encode("utf-8")
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(err)))
            # Avoid injecting the static-site CSP on the 502 error response.
            SimpleHTTPRequestHandler.end_headers(self)
            self.wfile.write(err)
        finally:
            if conn is not None:
                try:
                    conn.close()
                except Exception:
                    pass

    # Methods the portal itself serves. Everything else is a client error on a
    # non-/api path, not a handler crash: Python's http.server implements no
    # do_POST/do_PUT/do_PATCH/do_DELETE, so calling the superclass method raised
    # AttributeError, dropped the socket with no response, and cloudflared
    # rendered it as a 502 (measured 2026-10-24 on quill.maplespike.ca).
    ALLOWED_METHODS = "GET, HEAD, OPTIONS"

    def _method_not_allowed(self):
        """Answer an unsupported method with 405 JSON instead of dying."""
        path = urlparse(self.path).path
        payload = json.dumps({
            "error": "METHOD_NOT_ALLOWED",
            "message": f"{self.command} is not supported on {path}",
            "allow": self.ALLOWED_METHODS,
        }).encode("utf-8")
        self.send_response(405)
        self.send_header("Allow", self.ALLOWED_METHODS)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        # Base end_headers: a JSON error must not carry the static-site CSP.
        SimpleHTTPRequestHandler.end_headers(self)
        self.wfile.write(payload)

    def do_POST(self):
        if self.path.startswith("/api/"):
            self._proxy_api()
        else:
            self._method_not_allowed()

    def do_PUT(self):
        if self.path.startswith("/api/"):
            self._proxy_api()
        else:
            self._method_not_allowed()

    def do_PATCH(self):
        if self.path.startswith("/api/"):
            self._proxy_api()
        else:
            self._method_not_allowed()

    def do_DELETE(self):
        if self.path.startswith("/api/"):
            self._proxy_api()
        else:
            self._method_not_allowed()

    def do_OPTIONS(self):
        if self.path.startswith("/api/"):
            self._proxy_api()
        else:
            # Answer the preflight instead of calling a parent method that does
            # not exist (the same AttributeError bug as do_POST below).
            self.send_response(204)
            self.send_header("Allow", self.ALLOWED_METHODS)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", self.ALLOWED_METHODS)
            self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
            self.send_header("Content-Length", "0")
            SimpleHTTPRequestHandler.end_headers(self)

    def do_HEAD(self):
        if self.path.startswith("/api/"):
            self._proxy_api()
        else:
            super().do_HEAD()

    def end_headers(self):
        # Inject security headers on every response. Only send HSTS when the
        # request is actually served over HTTPS (as signaled by the
        # ingress/TLS terminator) to avoid pinning plain-HTTP dev instances.
        is_https = self.headers.get("X-Forwarded-Proto") == "https"
        for k, v in self.SECURITY_HEADERS.items():
            if k == "Strict-Transport-Security" and not is_https:
                continue
            self.send_header(k, v)
        self.send_header("Content-Security-Policy", self.CSP)
        # Force no-cache on HTML pages so Cloudflare edge re-fetches from origin
        if self.path.endswith(".html") or self.path == "/" or not os.path.splitext(self.path)[1]:
            self.send_header("Cache-Control", "private, no-cache, no-store, must-revalidate, max-age=0, stale-while-revalidate=0, stale-if-error=0")
            self.send_header("Vary", "*")
            self.send_header("Expires", "Thu, 01 Jan 1970 00:00:00 GMT")
            self.send_header("Last-Modified", self.date_time_string())
            self.send_header("Pragma", "no-cache")
        elif self.path.startswith("/.well-known/"):
            # Discovery documents (MCP server cards, SEP-2127): CORS for
            # browser-based clients and a modest cache window for CDNs.
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Cache-Control", "public, max-age=3600")
        else:
            # Static assets (js/css/svg/fonts) must revalidate too: without a
            # Cache-Control header browsers heuristically cache by Last-Modified
            # and keep serving a stale bundle after a rebuild (seen live: old
            # script.js running long after dist/ was regenerated). `no-cache`
            # still lets the browser use a 304 when nothing changed.
            self.send_header("Cache-Control", "no-cache, must-revalidate")
        super().end_headers()

    def do_GET(self):
        if self.path.startswith("/api/"):
            return self._proxy_api()

        parsed = urlparse(self.path)
        p = parsed.path

        # ── Runtime Stripe publishable key ─────────────────────────
        # The key is public by design (it ships in the client bundle), but it is
        # an environment fact, not a code fact. Baking it in at build time meant
        # an image built without PUBLIC_STRIPE_PUBLISHABLE_KEY rendered
        # "Checkout is not configured for this build" until someone rebuilt it.
        # Serve /config.js with whatever the deployment supplies instead.
        if p == "/config.js":
            self._serve_config_js()
            return

        # ── Self-hosted analytics summary endpoint ────────
        if p == "/analytics" or p == "/analytics/":
            self._serve_analytics()
            return

        # ── Self-hosted analytics (privacy-respecting) ─────
        if p.endswith(".html") or p == "/" or not os.path.splitext(p)[1]:
            self._log_pageview(p)

        # ── Serve docs under /docs/ ────────────────────────
        if p.startswith("/docs/") or p == "/docs":
            rel = p.removeprefix("/docs/")
            if not rel:
                rel = "index.html"
            docs_path = os.path.join(DOCS_DIR, rel)
            if os.path.isdir(docs_path):
                docs_path = os.path.join(docs_path, "index.html")
            if os.path.isfile(docs_path):
                ext = os.path.splitext(docs_path)[1]
                ct = {"": "text/html", ".html": "text/html", ".css": "text/css",
                      ".js": "application/javascript", ".svg": "image/svg+xml",
                      ".png": "image/png", ".ico": "image/x-icon",
                      ".json": "application/json", ".woff2": "font/woff2"}.get(ext, "text/plain")
                with open(docs_path, "rb") as f:
                    body = f.read()
                self.send_response(200)
                self.send_header("Content-Type", ct)
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return

        # ── Extensionless URL rewriting ────────────────────────
        # Astro generates .html files but routes are extensionless (/dashboard/owasp → owasp.html)
        # ── Trailing-slash normalization ────────────────────────
        # Astro emits `<page>.html` (build.format='file'). A trailing-slash
        # variant like `/fr/` would otherwise fall through to
        # SimpleHTTPRequestHandler, which tries to serve a non-existent
        # directory `/app/fr/`. Strip the slash so the extensionless lookup
        # below resolves /app/fr.html. Length > 1 guards the root path.
        # (Sits BEFORE the extensionless rewrite so the rewrite sees the
        # stripped form.)
        if len(p) > 1 and p.endswith("/"):
            p = p[:-1]

        # Cheap process check for the chart probes. Do not read the homepage:
        # liveness must stay fast and must not depend on a built page.
        if p == "/health":
            body = b'{"status":"ok"}\n'
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
            return

        # ── Extensionless URL rewriting ────────────────────────
        # Astro generates .html files but routes are extensionless (/dashboard/owasp → owasp.html)
        if not os.path.splitext(p)[1] and not p.endswith("/"):
            html_path = p.lstrip("/") + ".html"
            full_html = os.path.join(DIRECTORY, html_path)
            if os.path.isfile(full_html):
                with open(full_html, "rb") as f:
                    body = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return

        # ── Serve portal pages ───────────────────────────────────────
        path = p

        # ── Rewrite /index.md or /page-name.md ──
        if path.endswith(".md"):
            md_path = path[:-3]  # strip .md
            if md_path in ("", "/index", "/"):
                md_path = "/index"
            html_candidate = md_path + ".html"
            full_path = os.path.join(DIRECTORY, html_candidate.lstrip("/"))

            if os.path.exists(full_path):
                md_content = html_to_md(html_candidate, full_path)
                if md_content:
                    tokens = len(md_content.split())
                    body = md_content.encode("utf-8")
                    self.send_response(200)
                    self.send_header("Content-Type", "text/markdown; charset=utf-8")
                    self.send_header("x-markdown-tokens", str(tokens))
                    self.send_header("Access-Control-Allow-Origin", "*")
                    self.send_header("Content-Length", str(len(body)))
                    self.end_headers()
                    self.wfile.write(body)
                    return

            # ── Debug log for content negotiation ──
        accept = self.headers.get("Accept", "")
        dbg = f"[AI] path={path} accept={accept!r}"

        # ── Content negotiation: Accept: text/markdown ──
        is_ai_request = "text/markdown" in accept or "text/plain" in accept
        dbg += f" | is_ai={is_ai_request}"

        # Content negotiation: Accept-Language for bilingual support
        accept_lang = self.headers.get("Accept-Language", "")
        is_french = "fr" in accept_lang and "en" not in accept_lang[:accept_lang.find("fr")]
        dbg += f" | lang={'fr' if is_french else 'en'}"

        if is_ai_request and not path.endswith((".txt", ".json", ".png", ".css", ".js", ".ico", ".svg")):
            # Try exact path, path + .html, or index.html for root
            candidates = []
            p = path.rstrip("/")
            if p == "" or p == "/":
                candidates = ["index.html"]
            else:
                base = p.lstrip("/")
                candidates = [base, base + ".html", "index.html"]

            for c in candidates:
                full_path = os.path.join(DIRECTORY, c)
                dbg += f" | trying={c}"
                if os.path.isfile(full_path):
                    dbg += " FOUND"
                    try:
                        with open(full_path) as f:
                            content = f.read()
                        # Quick strip-tags to Markdown-like output
                        import html.parser as hp

                        class Cleaner(hp.HTMLParser):
                            def __init__(self):
                                super().__init__()
                                self.out = []
                                self.skip = {"nav","footer","script","style","aside"}
                                self.in_skip = False
                                self.in_code = False
                                self.code_buf = []
                            def handle_starttag(self, tag, attrs):
                                if tag in self.skip: self.in_skip = True
                                if tag == "pre": self.in_code = True; self.code_buf = []
                            def handle_endtag(self, tag):
                                if tag in self.skip: self.in_skip = False
                                if tag == "pre" and self.in_code:
                                    code = "".join(self.code_buf)
                                    if code.strip(): self.out.append(f"```\n{code.strip()}\n```")
                                    self.in_code = False; self.code_buf = []
                            def handle_data(self, data):
                                if self.in_skip: return
                                if self.in_code: self.code_buf.append(data)
                                elif data.strip(): self.out.append(data.strip())

                        c2 = Cleaner(); c2.feed(content); c2.close()
                        md = "\n\n".join(c2.out)
                        if len(md) > 50:
                            tokens = len(md.split())
                            body = md.encode("utf-8")
                            self.send_response(200)
                            self.send_header("Content-Type", "text/markdown; charset=utf-8")
                            self.send_header("x-markdown-tokens", str(tokens))
                            self.send_header("Access-Control-Allow-Origin", "*")
                            self.send_header("Content-Length", str(len(body)))
                            self.end_headers()
                            self.wfile.write(body)
                            dbg += " ✓ SERVED"
                            return
                    except Exception as e:
                        dbg += f" ✗ EXCEPTION={e}"

        dbg += " → fallthrough"
        print(dbg, file=sys.stderr)
        return super().do_GET()

    def _serve_config_js(self):
        """Serve config.js, appending the runtime publishable key when set."""
        cfg_path = os.path.join(DIRECTORY, "config.js")
        try:
            with open(cfg_path, "r", encoding="utf-8") as f:
                body = f.read()
        except OSError:
            body = "window.MAPLESPIKE = window.MAPLESPIKE || {};\n"
        publishable = os.environ.get("STRIPE_PUBLISHABLE_KEY", "").strip()
        if publishable:
            # json.dumps keeps the value a valid JS string literal whatever it
            # contains. Empty env leaves the built file untouched, so the
            # build-time PUBLIC_STRIPE_PUBLISHABLE_KEY path still works.
            body += (
                "\n// injected at runtime by server.py from STRIPE_PUBLISHABLE_KEY\n"
                f"window.MAPLESPIKE.stripePublishableKey = {json.dumps(publishable)};\n"
            )
        payload = body.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/javascript; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _serve_analytics(self):
        # Serve aggregated page-view counts from access-log.jsonl
        try:
            import json, collections, os
            log_path = os.path.join(DIRECTORY, "access-log.jsonl")
            counts = collections.Counter()
            total = 0
            if os.path.exists(log_path):
                with open(log_path) as f:
                    for line in f:
                        try:
                            entry = json.loads(line)
                            counts[entry.get("path", "/")] += 1
                            total += 1
                        except Exception:
                            pass
            body = json.dumps({"total_views": total, "pages": dict(counts.most_common(20))}, indent=2).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            SimpleHTTPRequestHandler.end_headers(self)
            self.wfile.write(body)
        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            SimpleHTTPRequestHandler.end_headers(self)
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def log_message(self, format, *args):
        # Access logging: write to stderr (captured by container runtime)
        sys.stderr.write("[portal] %s - %s\n" % (self.client_address[0], format % args))

    def _log_pageview(self, path):
        # Lightweight self-hosted analytics: append a JSON line to the access log
        # file. No cookies, no PII beyond a truncated IP hash. Privacy-respecting.
        try:
            import json, hashlib, datetime, os
            ip_hash = hashlib.sha256(self.client_address[0].encode()).hexdigest()[:12]
            entry = {
                "ts": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "path": path.split("?")[0],
                "ip_hash": ip_hash,
                "ua": self.headers.get("User-Agent", "")[:80],
                "ref": self.headers.get("Referer", "")[:120],
            }
            log_path = os.path.join(DIRECTORY, "access-log.jsonl")
            with open(log_path, "a") as f:
                f.write(json.dumps(entry) + "\n")
        except Exception:
            pass  # never let analytics break a request


# ── Main ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # ThreadingHTTPServer (not HTTPServer): the handler streams /api/ proxy
    # responses and serves SSE, which can occupy the handler for the lifetime of
    # an upstream request. A single-threaded server would then block kubelet's
    # liveness probe (timeout 1s) behind an in-flight stream → 3 timeouts →
    # SIGKILL (exit 137) crash loop, exactly what was observed in prod.
    # ThreadingHTTPServer also sets daemon_threads=True, so stuck upstream
    # connections never block pod shutdown.
    server = ThreadingHTTPServer(("0.0.0.0", PORT), QuillHandler)
    print(f"[portal] MapleSpike dev server → http://localhost:{PORT}")
    print(f"[portal] Serving: {DIRECTORY}")
    print(f"[portal] AI-friendly: llms.txt | llms-full.txt | Accept: text/markdown | /page.md")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[portal] Shutting down")
        server.server_close()
