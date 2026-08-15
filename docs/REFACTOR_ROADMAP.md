# Refactor Roadmap

This roadmap is based on the current `main` implementation and the production-hardening review. It intentionally separates verified defects from future architecture work.

## P0: completed in this refactor

### Ingestion safety
- Reject non-HTTP(S) URLs, embedded credentials, and obvious private/local targets.
- Validate redirect destinations rather than following redirects blindly.
- Limit crawl request size and remote response size.
- Reject unsupported content types and non-success HTTP responses.
- Do not index failed fetches as if they were documents.
- Return the existing document ID on updates instead of relying on `last_row_id`.
- Bound manual upload request, title, and content sizes.

### Data integrity
- Repair the `documents_au` FTS5 trigger.
- Rebuild the existing external-content FTS index during migration `0003`.
- Remove the redundant KV document copy and the unused KV/session bindings.

### Dependency hygiene
- Remove the unused Firecrawl SDK from the runtime dependency graph.
- Remove the Tailwind 4 PostCSS plugin from a Tailwind 3 configuration.
- Pin the application dependencies that were previously floating on `latest`.
- Add `astro check` to the verification/deployment path.
- Stop ignoring package lockfiles so a reproducible lockfile can be committed.

### AI boundary
- Bound chat input and retrieved context.
- Replace the previous "core truth" instruction with an evidence-grounded contract that distinguishes source statements, inference, conflict, and uncertainty.
- Avoid exposing provider error messages to end users.

## P1: next implementation pass

### Mutation authorization
The crawl and upload endpoints mutate the corpus. They need an explicit administrative authorization model before public deployment. The preferred design is Cloudflare Access or an application session backed by a dedicated authentication flow, rather than a secret embedded in browser JavaScript.

### Rate limiting
Add per-route limits for crawl, upload, chat, and search. Crawl should have a separate quota because it causes outbound network work.

### Stronger SSRF controls
The current crawler blocks obvious private targets and validates redirect hops. A production crawler should additionally use an explicit host allowlist where practical, or an outbound fetching service with stronger destination controls. DNS rebinding cannot be completely eliminated by string validation alone.

### Ingestion pipeline
Separate fetching, normalization, extraction, deduplication, and indexing into modules. The current endpoint is still doing too much work in one route.

### Canonical document model
D1 should remain authoritative for metadata and indexed text. If large original files are introduced, store those originals in R2 and keep D1 references/metadata rather than duplicating complete documents across storage products.

## P2: retrieval quality

### Hybrid retrieval
Keep D1 FTS5 for exact lexical retrieval. Add semantic retrieval as a second provider rather than replacing FTS5.

### Query handling
Introduce explicit query modes:
- exact/identifier search for citations, statutes, URLs, and technical identifiers;
- lexical keyword search;
- semantic retrieval for natural-language questions.

The current FTS helper is now safe and less destructive, but it remains intentionally simple.

### Reranking and evidence selection
Retrieve more candidates, rerank them, apply a relevance threshold, and select bounded evidence passages before generation. Do not send whole documents to the model.

### Citations
Return stable document IDs and passage-level evidence metadata so generated answers can point to the actual retrieved material rather than merely naming a source document.

## P3: platform modernization

- Evaluate migration from the existing Pages-oriented deployment configuration to the current Worker-oriented Astro deployment model.
- Prefer `wrangler.jsonc` for new configuration work, while avoiding a migration solely for cosmetic reasons.
- Enable observability after deployment behavior is verified.
- Generate Cloudflare binding types with Wrangler rather than maintaining hand-written binding interfaces where the generated types are sufficient.

## P4: repository hygiene

- Remove tracked development artifacts that are not fixtures or source material.
- Consolidate duplicate PDF extraction scripts.
- Move repeatable ingestion tooling under a dedicated `scripts/` directory.
- Add automated tests for URL validation, redirect handling, FTS query construction, upload limits, and FTS update behavior.
- Add CI for `npm install`, `npm run check`, and `npm run build`.

## Definition of done

The application should be considered production-ready only when:

1. Corpus mutation requires authorization.
2. Crawl traffic is rate-limited and destination-controlled.
3. D1/FTS5 is demonstrably consistent after inserts, updates, and deletes.
4. Search behavior is covered by automated tests.
5. Retrieval is separated from answer generation.
6. AI answers are grounded in bounded, cited evidence.
7. Dependencies are reproducibly locked.
8. CI verifies type correctness and production builds.
9. Deployment and rollback procedures are documented.
