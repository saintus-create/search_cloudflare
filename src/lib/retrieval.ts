import { buildFtsQueryLadder, type FtsMatchMode } from './fts';

export interface RetrievedDocument {
  id: number;
  url: string;
  title: string;
  snippet: string;
  content: string;
  score: number;
}

export interface RetrievalResult {
  results: RetrievedDocument[];
  matchMode: FtsMatchMode | null;
}

export interface RetrievalOptions {
  limit?: number;
  contentChars?: number;
}

/** Canonical lexical retrieval path for search, suggestions, and chat. */
export const retrieve = async (
  DB: D1Database,
  query: string,
  options: RetrievalOptions = {},
): Promise<RetrievalResult> => {
  const ladder = buildFtsQueryLadder(query);
  if (ladder.length === 0) return { results: [], matchMode: null };

  const limit = Math.max(1, Math.min(50, Math.trunc(options.limit ?? 10)));
  const contentChars = Math.max(0, Math.min(20_000, Math.trunc(options.contentChars ?? 0)));

  for (const step of ladder) {
    const queryResult = await DB.prepare(`
      SELECT
        d.id,
        d.url,
        COALESCE(d.title, '') AS title,
        snippet(documents_fts, 1, '', '', ' … ', 48) AS snippet,
        substr(COALESCE(d.content, ''), 1, ?) AS content,
        bm25(documents_fts) AS score
      FROM documents AS d
      JOIN documents_fts ON d.id = documents_fts.rowid
      WHERE documents_fts MATCH ?
      ORDER BY score ASC, d.id ASC
      LIMIT ?
    `)
      .bind(contentChars, step.query, limit)
      .all<RetrievedDocument>();

    const results = queryResult.results ?? [];
    if (results.length > 0 || step.mode === 'or' || ladder.length === 1) {
      return { results, matchMode: step.mode };
    }
  }

  return { results: [], matchMode: null };
};
