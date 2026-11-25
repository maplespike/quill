import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// GitHub Pages demo deploy: set GH_PAGES=true (or PUBLIC_BASE_PATH=/quill/)
// to build under a subpath. Default: root (quill.maplespike.ca / local preview).
const basePath = process.env.PUBLIC_BASE_PATH || (process.env.GH_PAGES === 'true' ? '/quill/' : '/');

// ── No Astro `security.csp` here, deliberately ─────────────────────────────────
// It looks like the answer to 'unsafe-inline': Astro emits a per-build meta CSP
// with SHA-384 hashes of the inline scripts it renders, and a hash outranks
// 'unsafe-inline' in CSP3 browsers. It was enabled on 2026-11-23 and reverted
// within the hour: the audit (packages/portal/e2e/csp-audit.mjs) found 83
// violations across the site, because
//   * `script-src-attr` — inline event handlers (`onclick="…"`) — can never be
//     authorised by a hash, only by 'unsafe-inline' or 'unsafe-hashes';
//   * several `is:inline` blocks in pages (changelog, citation, contact, …) are
//     not in `internals.inlinedScripts`, so they shipped unhashed and blocked.
// The meta policy only ever *tightens*, so the site's own scripts stopped
// running. Removing 'unsafe-inline' for real means deleting those handlers
// first; until that refactor happens, this config must stay as it is. The
// `server-csp` test pins that expectation so it cannot be re-enabled by
// accident, and the audit is what will prove the refactor when it lands.
export default defineConfig({
  output: 'static',
  site: process.env.GH_PAGES === 'true' ? 'https://reverb256.github.io' : 'https://quill.maplespike.ca',
  base: basePath,
  build: { format: 'file' },
  compressHTML: true,
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': new URL('./src', import.meta.url).pathname,
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('/node_modules/react/'))        return 'vendor-react';
            if (id.includes('/node_modules/react-dom/'))    return 'vendor-react';
            if (id.includes('/node_modules/react-router/')) return 'vendor-react';
            if (id.includes('/node_modules/scheduler/'))    return 'vendor-react';
            if (id.includes('/node_modules/framer-motion/'))return 'vendor-framer';
            if (id.includes('/node_modules/lucide-react/')) return 'vendor-icons';
          },
        },
      },
    },
  },
});
