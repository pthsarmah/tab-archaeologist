import { describe, expect, it } from 'vitest';
import { validateConfig } from '../../src/core/config';
import { buildSimilarityMatrix, pairScore } from '../../src/core/similarity';
import { channelsFor, makeDoc } from '../helpers/fixtures';

const config = validateConfig();

describe('similarity', () => {
  it('returns 1 for identical metadata on the same host', () => {
    const documents = [
      makeDoc({ id: 1, titleTokens: ['linux', 'memory'], pathTokens: ['docs'] }),
      makeDoc({ id: 2, titleTokens: ['linux', 'memory'], pathTokens: ['docs'] })
    ];
    const { title, path } = channelsFor(documents);
    expect(pairScore(0, 1, documents, title, path, config)).toBeCloseTo(1);
  });

  it('keeps hostname-only pairs below the default threshold', () => {
    const documents = [
      makeDoc({ id: 1, titleTokens: [], pathTokens: [] }),
      makeDoc({ id: 2, titleTokens: [], pathTokens: [] })
    ];
    const { title, path } = channelsFor(documents);
    const score = pairScore(0, 1, documents, title, path, config);
    expect(score).toBeCloseTo(0.1);
    expect(score).toBeLessThan(config.threshold);
  });

  it('does not give a hostname bonus for different non-default ports', () => {
    const documents = [
      makeDoc({ id: 1, hostname: 'localhost', hostKey: 'localhost:3000' }),
      makeDoc({ id: 2, hostname: 'localhost', hostKey: 'localhost:3001' })
    ];
    const { title, path } = channelsFor(documents);
    expect(pairScore(0, 1, documents, title, path, config)).toBe(0);
  });

  it('redistributes missing text weight to the remaining text channel', () => {
    const differentHosts = [
      makeDoc({ id: 1, titleTokens: [], pathTokens: ['linux', 'memory'], hostKey: 'a.test' }),
      makeDoc({ id: 2, titleTokens: [], pathTokens: ['linux', 'memory'], hostKey: 'b.test' })
    ];
    const first = channelsFor(differentHosts);
    expect(pairScore(0, 1, differentHosts, first.title, first.path, config)).toBeGreaterThan(0.9);
    expect(pairScore(0, 1, differentHosts, first.title, first.path, config)).toBeLessThanOrEqual(1);

    const sameHost = [
      makeDoc({ id: 1, titleTokens: [], pathTokens: ['linux', 'memory'], hostKey: 'a.test' }),
      makeDoc({ id: 2, titleTokens: [], pathTokens: ['linux', 'memory'], hostKey: 'a.test' })
    ];
    const second = channelsFor(sameHost);
    expect(pairScore(0, 1, sameHost, second.title, second.path, config)).toBeCloseTo(1);
  });

  it('adds a capped bonus for shared topical terms', () => {
    const documents = [
      makeDoc({ id: 1, titleTokens: ['linux', 'tutorial', 'geeksfor'], pathTokens: [] }),
      makeDoc({ id: 2, titleTokens: ['linux', 'kernel', 'documentation'], pathTokens: [] })
    ];
    const { title, path } = channelsFor(documents);
    const score = pairScore(0, 1, documents, title, path, config);

    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
    expect(score).toBeGreaterThan(0.2);
  });

  it('treats a missing title on either tab as unavailable, not dissimilar', () => {
    const documents = [
      makeDoc({ id: 1, titleTokens: ['linux'], pathTokens: ['docs'], hostKey: 'same.test' }),
      makeDoc({ id: 2, titleTokens: [], pathTokens: ['docs'], hostKey: 'same.test' })
    ];
    const { title, path } = channelsFor(documents);
    const score = pairScore(0, 1, documents, title, path, config);
    expect(score).toBeGreaterThan(0.9);
  });

  it('produces a symmetric matrix with a unit diagonal', () => {
    const documents = [
      makeDoc({ id: 1, titleTokens: ['a'], pathTokens: [] }),
      makeDoc({ id: 2, titleTokens: ['b'], pathTokens: [] }),
      makeDoc({ id: 3, titleTokens: ['a'], pathTokens: [] })
    ];
    const { title, path } = channelsFor(documents);
    const { matrix, n } = buildSimilarityMatrix(documents, title, path, config);
    expect(n).toBe(3);
    for (let i = 0; i < n; i += 1) {
      expect(matrix[i * n + i]).toBe(1);
      for (let j = 0; j < n; j += 1) {
        expect(matrix[i * n + j]).toBeCloseTo(matrix[j * n + i]!);
        expect(matrix[i * n + j]).toBeGreaterThanOrEqual(0);
        expect(matrix[i * n + j]).toBeLessThanOrEqual(1);
      }
    }
  });

  it('handles an empty and a single-document collection', () => {
    const empty = buildSimilarityMatrix([], channelsFor([]).title, channelsFor([]).path, config);
    expect(empty.n).toBe(0);
    expect(empty.matrix).toHaveLength(0);

    const one = makeDoc({ id: 1, titleTokens: ['linux'] });
    const channels = channelsFor([one]);
    const single = buildSimilarityMatrix([one], channels.title, channels.path, config);
    expect(Array.from(single.matrix)).toEqual([1]);
  });
});
