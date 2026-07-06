import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'static',
  site: process.env.MAPLESPIKE_DOMAIN
    ? `https://${process.env.MAPLESPIKE_DOMAIN}`
    : 'https://maplespike.lan',
  build: { format: 'file' },
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': new URL('./src', import.meta.url).pathname,
      },
    },
    // 2026-07-06: added vendor-react/framer/lucide chunk splits. Without
    // this, every React island inlines its own copy of `react` / `react-dom`,
    // producing `useContext(...) is null` errors under React 19 + StrictMode
    // (two React instances on the same page, each island's
    // ReactCurrentDispatcher only sees its own Provider). Function-form
    // `manualChunks(id)` matches Vite/Rollup's resolved `.pnpm/` paths under
    // PNPM; the object-form alternative silently falls through. Mirrors the
    // maplespike-brand astro.config.mjs setup that powers maplespike.ca.
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
