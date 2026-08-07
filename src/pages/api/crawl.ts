import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json() as { url?: string };
    const { url } = body;
    const { DB, KV } = locals.runtime.env;

    if (!url) {
      return new Response(JSON.stringify({ error: 'URL is required' }), { status: 400 });
    }

    let title = url;
    let content = '';

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CloudflareSearchBot/1.0)' },
        signal: AbortSignal.timeout(10000),
      });
      const text = await res.text();
      content = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 1000);
      title = url;
    } catch {
      content = `Failed to fetch ${url}`;
    }

    const existing = await DB.prepare('SELECT id FROM documents WHERE url = ?')
      .bind(url)
      .first();

    let result;
    if (existing) {
      result = await DB.prepare(
        'UPDATE documents SET title = ?, content = ?, metadata = ? WHERE url = ?'
      )
        .bind(title, content, JSON.stringify({}), url)
        .run();
    } else {
      result = await DB.prepare(
        'INSERT INTO documents (url, title, content, metadata) VALUES (?, ?, ?, ?)'
      )
        .bind(url, title, content, JSON.stringify({}))
        .run();
    }

    await KV.put(`doc:${url}`, JSON.stringify({
      url,
      title,
      content,
      timestamp: new Date().toISOString()
    }));

    return new Response(JSON.stringify({ 
      success: true, 
      id: result.meta.last_row_id,
      title 
    }));
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || String(error) }), { status: 500 });
  }
};
