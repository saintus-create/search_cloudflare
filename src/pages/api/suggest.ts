import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { retrieve } from '../../lib/retrieval';
import { jsonResponse } from '../../lib/security';

export const GET: APIRoute = async ({ url }) => {
  const query = url.searchParams.get('q')?.trim() ?? '';
  if (query.length < 2 || query.length > 500) return jsonResponse([]);

  const DB = env.DB;
  if (!DB) return jsonResponse([], 503);

  try {
    const retrieval = await retrieve(DB, query, { limit: 5 });
    const suggestions = [...new Set(retrieval.results.map((result) => result.title).filter(Boolean))];
    return jsonResponse(suggestions);
  } catch {
    return jsonResponse([], 503);
  }
};
