import type { APIContext } from 'astro';

/**
 * Protects ingestion endpoints with a server-side bearer secret.
 * Missing configuration fails closed rather than exposing a write endpoint.
 */
export const requireIngestAuth = (context: APIContext): Response | null => {
  const env = context.locals?.runtime?.env || {};
  const expected = typeof env.INGEST_TOKEN === 'string' ? env.INGEST_TOKEN : '';
  if (!expected) {
    return new Response(JSON.stringify({ error: 'Ingestion authentication is not configured.' }), {
      status: 503,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }

  const authorization = context.request.headers.get('authorization') || '';
  const supplied = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || '';
  if (!supplied || supplied.length !== expected.length || supplied !== expected) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'www-authenticate': 'Bearer',
      },
    });
  }

  return null;
};
