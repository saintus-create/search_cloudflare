/// <reference types="astro/client" />

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {}
}

interface Env {
  DB: D1Database;
  KV: KVNamespace;
  AI: any; // Workers AI
  FIRECRAWL_API_KEY: string;
}
