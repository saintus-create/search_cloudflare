import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ url, locals }) => {
  const q = url.searchParams.get('q') ?? '';
  const { DB } = locals.runtime.env;

  try {
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
      .bind(q)
      .all();

    return new Response(JSON.stringify({ results: results ?? [] }));
  } catch (error: any) {
    return new Response(JSON.stringify({ results: [], error: null }), { status: 200 });
  }
};
