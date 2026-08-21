#!/usr/bin/env node
/**
 * Rewrite root-absolute internal links in a static Astro build for GitHub Pages.
 *
 * Astro's `base` config rewrites generated asset URLs (/_astro/...) but NOT
 * hardcoded href="/..." / src="/..." strings in .astro source. When the site
 * is served from https://reverb256.github.io/quill/, those root-absolute links
 * 404.
 *
 * This script walks dist/ and prefixes internal root-absolute URLs with the
 * base path (default /quill/). External URLs (https://, //, mailto:, #) and
 * already-prefixed URLs are left alone.
 *
 * Usage: node scripts/gh-pages-rewrite-links.mjs [distDir] [basePath]
 *   distDir  - build output dir (default packages/portal/dist)
 *   basePath - base path (default /quill/)
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const distDir = resolve(process.argv[2] || 'packages/portal/dist');
const basePath = process.argv[3] || '/quill/';

// Only HTML files need link rewriting (JS/CSS asset URLs are handled by Astro base).
const HTML_RE = /\.html?$/i;
const LINK_RE = /(href|src|action|poster)=("|')(\/[^"']*?)("|')/g;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (HTML_RE.test(entry)) out.push(full);
  }
  return out;
}

function rewriteHref(match, attr, quote, url) {
  // Skip: external, protocol-relative, hash-only, already-prefixed
  if (
    url.startsWith('//') ||
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('mailto:') ||
    url.startsWith('tel:') ||
    url.startsWith('data:') ||
    url.startsWith('#') ||
    url.startsWith(basePath)
  ) {
    return match;
  }
  // Skip root URL (it's the site root — should be basePath)
  if (url === '/') return `${attr}=${quote}${basePath}${quote}`;
  return `${attr}=${quote}${basePath.replace(/\/$/, '')}${url}${quote}`;
}

const files = walk(distDir);
let changed = 0;
let totalLinks = 0;

for (const file of files) {
  const original = readFileSync(file, 'utf8');
  const rewritten = original.replace(LINK_RE, rewriteHref);
  const linkCount = (original.match(LINK_RE) || []).length;
  totalLinks += linkCount;
  if (rewritten !== original) {
    writeFileSync(file, rewritten);
    changed++;
  }
}

console.log(`[gh-pages-rewrite] ${files.length} HTML files scanned, ${totalLinks} links found, ${changed} files rewritten (base=${basePath}).`);
