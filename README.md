# Cloudflare Search Portal (Astro)

An Astro SSR search portal using Cloudflare D1/FTS5 for lexical retrieval and Workers AI for evidence-grounded Q&A.

## Current architecture

- **Astro 5 + Cloudflare adapter** for the application and API routes.
- **D1 + FTS5** as the canonical document store and lexical search index.
- **Workers AI** for optional answer synthesis over retrieved source context.
- **Tailwind CSS 3 + DaisyUI** for the current UI.
- URL ingestion is deliberately bounded and validates redirects, schemes, content types, and response size before indexing.

The application currently does **not** use KV or Firecrawl. Those were removed from the runtime path because the application was duplicating document state in KV and the current crawler implementation was using direct fetch rather than the Firecrawl SDK.

## Development

Requirements: Node.js and npm.

```bash
npm install
npm run check
npm run build
npm run dev
```

Local D1 migrations can be applied with Wrangler:

```bash
npx wrangler d1 migrations apply worker_1_db --local
```

Keep secrets such as API keys in `.dev.vars` or Cloudflare secrets. Do not commit them.

## Deployment

The current project retains its Pages deployment command for compatibility with the existing Astro/Cloudflare setup:

```bash
npm run pages:deploy
```

Wrangler configuration is in `wrangler.toml`. The compatibility date is intentionally current and should be reviewed when it is changed again.

## API boundaries

- `src/pages/api/search.ts` performs lexical FTS5 retrieval.
- `src/pages/api/crawl.ts` ingests a public HTTP(S) document into D1 with request, redirect, content-type, and response-size limits.
- `src/pages/api/upload.ts` inserts bounded manually supplied documents into D1.
- `src/pages/api/chat.ts` retrieves a small evidence set and passes bounded source excerpts to Workers AI.

## Refactor roadmap

See [`docs/REFACTOR_ROADMAP.md`](docs/REFACTOR_ROADMAP.md) for the prioritized production-hardening plan.

## License

MIT
