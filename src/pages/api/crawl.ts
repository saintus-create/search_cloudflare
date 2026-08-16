import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import {
  enforceRateLimit,
  jsonResponse,
  parseAllowedHosts,
  readJsonBody,
  RequestSecurityError,
  requireApiAuth,
  safeFetch,
} from '../../lib/security';

const MAX_REQUEST_BYTES = 8 * 1024;
const MAX_STORED_CONTENT_CHARS = 100_000;

const decodeBasicEntities = (value: string) => value
  .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
  .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&nbsp;/gi, ' ');

const extractDocument = (raw: string, contentType: string, fallbackTitle: string) => {
  if (!contentType.includes('html') && !contentType.includes('xhtml')) {
    return {
      title: fallbackTitle,
      content: raw.replace(/\s+/g, ' ').trim().slice(0, MAX_STORED_CONTENT_CHARS),
    };
  }

  const titleMatch = raw.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const title = decodeBasicEntities(
    (titleMatch?.[1] || fallbackTitle).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
  ).slice(0, 500) || fallbackTitle;
  const content = decodeBasicEntities(
    raw
      .replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--([\s\S]*?)-->/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  ).slice(0, MAX_STORED_CONTENT_CHARS);
  return { title, content };
};

export const POST: APIRoute = async ({ request }) => {
  const authFailure = await requireApiAuth(request, env, 'INGEST_TOKEN');
  if (authFailure) return authFailure;

  const rateFailure = await enforceRateLimit(
    request,
    env.RATE_LIMIT,
    'crawl',
    10,
    15 * 60 * 1_000,
  );
  if (rateFailure) return rateFailure;

  try {
    if (!env?.DB) return jsonResponse({ error: 'Database binding is unavailable.' }, 503);
    const body = await readJsonBody<{ url?: unknown }>(request, MAX_REQUEST_BYTES);
    if (typeof body.url !== 'string' || !body.url.trim()) {
      return jsonResponse({ error: 'URL is required.' }, 400);
    }

    const fetched = await safeFetch(body.url.trim(), {
      allowedHosts: parseAllowedHosts(env.INGEST_ALLOWED_HOSTS),
      maxBytes: 2 * 1024 * 1024,
      maxRedirects: 3,
      timeoutMs: 10_000,
    });
    const { title, content } = extractDocument(fetched.text, fetched.contentType, fetched.url.hostname);
    if (!content) return jsonResponse({ error: 'Remote document contained no readable text.' }, 422);

    const canonicalUrl = fetched.url.toString();
    const metadata = JSON.stringify({
      source: 'url',
      fetched_at: new Date().toISOString(),
      content_type: fetched.contentType,
    });
    const document = await env.DB.prepare(`
      INSERT INTO documents (url, title, content, metadata)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(url) DO UPDATE SET
        title = excluded.title,
        content = excluded.content,
        metadata = excluded.metadata
      RETURNING id
    `)
      .bind(canonicalUrl, title, content, metadata)
      .first<{ id: number }>();

    if (!document) throw new Error('D1 upsert returned no document.');
    return jsonResponse({ success: true, id: document.id, title, url: canonicalUrl });
  } catch (error) {
    if (error instanceof RequestSecurityError) return jsonResponse({ error: error.message }, error.status);
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      return jsonResponse({ error: 'Remote request timed out.' }, 504);
    }
    return jsonResponse({ error: 'Unable to ingest the URL.' }, 503);
  }
};
