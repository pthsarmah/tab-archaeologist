import { describe, expect, it } from 'vitest';
import { buildChannelVectors, cosineSparse } from '../../src/core/tfidf';

function norm(vector: Map<string, number>): number {
  let total = 0;
  for (const value of vector.values()) total += value * value;
  return Math.sqrt(total);
}

describe('tf-idf', () => {
  it('handles an empty corpus', () => {
    const channel = buildChannelVectors([]);
    expect(channel.vectors).toEqual([]);
    expect(channel.vocabulary).toEqual([]);
  });

  it('uses the smoothed IDF and N=1 gives IDF 1', () => {
    const channel = buildChannelVectors([['linux', 'kernel']]);
    expect(channel.idf.get('linux')).toBe(1);
    expect(channel.idf.get('kernel')).toBe(1);
  });

  it('gives rarer terms more weight', () => {
    const channel = buildChannelVectors([['common', 'rare'], ['common']]);
    expect(channel.idf.get('rare')!).toBeGreaterThan(channel.idf.get('common')!);
  });

  it('normalises vectors to unit length or leaves them empty', () => {
    const channel = buildChannelVectors([['linux', 'kernel'], [], ['linux']]);
    expect(norm(channel.vectors[0]!)).toBeCloseTo(1);
    expect(channel.vectors[1]!.size).toBe(0);
    expect(norm(channel.vectors[2]!)).toBeCloseTo(1);
  });

  it('keeps separate title and path channels independent', () => {
    const title = buildChannelVectors([['linux'], ['linux']]);
    const path = buildChannelVectors([['linux'], []]);
    expect(title.idf.get('linux')).toBe(1);
    expect(path.idf.get('linux')).toBeCloseTo(1.405, 2);
  });

  it('produces a deterministic sorted vocabulary', () => {
    const channel = buildChannelVectors([['b', 'a'], ['c']]);
    expect(channel.vocabulary).toEqual(['a', 'b', 'c']);
  });

  it('computes sparse cosine and handles empty vectors', () => {
    const a = new Map([
      ['a', 0.6],
      ['b', 0.8]
    ]);
    const b = new Map([
      ['a', 1],
      ['c', 1]
    ]);
    expect(cosineSparse(a, b)).toBeCloseTo(0.6);
    expect(cosineSparse(a, b)).toBeCloseTo(cosineSparse(b, a));
    expect(cosineSparse(a, new Map())).toBe(0);
  });

  it('clamps non-finite cosine results', () => {
    const a = new Map([['x', Number.POSITIVE_INFINITY]]);
    const b = new Map([['x', 1]]);
    expect(cosineSparse(a, b)).toBe(0);
  });
});
