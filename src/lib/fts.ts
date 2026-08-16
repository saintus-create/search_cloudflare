export type FtsMatchMode = 'and' | 'or';

const MAX_QUERY_TOKENS = 32;

export const tokenizeFtsQuery = (query: string): string[] =>
  query
    .normalize('NFKC')
    .replace(/[‐‑‒–—―]/g, '-')
    .match(/[\p{L}\p{N}]+(?:[./-][\p{L}\p{N}]+)*/gu)
    ?.slice(0, MAX_QUERY_TOKENS) ?? [];

const quoteToken = (token: string) => `"${token.replaceAll('"', '""')}"*`;

export const buildFtsQuery = (query: string, mode: FtsMatchMode = 'and'): string => {
  const tokens = tokenizeFtsQuery(query);
  if (tokens.length === 0) return '';
  return tokens.map(quoteToken).join(mode === 'and' ? ' AND ' : ' OR ');
};

export interface FtsQueryStep {
  mode: FtsMatchMode;
  query: string;
}

export const buildFtsQueryLadder = (query: string): FtsQueryStep[] => {
  const strict = buildFtsQuery(query, 'and');
  if (!strict) return [];
  const broad = buildFtsQuery(query, 'or');
  return strict === broad
    ? [{ mode: 'and', query: strict }]
    : [{ mode: 'and', query: strict }, { mode: 'or', query: broad }];
};
