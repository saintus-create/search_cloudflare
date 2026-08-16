# Cloudflare Search Portal — Project Contract

**Contract version:** 1.0.0

**Canonical branch:** `main`

**Status:** binding identities must be confirmed before production deployment

This document is the source of truth for the repository. Filenames, old branches,
README claims, and conversational context are not evidence of installed or working
functionality. `scripts/reconcile.sh` inspects the repository against this contract;
`scripts/verify-production.sh` enforces it.

A contract change must be deliberate, reviewed, and committed together with the
implementation and verification changes it requires.

## 1. Canonical application stack

| Concern | Contract |
| --- | --- |
| Runtime | Node.js 22.x in CI and deployment tooling |
| Package manager | npm with a committed `package-lock.json` |
| Application | Astro **6.x**, SSR output |
| Adapter | `@astrojs/cloudflare` **13.7.0** (the Astro 6-compatible line) |
| Styling | Tailwind CSS **4.x** through `@tailwindcss/vite` |
| UI system | Starwind UI **1.16.2**, Astro/vendored-source model |
| Hosting | Cloudflare **Workers**, not Pages |
| SQL/search | Cloudflare D1 plus SQLite FTS5 |
| Rate limiting | Dedicated Cloudflare KV binding named `RATE_LIMIT` |
| AI | Optional Workers AI binding named `AI` |

Versions in `package.json` must be exact—no `latest`, `*`, `^`, `~`, URL, or Git
ranges. The lockfile is authoritative for transitive dependencies.

### Why Starwind 1.16.2

Starwind is the selected UI system. Version 1.16.2 matches the repository's
Astro-native, vendored-component structure and supports Astro 6/Tailwind 4 without
adding React. A Starwind major-version migration is a contract change, not routine
reconciliation.

Starwind is considered installed only when all of the following are true:

1. `starwind` is pinned to `1.16.2` in `devDependencies`.
2. `starwind.config.json` points to `src/styles/global.css` and
   `src/components/starwind`.
3. At least one substantive `.astro` component exists under that directory.
4. At least one application page/layout imports a Starwind component.
5. The shared stylesheet defines the Tailwind 4 theme variables needed by that
   component.

A filename containing `starwind` is not proof of installation. DaisyUI, shadcn,
Bootstrap, Material UI, and other component systems are prohibited unless this
contract is changed first. Icon packages are not UI systems.

## 2. Cloudflare bindings and infrastructure

The application may declare only bindings that are used and documented.

| Binding | Type | Required | Purpose |
| --- | --- | --- | --- |
| `DB` | D1 | yes | Documents, metadata, and FTS5 indexes |
| `RATE_LIMIT` | KV | yes | API rate-limit state only |
| `AI` | Workers AI | no | Evidence-grounded answer synthesis |

`SESSION` is not part of the contract. Add it only with an implemented session
model and a contract revision. Document bodies must not be duplicated into KV.
Large canonical binaries belong in R2 only after an explicit R2 design and
contract revision.

### Infrastructure identity is operator-confirmed

Automation must not guess whether a database or namespace is production. Before
production verification, an operator must export these exact expected values:

```bash
export EXPECTED_CF_ACCOUNT_ID='...'
export EXPECTED_PRODUCTION_D1_ID='...'
export EXPECTED_PREVIEW_D1_ID='...'
export EXPECTED_RATE_LIMIT_KV_ID='...'
```

Rules:

- `database_id` must equal `EXPECTED_PRODUCTION_D1_ID`.
- `preview_database_id` must equal `EXPECTED_PREVIEW_D1_ID`.
- Production and preview D1 IDs must be different.
- The `RATE_LIMIT` KV namespace ID must equal `EXPECTED_RATE_LIMIT_KV_ID`.
- No two bindings may share a namespace ID.
- Wrangler's authenticated account must equal `EXPECTED_CF_ACCOUNT_ID`.
- The named D1 databases and KV namespace must exist in that account.

**Current blocker:** the repository must be treated as unsafe for deployment until
the production and preview D1 identities have been independently verified. A
configuration where `preview_database_id === database_id` always fails.

## 3. Authentication and authorization

These endpoints fail closed:

| Endpoint | Secret | Requirement |
| --- | --- | --- |
| `POST /api/upload` | `INGEST_TOKEN` | `Authorization: Bearer …` |
| `POST /api/crawl` | `INGEST_TOKEN` | `Authorization: Bearer …` |
| `POST /api/chat` | `CHAT_TOKEN` | `Authorization: Bearer …` |

Missing server secrets return HTTP 503. Missing or invalid credentials return HTTP
401. Tokens are Cloudflare secrets and must never appear in source, Wrangler vars,
browser bundles, logs, or committed development files.

