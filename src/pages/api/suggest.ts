import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ url, locals }) => {
  try {
    const env = locals?.runtime?.env || {};
    const DB = env.DB;
    if (!DB) {
      return new Response(JSON.stringify([]));
    }

    const query = url.searchParams.get('q');
    if (!query || query.length < 2) {
      return new Response(JSON.stringify([]));
    }

    // Explicitly secure the FTS5 MATCH parameter
    const safeQuery = query.replace(/[^a-zA-Z0-9\s]/g, '').trim();
    if (!safeQuery) return new Response(JSON.stringify([]));
    
    const ftsQuery = `"${safeQuery}"*`;

    // Fetch matching titles to use as suggestions
    const { results } = await DB.prepare(`
      SELECT title
      FROM documents_fts
      WHERE documents_fts MATCH ?
      ORDER BY rank
      LIMIT 5
    `)
      .bind(ftsQuery)
      .all();

    const suggestions = results.map((r: any) => r.title);
    return new Response(JSON.stringify(suggestions));
  } catch (error: any) {
    return new Response(JSON.stringify([]));
  }
};
