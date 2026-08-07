import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ locals }) => {
  const { DB } = locals.runtime.env;

  try {
    const { results: sections } = await DB.prepare('SELECT COUNT(*) as count FROM sections').all() as any;
    const { results: documents } = await DB.prepare('SELECT COUNT(*) as count FROM documents').all() as any;
    
    return new Response(JSON.stringify({ 
      ok: true, 
      sections: sections?.[0]?.count ?? 0, 
      documents: documents?.[0]?.count ?? 0 
    }));
  } catch (error: any) {
    return new Response(JSON.stringify({ 
      ok: true, 
      sections: 0, 
      documents: 0, 
      note: 'Database not fully initialized' 
    }));
  }
};
