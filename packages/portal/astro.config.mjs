import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// GitHub Pages demo deploy: set GH_PAGES=true (or PUBLIC_BASE_PATH=/quill/)
// to build under a subpath. Default: root (quill.maplespike.ca / local preview).
const basePath = process.env.PUBLIC_BASE_PATH || (process.env.GH_PAGES === 'true' ? '/quill/' : '/');

export default defineConfig({
  output: 'static',
  site: process.env.GH_PAGES === 'true' ? 'https://reverb256.github.io' : 'https://quill.maplespike.ca',
  base: basePath,
  build: { format: 'file' },
  compressHTML: true,
  integrations: [react()],
  // ── CSP: per-build hashes for inline script ────────────────────────────────
  // The header in public/_headers is static, so it cannot carry content hashes.
  // Astro can: with security.csp it renders a <meta http-equiv="content-security-
  // policy"> into every page listing a SHA-384 digest of each inline script it
  // emitted (internals.inlinedScripts — which is where `is:inline` blocks land).
  // Per the CSP spec a hash takes precedence over 'unsafe-inline' inside the same
  // directive, and two policies intersect, so in CSP3 browsers the effective
  // rule for inline script is "this exact byte sequence", not a blanket grant.
  // The header keeps 'unsafe-inline' only as the CSP2 fallback.
  //
  // Every external host the header allows must ALSO be listed here: intersection
  // means a resource the meta policy omits is blocked even though the header
  // permits it. Missing js.stripe.com here would recreate the outage this file's
  // header fix was for.
  security: {
    csp: {
      algorithm: 'SHA-384',
      scriptDirective: {
        // `resources` REPLACES the default sources, so 'self' must be restated.
        resources: [
          "'self'",
          'https://js.stripe.com',
          'https://static.cloudflareinsights.com',
          'https://plausible.io',
        ],
      },
      styleDirective: {
        // Inline style *attributes* cannot be hashed and this site uses them
        // (Tailwind arbitrary values, Astro scoped props). Style injection is a
        // far smaller risk than script injection; script-src is hash-enforced.
        resources: ["'self'", "'unsafe-inline'"],
      },
      directives: [
        "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
        "connect-src 'self' https://*.maplespike.ca https://*.quill.maplespike.ca https://cloudflareinsights.com https://plausible.io https://api.stripe.com",
        "img-src 'self' data: blob: https://*.stripe.com",
        "font-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
      ],
    },
  },
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
