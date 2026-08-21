import { buildFtsQuery } from './fts';

export interface RetrievedDocument {
  id: number;
  url: string;
  title: string;
  snippet: string;
  content: string;
  score: number;
}

export interface RetrievalOptions {
  limit?: number;
  contentChars?: number;
}

export interface RetrievalResult {
  results: RetrievedDocument[];
}

/** Canonical lexical retrieval path shared by search and chat. */
export const retrieve = async (
  DB: D1Database,
  query: string,
  options: RetrievalOptions = {},
): Promise<RetrievalResult> => {
  const ftsQuery = buildFtsQuery(query);
  const limit = Math.max(1, Math.min(50, Math.trunc(options.limit ?? 10)));
  const contentChars = Math.max(0, Math.min(20_000, Math.trunc(options.contentChars ?? 0)));

  const queryResult = await DB.prepare(`
    SELECT
      d.id,
      d.url,
      COALESCE(d.title, '') AS title,
      snippet(documents_fts, 1, '<b>', '</b>', '...', 64) AS snippet,
      substr(COALESCE(d.content, ''), 1, ?) AS content,
      bm25(documents_fts) AS score
    FROM documents AS d
    JOIN documents_fts ON d.id = documents_fts.rowid
    WHERE documents_fts MATCH ?
    ORDER BY score ASC, d.id ASC
    LIMIT ?
  `)
    .bind(contentChars, ftsQuery, limit)
    .all<RetrievedDocument>();

  return { results: queryResult.results ?? [] };
};
