# Cloudflare Native Search Portal (Astro)

A production-ready search portal scaffolded with Astro and Cloudflare-native services.

## Features

- **Astro 5**: Modern web framework with SSR.
- **Cloudflare D1 + FTS5**: SQLite-based full-text search for fast, local-to-the-edge indexing.
- **Cloudflare KV**: High-performance key-value storage for full document content.
- **Cloudflare Workers AI**: On-edge LLM (Llama 3) for RAG-style Q&A.
- **Firecrawl Integration**: Effortless web crawling and markdown conversion.
- **PWA Support**: Offline-ready with service workers.
- **Tailwind CSS**: Beautiful, responsive UI.

## Prerequisites

- [Node.js](https://nodejs.org/)
- [Cloudflare Account](https://dash.cloudflare.com/) (for deployment)
- [Firecrawl API Key](https://firecrawl.dev/)

## Getting Started

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Setup Local Database

Initialize your local D1 database and run migrations:

```bash
npx wrangler d1 migrations apply search_portal_db --local
```

### 3. Configure Environment Variables

Create a `.dev.vars` file for local development:

```env
FIRECRAWL_API_KEY=your_firecrawl_api_key
```

### 4. Run Development Server

```bash
npm run dev
```

The portal will be available at `http://localhost:4321`.

## Deployment

### 1. Create Cloudflare Resources

Create the D1 database and KV namespace:

```bash
npx wrangler d1 create search_portal_db
npx wrangler kv:namespace create SEARCH_PORTAL_KV
```

Update `wrangler.toml` with the generated IDs.

### 2. Deploy to Cloudflare Pages

```bash
npm run pages:deploy
```

## Project Structure

- `src/pages/api/crawl.ts`: Handles URL crawling via Firecrawl and indexing in D1/KV.
- `src/pages/api/search.ts`: Performs FTS5 full-text search on D1.
- `src/pages/api/chat.ts`: RAG implementation using Workers AI.
- `src/layouts/Layout.astro`: Main layout with Tailwind and Lucide icons.
- `migrations/`: SQL migration files for D1 schema.
- `wrangler.toml`: Cloudflare configuration and bindings.

## License

MIT
