import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, locals }) => {
  const body = await request.json() as { message?: string };
  const { message } = body;
  const { DB, AI } = locals.runtime.env;

  if (!message) {
    return new Response(JSON.stringify({ error: 'Message is required' }), { status: 400 });
  }

  try {
    // 1. Retrieve relevant context from D1 using FTS5
    const { results: contextResults } = await DB.prepare(`
      SELECT d.content, d.title, d.url
      FROM documents d
      JOIN documents_fts f ON d.id = f.rowid
      WHERE documents_fts MATCH ?
      ORDER BY rank
      LIMIT 3
    `)
      .bind(message)
      .all() as { results: any[] };

    const context = contextResults
      .map((r: any) => `Source: ${r.title} (${r.url})\nContent: ${r.content}`)
      .join('\n\n');

    // 2. Construct prompt for Workers AI
    const systemPrompt = `You are a helpful assistant. Use the following context to answer the user's question. If the answer is not in the context, say you don't know based on the provided documents.
    
Context:
${context}`;

    // 3. Call Workers AI
    const response = await AI.run('@cf/meta/llama-4-scout-17b-16e-instruct', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ]
    }) as any;

    return new Response(JSON.stringify({ 
      answer: response.response,
      sources: contextResults.map((r: any) => ({ title: r.title, url: r.url }))
    }));
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};
