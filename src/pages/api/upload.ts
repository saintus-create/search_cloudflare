import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json() as { title?: string; content?: string };
    const { title, content } = body;
    const env = locals?.runtime?.env || {};
    const DB = env.DB;
    const KV = env.KV;

    if (!DB) {
      return new Response(JSON.stringify({ error: 'Database binding (DB) is missing.' }), { status: 500 });
    }

    if (!title || !content) {
      return new Response(JSON.stringify({ error: 'Title and content are required' }), { status: 400 });
    }

    // Generate a unique URL-like identifier for manual uploads
    const url = `local://${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const safeContent = content.substring(0, 100000); // Prevent ridiculously massive payloads

    // 1. Insert into D1 (FTS5 Trigger will automatically index this)
    const result = await DB.prepare(
      'INSERT INTO documents (url, title, content, metadata) VALUES (?, ?, ?, ?)'
    )
      .bind(url, title, safeContent, JSON.stringify({ source: 'manual_upload' }))
      .run();

    // 2. Backup to KV if available
    if (KV) {
      await KV.put(`doc:${url}`, JSON.stringify({
        url,
        title,
        content: safeContent,
        timestamp: new Date().toISOString()
      }));
    }

    return new Response(JSON.stringify({ 
      success: true, 
      id: result.meta.last_row_id,
      title,
      url 
    }));
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || String(error) }), { status: 500 });
  }
};
