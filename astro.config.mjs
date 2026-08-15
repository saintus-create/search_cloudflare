import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  server: {
    host: true,
    allowedHosts: true,
  },
  output: 'server',
  adapter: cloudflare({
    imageService: 'passthrough',
  }),
  vite: {
    plugins: [tailwindcss()],
  },
});
