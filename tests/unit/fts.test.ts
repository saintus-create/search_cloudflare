import { describe, expect, it } from 'vitest';
import { buildFtsQuery, buildFtsQueryLadder, tokenizeFtsQuery } from '../../src/lib/fts';

describe('FTS query construction', () => {
  it('keeps digits and identifier structure', () => {
    expect(tokenizeFtsQuery('42 USC 1983 ACME-X9 12/345')).toEqual([
      '42', 'USC', '1983', 'ACME-X9', '12/345',
    ]);
  });

  it('escapes all terms and uses AND by default', () => {
    expect(buildFtsQuery('42 USC 1983')).toBe('"42"* AND "USC"* AND "1983"*');
  });

  it('builds a strict-then-broad ladder', () => {
    expect(buildFtsQueryLadder('alpha beta')).toEqual([
      { mode: 'and', query: '"alpha"* AND "beta"*' },
      { mode: 'or', query: '"alpha"* OR "beta"*' },
    ]);
  });

  it('returns no wildcard query for punctuation-only input', () => {
    expect(buildFtsQueryLadder('§ -- /')).toEqual([]);
  });
});
