# Production Roadmap

`PROJECT_CONTRACT.md` is authoritative. This document records remaining operational work rather than proposing a different architecture.

## Implemented in the production-hardening pass

- Current secure Astro 7, Vite 8, Tailwind 4, Cloudflare Workers, and one Starwind UI 3 system are contract-enforced.
- Search, suggestions, and chat share one bounded D1/FTS5 retrieval module.
- Retrieval uses escaped AND-first matching with OR fallback.
- Upload, crawl, and chat fail closed behind separate bearer secrets.
- Protected APIs use a dedicated KV rate-limit binding.
- Crawling requires an exact hostname allowlist, checks public DNS results, manually revalidates redirects, blocks special-use destinations, and bounds responses.
- URL ingestion uses an atomic D1 upsert.
- Health checks return HTTP 503 for missing bindings, missing schema, database errors, or FTS drift.
- Dependencies are exactly pinned and locked.
- Unit, security, migration/integration, type, build, and deployment gates are scripted.
- Personal extraction artifacts, binary media, generated payloads, and unsafe self-deploy loops are removed.

## Operator blockers before the first production deployment

1. Independently identify and confirm the Cloudflare account ID.
2. Confirm the existing production D1 database ID.
3. Provision and confirm a distinct preview D1 database.
4. Provision and confirm a dedicated `RATE_LIMIT` KV namespace.
5. Configure exact `INGEST_ALLOWED_HOSTS`.
6. Configure different `INGEST_TOKEN` and `CHAT_TOKEN` Worker secrets.
7. Add the confirmed IDs/hosts as GitHub repository variables.
8. Add `CLOUDFLARE_API_TOKEN` to the protected GitHub production environment.
9. Inspect and explicitly apply pending migrations to the confirmed production D1 database.
10. Run `./scripts/verify-production.sh --production` and require every gate to pass.

Automation intentionally stops rather than creating or guessing these resources.

## Future work requiring a contract revision

- Move canonical large binaries to R2 and retain only extracted text/metadata in D1.
- Replace KV's eventually consistent coarse limiter with Cloudflare Rate Limiting or a Durable Object when strict quotas are required.
- Add semantic retrieval as a second provider while retaining D1/FTS5 for exact lexical retrieval.
- Add passage-level citation offsets and reranking.
- Add an authenticated administrative UI through Cloudflare Access; never expose API bearer secrets to browser code.
