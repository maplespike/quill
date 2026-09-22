/**
 * Gate B1-KEYREVEAL (#890) — the reveal card itself.
 *
 * The gate's EXPECT is: "portal shows the minted key with a copy affordance +
 * a 'this is the only time' note." `renderToStaticMarkup` renders the real
 * component (no DOM needed, no copy of the markup kept in the test), so these
 * assertions fail if the reveal card stops showing the full key, loses its
 * copy button, loses the one-time warning, or loses the docs link.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

import ApiKeyReveal from "../components/ApiKeyReveal.js";

const KEY = "quill_live_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

function render(lang?: "en" | "fr") {
  return renderToStaticMarkup(<ApiKeyReveal apiKey={KEY} lang={lang} />);
}

/** React escapes entities in text nodes — compare against the plain copy. */
function text(html: string): string {
  return html
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

describe("ApiKeyReveal", () => {
  it("shows the full key — not the truncated form used elsewhere in the portal", () => {
    const html = render("en");
    assert.ok(html.includes(KEY), "the full API key must appear in the reveal");
    assert.ok(
      !html.includes(`${KEY.slice(0, 20)}...`),
      "the reveal must not repeat the account card's truncated slice",
    );
  });

  it("carries a copy affordance and the one-time warning", () => {
    const html = render("en");
    assert.match(html, /data-testid="copy-key"/);
    assert.match(html, /data-testid="one-time-warning"/);
    assert.ok(text(html).includes("This is the only time we show it."));
  });

  it("links the authentication docs", () => {
    assert.match(render("en"), /href="\/docs#authentication"/);
  });

  it("gives a runnable first call against a free endpoint", () => {
    const html = render("en");
    assert.match(html, /data-testid="api-key-curl"/);
    assert.ok(html.includes(`x-api-key: ${KEY}`));
    assert.ok(html.includes("/v1/llms.txt"));
  });
});

describe("ApiKeyReveal (FR)", () => {
  it("renders French copy at parity", () => {
    const html = text(render("fr"));
    assert.ok(html.includes("Enregistrez votre clé API"));
    assert.ok(html.includes("C'est la seule fois que nous l'affichons."));
    assert.ok(html.includes("Copier la clé"));
    assert.ok(html.includes(KEY), "the key is language-independent");
  });

  it("links the French docs page", () => {
    assert.match(render("fr"), /href="\/fr\/docs#authentication"/);
  });
});