The public UI must not embed either token. An authenticated administrative UI or
Cloudflare Access integration requires a separate design and contract revision.

## 4. Crawling and SSRF boundary

Crawling is allowed only for exact hostnames listed in the server-side
`INGEST_ALLOWED_HOSTS` setting. Wildcards are prohibited.

Every initial URL and redirect hop must:

- use HTTP or HTTPS on its default port;
- contain no embedded credentials;
- match the exact hostname allowlist;
- reject localhost, private, link-local, carrier-grade NAT, multicast,
  documentation, reserved, IPv4-mapped, and non-global IPv6 destinations;
- resolve exclusively to public addresses through a public resolver;
- use manual redirects and re-run every check before the next request.

Requests have time, redirect, content-type, request-size, response-size, and stored
content limits. Production relies on Cloudflare Workers' public-Internet egress
isolation in addition to application checks. If arbitrary-host crawling is ever
required, it must use a dedicated egress proxy that pins and enforces the validated
destination address; a resolve-then-fetch hostname check alone is not DNS-rebinding
safe.

## 5. Rate limiting

`/api/upload`, `/api/crawl`, and `/api/chat` are rate-limited independently. They
use only the `RATE_LIMIT` binding and trusted Cloudflare request identity. A missing
binding fails closed with HTTP 503.

KV rate limiting is a coarse abuse control because KV is eventually consistent.
Strict quotas require a Cloudflare Rate Limiting binding or Durable Object and a
contract revision.

## 6. Retrieval and answer generation

- D1 is the canonical document and lexical-index store.
- `search` and `chat` call one shared retrieval module.
- Retrieval tries an escaped all-token (`AND`) FTS5 query first.
- It falls back to escaped any-token (`OR`) matching only when strict retrieval
  returns no documents.
- User input is never interpolated into SQL or FTS syntax.
- Chat receives bounded passages from retrieved documents, not unrestricted full
  documents.
- Answers use only retrieved evidence and return stable source identifiers.

## 7. Migrations and health

Migration files are immutable after merge, uniquely numbered, and applied in
ascending order. A new schema change gets a new migration. Production automation
must identify the exact D1 database before listing or applying migrations.

Tests must build a fresh local D1 database from all migrations and verify:

- required tables and FTS5 virtual tables exist;
- insert, update, and delete triggers keep FTS content synchronized;
- document and FTS row counts match;
- the health endpoint returns HTTP 503 for missing bindings, missing schema, or
  index drift—never a false HTTP 200.

Production migrations require explicit operator confirmation:

```bash
export APPLY_PRODUCTION_MIGRATIONS=yes
```

## 8. Repository hygiene

The repository root contains project configuration and documentation only. Personal
media, extracted document bodies, generated SQL/KV payloads, machine-specific
paths, self-deploy loops, and duplicate extraction scripts are prohibited.

Reconciliation never deletes an unknown or modified file. Known junk may be
removed automatically only when its path and content hash match an allowlisted
artifact recorded in the reconciliation script. Otherwise it is reported as a
conflict for human review.

Stale remote branches are a repository-administration concern, not a build step.
They may be deleted only after `main` is pushed and protected, and only by an
explicit human command.

## 9. Required verification order

CI and production verification use this order and stop at the first failure:

```text
install
  ↓
contract/config audit
  ↓
type/check
  ↓
unit tests
  ↓
security tests
  ↓
migration/integration tests
  ↓
production build
  ↓
deploy (CI only, after protected-branch approval)
```

The deployment gate is:

```text
AUDIT ✓
SECURITY ✓
MIGRATIONS ✓
TESTS ✓
BUILD ✓
CONFIG ✓
GIT ✓
```

No script silently creates D1, KV, R2, secrets, authentication policy, or production
bindings. Missing or ambiguous infrastructure is a hard stop with a specific
remediation message.

## 10. Reconciliation policy

`scripts/reconcile.sh` is read-only by default. `--apply` performs only narrow,
deterministic transformations whose preconditions match. It must:

1. Fetch and inspect `origin/main`.
2. Require the checked-out branch to be `main` for `--apply`. Except for the
   initial bootstrap of these three governance files, the tree must be clean.
3. Create a temporary snapshot before changing files.
4. Detect package/config/source evidence rather than trusting names.
5. Print every planned change.
6. Leave unknown conflicts untouched.
7. Never commit, push, migrate production, create infrastructure, or deploy.

The human workflow remains:

```bash
./scripts/reconcile.sh
./scripts/reconcile.sh --apply
./scripts/verify-production.sh

git diff
git commit
git push origin main
```
