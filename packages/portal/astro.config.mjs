import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'static',
  site: 'https://quill.maplespike.ca',
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
