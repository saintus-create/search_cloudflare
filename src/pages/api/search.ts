import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { retrieve } from '../../lib/retrieval';
import { jsonResponse } from '../../lib/security';

export const GET: APIRoute = async ({ url }) => {
  const DB = env.DB;
  if (!DB) return jsonResponse({ results: [], error: 'Database binding is unavailable.' }, 503);

  const query = url.searchParams.get('q')?.trim() ?? '';
  if (!query) return jsonResponse({ results: [], matchMode: null });
  if (query.length > 2_000) return jsonResponse({ results: [], error: 'Query is too long.' }, 413);

  try {
    const retrieval = await retrieve(DB, query, { limit: 10 });
    return jsonResponse({
      results: retrieval.results.map(({ content: _content, score: _score, ...result }) => result),
      matchMode: retrieval.matchMode,
    });
  } catch {
    return jsonResponse({ results: [], error: 'Search is temporarily unavailable.' }, 503);
  }
};
