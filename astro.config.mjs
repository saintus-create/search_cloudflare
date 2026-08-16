import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  server: {
    host: true,
    allowedHosts: true,
  },
  output: 'server',
  // The application does not use Astro sessions. Explicit opt-out prevents the
  // Cloudflare adapter from provisioning or colliding a SESSION KV namespace.
  session: false,
  adapter: cloudflare({
    imageService: 'passthrough',
    remoteBindings: false,
  }),
  vite: {
    plugins: [tailwindcss()],
  },
});
