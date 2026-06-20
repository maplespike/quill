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
  },
});
