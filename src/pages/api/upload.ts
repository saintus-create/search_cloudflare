import type { APIRoute } from 'astro';

const MAX_REQUEST_BYTES = 130_000;
const MAX_CONTENT_CHARS = 100_000;
const MAX_TITLE_CHARS = 500;

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > MAX_REQUEST_BYTES) return json({ error: 'Request body is too large' }, 413);

    const body = await request.json() as {
      title?: string;
      content?: string;
      metadata?: Record<string, unknown>;
    };
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const content = typeof body.content === 'string' ? body.content.trim() : '';

    if (!title || !content) return json({ error: 'Title and content are required' }, 400);
    if (title.length > MAX_TITLE_CHARS) return json({ error: 'Title is too long' }, 400);
    if (content.length > MAX_CONTENT_CHARS) return json({ error: 'Content is too long' }, 413);

    const DB = locals?.runtime?.env?.DB;
    if (!DB) return json({ error: 'Database binding (DB) is missing.' }, 500);

    const url = `local://${crypto.randomUUID()}`;
    const metadata = {
      source: 'manual_upload',
      ...(body.metadata && typeof body.metadata === 'object' ? body.metadata : {}),
    };

    const result = await DB.prepare(
      'INSERT INTO documents (url, title, content, metadata) VALUES (?, ?, ?, ?)'
    )
      .bind(url, title, content, JSON.stringify(metadata))
      .run();

    return json({ success: true, id: result.meta.last_row_id, title, url }, 201);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unexpected upload failure' }, 500);
  }
};
