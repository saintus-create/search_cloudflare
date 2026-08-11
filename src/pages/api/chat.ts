import type { APIRoute } from 'astro';
import { buildFtsQuery } from '../../lib/fts';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
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

    // TRUE FTS5 NATURAL LANGUAGE SANITIZATION
    const ftsQuery = buildFtsQuery(message);

    const { results: contextResults } = await DB.prepare(`
      SELECT d.content, d.title, d.url
      FROM documents d
      JOIN documents_fts f ON d.id = f.rowid
      WHERE documents_fts MATCH ?
      ORDER BY rank
      LIMIT 3
    `).bind(ftsQuery).all() as { results: any[] };

    const context = contextResults
      .map((r: any) => `Source: ${r.title} (${r.url})\nContent: ${r.content}`)
      .join('\n\n');

    let responseText = "I couldn't find an answer.";
    
    // Highly analytical, rhetoric-piercing prompt
    const systemPrompt = `You are a profoundly analytical, truth-seeking AI assistant. Your primary function is to deconstruct information, stripping away manipulation, political rhetoric, logical fallacies, and inherent biases.
        
When responding to the user's query using the provided context:
1. Pre-analyze the premise: Identify any logical fallacies, rhetorical framing, or bias in both the source material and the user's prompt.
2. Deconstruct the narrative: Explicitly call out these biases or fallacies to the user in a clear, objective manner.
3. Deliver the synthesis: Provide an enlightening, fact-based synthesis of the actual information, presenting the core truth unclouded by agenda.

Format your response clearly. Be fearless, intellectually rigorous, and strictly objective. Do not use standard AI disclaimers or apologies. Do not preach. Just analyze and synthesize.

Context: ${context}`;

    if (AI) {
      try {
        const response = await AI.run('@cf/meta/llama-3.1-8b-instruct-fast', {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
          ]
        }) as any;
        responseText = response.response;
      } catch (aiError: any) {
        responseText = `[ERROR CALLING CLOUDFLARE AI]: ${aiError.message || String(aiError)}`;
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
