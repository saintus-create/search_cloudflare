import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ url, locals }) => {
  try {
    const env = locals?.runtime?.env || {};
    const DB = env.DB;
    if (!DB) {
      return new Response(JSON.stringify({ results: [], error: "Missing DB binding" }));
    }

    const q = url.searchParams.get('q') ?? '';

    // Explicitly secure the FTS5 MATCH parameter
    const safeQuery = q.replace(/[^a-zA-Z0-9\s]/g, '').trim();
    const ftsQuery = safeQuery ? `"${safeQuery}"*` : '*';

    const { results } = await DB.prepare(`
      SELECT 
        d.id, 
        d.url, 
        d.title, 
        snippet(documents_fts, 1, '<mark>', '</mark>', '...', 64) as snippet
      FROM documents d
      JOIN documents_fts f ON d.id = f.rowid
      WHERE documents_fts MATCH ?
      ORDER BY rank
      LIMIT 10
    `)
      .bind(ftsQuery)
      .all();

    return new Response(JSON.stringify({ results: results ?? [] }));
  } catch (error: any) {
    return new Response(JSON.stringify({ results: [], error: error.message }), { status: 500 });
  }
};
