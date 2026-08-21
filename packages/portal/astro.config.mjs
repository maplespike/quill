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
