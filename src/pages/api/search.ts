import type { APIRoute } from 'astro';
import { buildFtsQuery } from '../../lib/fts';

export const GET: APIRoute = async ({ url, locals }) => {
  try {
    const env = locals?.runtime?.env || {};
    const DB = env.DB;
    if (!DB) {
      return new Response(JSON.stringify({ results: [], error: "Missing DB binding" }));
    }

    const query = url.searchParams.get('q');
    if (!query) {
      return new Response(JSON.stringify({ results: [] }));
    }

    // Explicitly secure and parse the FTS5 MATCH parameter for NLP
    const ftsQuery = buildFtsQuery(query);

    const { results } = await DB.prepare(`
      SELECT 
        d.id, 
        d.url, 
        d.title, 
        snippet(documents_fts, 1, '<b>', '</b>', '...', 64) as snippet
      FROM documents d
      JOIN documents_fts f ON d.id = f.rowid
      WHERE documents_fts MATCH ?
      ORDER BY rank
      LIMIT 10
    `)
      .bind(ftsQuery)
      .all();

    return new Response(JSON.stringify({ results }));
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};
