import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ url, locals }) => {
  const query = url.searchParams.get('q');
  const env = locals?.runtime?.env || {};
  const DB = env.DB;
  if (!DB) {
    return new Response(JSON.stringify({ results: [], error: "Missing DB binding" }));
  }

  if (!query) {
    return new Response(JSON.stringify({ results: [] }));
  }

  try {
    const safeQuery = query.replace(/[^a-zA-Z0-9\s]/g, '').trim() || '*';
    // Search using FTS5 match
    // We use snippet() to get relevant parts
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
      .bind(query)
      .all();

    return new Response(JSON.stringify({ results }));
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};
