# Cloudflare Search Portal

An Astro 7 server-rendered search application for Cloudflare Workers. D1 and FTS5 provide canonical document storage and lexical retrieval; optional Workers AI generates answers from bounded retrieved evidence.

`PROJECT_CONTRACT.md` is the architecture and security source of truth.

## Stack

- Astro 7 with the current Cloudflare adapter and Vite 8
- Tailwind CSS 4 and one Starwind UI 3 system
- Cloudflare Workers
- D1 plus FTS5
- Dedicated `RATE_LIMIT` KV namespace
- Optional Workers AI

## Requirements

- Node.js 22.12 or newer
- npm
- Wrangler authentication for Cloudflare operations
- Distinct, operator-confirmed production and preview D1 databases
- A dedicated KV namespace for rate limiting

## Install

```bash
npm ci
```

Dependencies are exactly pinned and `package-lock.json` is committed.

## Cloudflare configuration

The repository does not commit infrastructure IDs or guess which resources are production. Export confirmed values:

```bash
export EXPECTED_CF_ACCOUNT_ID='32-character-account-id'
export EXPECTED_PRODUCTION_D1_ID='production-d1-uuid'
export EXPECTED_PREVIEW_D1_ID='different-preview-d1-uuid'
export EXPECTED_RATE_LIMIT_KV_ID='32-character-kv-id'
export INGEST_ALLOWED_HOSTS='docs.example.com,www.example.com'
```

Generate the ignored local Wrangler configuration:

```bash
npm run configure:cloudflare
```

The command fails if IDs are malformed, production and preview are identical, the allowlist contains wildcards, or required values are missing. Add `--verify-remote` when invoking `scripts/configure-cloudflare.mjs` directly to verify D1 and KV resources read-only.

Configure secrets without committing them:

```bash
npx wrangler secret put INGEST_TOKEN
npx wrangler secret put CHAT_TOKEN
```

For local development, copy `.dev.vars.example` to `.dev.vars` and replace both values.

## Migrations

```bash
npx wrangler d1 migrations apply DB --local
npm run test:migrations
```

Production migration commands are intentionally not automated by the repository. Confirm the exact D1 ID, inspect pending migrations, and apply them as an explicit operator action before deployment.

## Development and verification

```bash
npm run dev
npm run audit
npm run check
npm test
npm run test:security
npm run test:migrations
npm run build
```

Or run the complete gate:

```bash
./scripts/production-ready.sh audit
./scripts/production-ready.sh configure
./scripts/production-ready.sh test
```

`verify-production.sh --production` additionally confirms the authenticated Cloudflare account, both D1 databases, the rate-limit KV namespace, required secrets, remote migration state, pushed commit, and clean `main` checkout.

## API security

- `GET /api/search` and `GET /api/suggest` are read-only.
- `POST /api/upload` and `POST /api/crawl` require `Bearer <INGEST_TOKEN>`.
- `POST /api/chat` requires `Bearer <CHAT_TOKEN>`.
- Protected APIs fail closed when secrets or `RATE_LIMIT` are unavailable.
- Crawling is restricted to exact `INGEST_ALLOWED_HOSTS`, revalidates every redirect, blocks non-public destinations, and bounds time and response size.
- Search and chat share one AND-first/OR-fallback FTS retrieval implementation.

The browser UI never embeds administrative or chat credentials.

## CI and deployment

GitHub Actions requires repository variables:

- `CLOUDFLARE_ACCOUNT_ID`
- `PRODUCTION_D1_ID`
- `PREVIEW_D1_ID`
- `RATE_LIMIT_KV_ID`
- `INGEST_ALLOWED_HOSTS`

The protected production environment requires `CLOUDFLARE_API_TOKEN` as a secret. CI installs from the lockfile, generates configuration from confirmed variables, runs contract/type/unit/security/migration/build checks, re-verifies remote production state, and only then deploys the Worker.

For an explicit local deployment:

```bash
export CONFIRM_DEPLOY_COMMIT="$(git rev-parse HEAD)"
./scripts/production-ready.sh deploy
```

## License

MIT
