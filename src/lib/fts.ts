export const buildFtsQuery = (query: string): string => {
  const tokens = query
    .normalize('NFKC')
    .match(/[\p{L}\p{N}]+/gu)
    ?.filter((token) => token.length >= 2)
    .slice(0, 32) ?? [];

  if (tokens.length === 0) return '*';

  // Quote every token so user input cannot become FTS5 syntax.
  // Prefix matching preserves useful partial-term search without inventing
  // a natural-language interpretation of the user's question.
  return tokens.map((token) => `"${token.replaceAll('"', '""')}"*`).join(' OR ');
};
