#!/usr/bin/env python3
""""MapleSpike — AI-friendly dev server.

Serves the static portal with:
  - Accept: text/markdown content negotiation
  - /index.md → raw Markdown for any page
  - /llms.txt / /llms-full.txt (standard AI discovery files)
  - x-markdown-tokens header for context window planning
  - SPA-style .md suffix rewriting for docs pages
"""

import os, sys, json, re, html as html_mod
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse

PORT = int(os.environ.get("PORT", "4321"))
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
DOCS_DIR = os.path.join(DIRECTORY, "docs")

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
    except:
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

class MapleSpikeHandler(SimpleHTTPRequestHandler):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)
        p = parsed.path

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
        import sys
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

    def log_message(self, format, *args):
        # Quieter logging
        sys.stderr.write("[portal] %s - %s\n" % (self.client_address[0], format % args))


# ── Main ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", PORT), MapleSpikeHandler)
    print(f"[portal] MapleSpike dev server → http://localhost:{PORT}")
    print(f"[portal] Serving: {DIRECTORY}")
    print(f"[portal] AI-friendly: llms.txt | llms-full.txt | Accept: text/markdown | /page.md")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[portal] Shutting down")
        server.server_close()
