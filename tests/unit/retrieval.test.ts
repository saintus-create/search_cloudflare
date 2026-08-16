import { describe, expect, it } from 'vitest';
import { retrieve, type RetrievedDocument } from '../../src/lib/retrieval';

const result: RetrievedDocument = {
  id: 1,
  url: 'https://example.com',
  title: 'Example',
  snippet: 'alpha beta',
  content: '',
  score: -1,
};

const fakeDb = (responses: RetrievedDocument[][], bound: unknown[][]) => ({
  prepare: () => ({
    bind: (...values: unknown[]) => {
      bound.push(values);
      return { all: async () => ({ results: responses.shift() ?? [] }) };
    },
  }),
}) as unknown as D1Database;

describe('shared retrieval', () => {
  it('falls back to OR only when AND returns no documents', async () => {
    const bound: unknown[][] = [];
    const value = await retrieve(fakeDb([[], [result]], bound), 'alpha beta');
    expect(value.matchMode).toBe('or');
    expect(value.results).toEqual([result]);
    expect(bound[0][1]).toContain(' AND ');
    expect(bound[1][1]).toContain(' OR ');
  });

  it('does not run broad retrieval after a strict match', async () => {
    const bound: unknown[][] = [];
    const value = await retrieve(fakeDb([[result]], bound), 'alpha beta');
    expect(value.matchMode).toBe('and');
    expect(bound).toHaveLength(1);
  });
});
