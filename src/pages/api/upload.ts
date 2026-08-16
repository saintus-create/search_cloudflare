import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import {
  enforceRateLimit,
  jsonResponse,
  readJsonBody,
  RequestSecurityError,
  requireApiAuth,
} from '../../lib/security';

const MAX_REQUEST_BYTES = 512 * 1024;
const MAX_CONTENT_CHARS = 100_000;
const MAX_TITLE_CHARS = 500;

export const POST: APIRoute = async ({ request }) => {
  const authFailure = await requireApiAuth(request, env, 'INGEST_TOKEN');
  if (authFailure) return authFailure;

  const rateFailure = await enforceRateLimit(
    request,
    env.RATE_LIMIT,
    'upload',
    20,
    15 * 60 * 1_000,
  );
  if (rateFailure) return rateFailure;

  try {
    if (!env?.DB) return jsonResponse({ error: 'Database binding is unavailable.' }, 503);
    const body = await readJsonBody<{
      title?: unknown;
      content?: unknown;
      metadata?: unknown;
    }>(request, MAX_REQUEST_BYTES);
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    const suppliedMetadata = body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
      ? body.metadata as Record<string, unknown>
      : {};

    if (!title || !content) return jsonResponse({ error: 'Title and content are required.' }, 400);
    if (title.length > MAX_TITLE_CHARS) return jsonResponse({ error: 'Title is too long.' }, 400);
    if (content.length > MAX_CONTENT_CHARS) return jsonResponse({ error: 'Content is too long.' }, 413);
    if ('originalData' in suppliedMetadata) {
      return jsonResponse({ error: 'Binary payloads are not accepted. Store originals in R2.' }, 400);
    }

    const url = `local://${crypto.randomUUID()}`;
    const metadata = JSON.stringify({
      ...suppliedMetadata,
      source: 'manual_upload',
      uploaded_at: new Date().toISOString(),
    });
    const document = await env.DB.prepare(`
      INSERT INTO documents (url, title, content, metadata)
      VALUES (?, ?, ?, ?)
      RETURNING id
    `)
      .bind(url, title, content, metadata)
      .first<{ id: number }>();

    if (!document) throw new Error('D1 insert returned no document.');
    return jsonResponse({ success: true, id: document.id, title, url }, 201);
  } catch (error) {
    if (error instanceof RequestSecurityError) return jsonResponse({ error: error.message }, error.status);
    return jsonResponse({ error: 'Unable to upload the document.' }, 503);
  }
};
