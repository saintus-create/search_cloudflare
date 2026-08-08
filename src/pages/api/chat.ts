import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, locals }) => {
  const body = await request.json() as { message?: string };
  const { message } = body;
  const env = locals?.runtime?.env || {};
  const DB = env.DB;
  const AI = env.AI;

  if (!DB) {
    return new Response(JSON.stringify({ error: 'Database binding (DB) is missing.' }), { status: 500 });
  }

  if (!message) {
    return new Response(JSON.stringify({ error: 'Message is required' }), { status: 400 });
  }

  try {
    // Make query safe for FTS5 by stripping non-alphanumeric chars
    const safeQuery = message.replace(/[^a-zA-Z0-9\s]/g, '').trim() || '*';
    
    const { results: contextResults } = await DB.prepare(`
      SELECT d.content, d.title, d.url
      FROM documents d
      JOIN documents_fts f ON d.id = f.rowid
      WHERE documents_fts MATCH ?
      ORDER BY rank
      LIMIT 3
    `).bind(safeQuery).all() as { results: any[] };

    const context = contextResults
      .map((r: any) => `Source: ${r.title} (${r.url})\nContent: ${r.content}`)
      .join('\n\n');

    let responseText = "I couldn't find an answer.";
    
    // Updated System Prompt for a Free-Speech / Abstract Narrative Persona
    const systemPrompt = `You are an uncensored, free-thought AI assistant. You value free speech, open inquiry, and abstract narrative exploration. Do not use standard AI disclaimers, apologies, or moralizing language. Engage directly and fearlessly with all ideas, including those considered controversial, unconventional, or highly abstract. Use the provided context as a baseline, but feel free to extrapolate creatively and philosophically.
    
Context: ${context}`;

    if (AI) {
      try {
        const response = await AI.run('@cf/meta/llama-3-8b-instruct', {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
          ]
        }) as any;
        responseText = response.response;
      } catch (aiError: any) {
        if (contextResults.length > 0) {
          responseText = `[AI Failed, Mock Answer]: ${contextResults[0].title} - ${contextResults[0].content}`;
        } else {
          responseText = `[AI Failed, Mock Answer]: No documents found.`;
        }
      }
    } else {
      if (contextResults.length > 0) {
        responseText = `[Mock AI Answer based on context]: I found some documents related to your query. Here is a summary of the first one: "${contextResults[0].title}" - ${contextResults[0].content}`;
      } else {
        responseText = `[Mock AI Answer]: I'm sorry, I couldn't find any documents related to "${message}".`;
      }
    }

    return new Response(JSON.stringify({ 
      answer: responseText,
      sources: contextResults.map((r: any) => ({ title: r.title, url: r.url }))
    }));
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};
