import type { APIRoute } from 'astro';
import { buildFtsQuery } from '../../lib/fts';

const MAX_REQUEST_BYTES = 12 * 1024;
const MAX_MESSAGE_CHARS = 8_000;
const MAX_CONTEXT_CHARS = 12_000;

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > MAX_REQUEST_BYTES) return json({ error: 'Request body is too large' }, 413);

    const body = await request.json() as { message?: string };
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) return json({ error: 'Message is required' }, 400);
    if (message.length > MAX_MESSAGE_CHARS) return json({ error: 'Message is too long' }, 413);

    const env = locals?.runtime?.env || {};
    const DB = env.DB;
    const AI = env.AI;
    if (!DB) return json({ error: 'Database binding (DB) is missing.' }, 500);

    const ftsQuery = buildFtsQuery(message);
    const { results: contextResults } = await DB.prepare(`
      SELECT d.content, d.title, d.url
      FROM documents d
      JOIN documents_fts f ON d.id = f.rowid
      WHERE documents_fts MATCH ?
      ORDER BY rank
      LIMIT 3
    `).bind(ftsQuery).all() as { results: Array<{ content: string; title: string; url: string }> };

    const context = contextResults
      .map((r) => `Source: ${r.title} (${r.url})\nContent: ${r.content.substring(0, MAX_CONTEXT_CHARS)}`)
      .join('\n\n');

    let responseText = "I couldn't find enough indexed evidence to answer that.";

    const systemPrompt = `You are an evidence-grounded research assistant.
Use only the supplied source context for factual claims about the user's question. Distinguish source statements from your own inference. If sources conflict, describe the conflict rather than choosing a "core truth" without evidence. Do not invent facts, citations, or source contents. You may identify rhetorical framing or logical fallacies when the supplied material actually supports that analysis. If the context is insufficient, say so.

Source context:
${context || '(No matching source documents were retrieved.)'}`;

    if (AI) {
      try {
        const response = await AI.run('@cf/meta/llama-3.1-8b-instruct-fast', {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message },
          ],
        }) as { response?: string };
        responseText = response.response || responseText;
      } catch {
        responseText = 'The language model was unavailable. The retrieved sources are still available below.';
      }
    } else if (contextResults.length > 0) {
      responseText = `No language model is configured. Retrieved ${contextResults.length} source document(s), beginning with “${contextResults[0].title}”.`;
    }

    return json({
      answer: responseText,
      sources: contextResults.map((r) => ({ title: r.title, url: r.url })),
    });
  } catch {
    return json({ error: 'Unable to process the request.' }, 500);
  }
};
