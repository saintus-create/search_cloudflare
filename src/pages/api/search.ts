import type { APIRoute } from 'astro';
import { retrieve } from '../../lib/retrieval';

export const GET: APIRoute = async ({ url, locals }) => {
  try {
    const env = locals?.runtime?.env || {};
    const DB = env.DB;
    if (!DB) {
      return new Response(JSON.stringify({ results: [], error: 'Missing DB binding' }));
    }

    const query = url.searchParams.get('q')?.trim() ?? '';
    if (!query) {
      return new Response(JSON.stringify({ results: [] }));
    }

    const { results } = await retrieve(DB, query, { limit: 10 });

    return new Response(JSON.stringify({
      results: results.map(({ content: _content, score: _score, ...result }) => result),
    }));
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};
