/// <reference types="astro/client" />
/// <reference types="@astrojs/cloudflare" />

interface CloudflareSearchBindings {
  DB: D1Database;
  RATE_LIMIT: KVNamespace;
  AI?: {
    run(model: string, input: Record<string, unknown>): Promise<unknown>;
  };
  INGEST_TOKEN?: string;
  CHAT_TOKEN?: string;
  INGEST_ALLOWED_HOSTS?: string;
}

interface Env extends CloudflareSearchBindings {}

declare namespace Cloudflare {
  interface Env extends CloudflareSearchBindings {}
}
