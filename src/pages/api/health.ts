import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { jsonResponse, parseAllowedHosts } from '../../lib/security';

const REQUIRED_SCHEMA_OBJECTS = [
  'documents', 'documents_fts', 'documents_ai', 'documents_ad', 'documents_au',
  'sections', 'sections_fts',
] as const;

export const GET: APIRoute = async () => {
  const missingBindings = [
    !env.DB && 'DB',
    !env.RATE_LIMIT && 'RATE_LIMIT',
    !env.INGEST_TOKEN && 'INGEST_TOKEN',
    !env.CHAT_TOKEN && 'CHAT_TOKEN',
    !env.INGEST_ALLOWED_HOSTS && 'INGEST_ALLOWED_HOSTS',
  ].filter((binding): binding is string => Boolean(binding));

  if (missingBindings.length > 0 || !env.DB) {
    return jsonResponse({
      ok: false,
      error: 'Required runtime configuration is unavailable.',
      checks: { missingBindings },
    }, 503);
  }

  try {
    if (parseAllowedHosts(env.INGEST_ALLOWED_HOSTS).size === 0) {
      return jsonResponse({ ok: false, error: 'Ingestion allowlist is empty.' }, 503);
    }

    const placeholders = REQUIRED_SCHEMA_OBJECTS.map(() => '?').join(', ');
    const schema = await env.DB.prepare(`
      SELECT name FROM sqlite_master
      WHERE name IN (${placeholders}) AND type IN ('table', 'trigger')
    `)
      .bind(...REQUIRED_SCHEMA_OBJECTS)
      .all<{ name: string }>();
    const present = new Set((schema.results ?? []).map((item) => item.name));
    const missingSchema = REQUIRED_SCHEMA_OBJECTS.filter((name) => !present.has(name));
    if (missingSchema.length > 0) {
      return jsonResponse({
        ok: false,
        error: 'Database schema is incomplete.',
        checks: { missingBindings: [], missingSchema },
      }, 503);
    }

    const documentCount = await env.DB.prepare('SELECT COUNT(*) AS count FROM documents')
      .first<{ count: number }>();
    const ftsCount = await env.DB.prepare('SELECT COUNT(*) AS count FROM documents_fts')
      .first<{ count: number }>();
    const documents = Number(documentCount?.count ?? 0);
    const indexedDocuments = Number(ftsCount?.count ?? 0);
    if (documents !== indexedDocuments) {
      return jsonResponse({
        ok: false,
        error: 'FTS index is inconsistent.',
        checks: { documents, indexedDocuments, indexConsistent: false },
      }, 503);
    }

    return jsonResponse({
      ok: true,
      checks: {
        missingBindings: [],
        missingSchema: [],
        documents,
        indexedDocuments,
        indexConsistent: true,
        aiConfigured: Boolean(env.AI),
      },
    });
  } catch {
    return jsonResponse({
      ok: false,
      error: 'Database readiness check failed.',
      checks: { databaseReachable: false },
    }, 503);
  }
};
