import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { clusterSimilarityMatrix } from '../../src/core/clustering';
import { analyzeTabs } from '../../src/core/pipeline';
import { buildSimilarityMatrix } from '../../src/core/similarity';
import { buildChannelVectors } from '../../src/core/tfidf';
import { tokenize } from '../../src/core/tokenizer';
import { channelsFor, makeDoc } from '../helpers/fixtures';

describe('property invariants', () => {
  it('tokenizer never emits empty or whitespace tokens and respects the cap', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 200 }), (text) => {
        const tokens = tokenize(text, 20);
        expect(tokens.length).toBeLessThanOrEqual(20);
        for (const token of tokens) {
          expect(token.length).toBeGreaterThan(0);
          expect(token).not.toMatch(/\s/);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('TF-IDF vectors are finite and unit length or empty', () => {
    const lists = fc.array(fc.array(fc.string({ minLength: 1, maxLength: 8 }), { maxLength: 12 }), {
      maxLength: 12
    });
    fc.assert(
      fc.property(lists, (tokenLists) => {
        const channel = buildChannelVectors(tokenLists);
        expect(channel.vectors).toHaveLength(tokenLists.length);
        for (const vector of channel.vectors) {
          let squared = 0;
          for (const value of vector.values()) {
            expect(Number.isFinite(value)).toBe(true);
            squared += value * value;
          }
          expect(Math.abs(Math.sqrt(squared) - (vector.size === 0 ? 0 : 1))).toBeLessThan(1e-9);
        }
      }),
      { numRuns: 50 }
    );
  });

  it('similarity matrices are symmetric, bounded and have a unit diagonal', () => {
    const tokenArbitrary = fc.array(fc.string({ minLength: 1, maxLength: 8 }), { maxLength: 5 });
    const docsArbitrary = fc.array(
      fc.record({
        id: fc.integer({ min: 0, max: 100 }),
        titleTokens: tokenArbitrary,
        pathTokens: tokenArbitrary,
        hostname: fc.constantFrom('a.test', 'b.test', 'c.test')
      }),
      { maxLength: 8 }
    );
    fc.assert(
      fc.property(docsArbitrary, (inputs) => {
        const documents = inputs.map((input) =>
          makeDoc({
            ...input,
            hostKey: input.hostname
          })
        );
        const channels = channelsFor(documents);
        const { matrix, n } = buildSimilarityMatrix(
          documents,
          channels.title,
          channels.path,
          {
            weights: { title: 0.65, path: 0.25, hostname: 0.1 },
            threshold: 0.25,
            minClusterSize: 2,
            maxTabs: 500,
            maxTitleChars: 300,
            maxTokensPerField: 80,
            maxLabelTerms: 3
          }
        );
        for (let i = 0; i < n; i += 1) {
          expect(matrix[i * n + i]).toBe(1);
          for (let j = 0; j < n; j += 1) {
            expect(matrix[i * n + j]).toBeCloseTo(matrix[j * n + i]!, 10);
            expect(matrix[i * n + j]).toBeGreaterThanOrEqual(0);
            expect(matrix[i * n + j]).toBeLessThanOrEqual(1);
          }
        }
      }),
      { numRuns: 40 }
    );
  });

  it('clustering always produces a complete partition', () => {
    const matrixArbitrary = fc.array(fc.double({ min: 0, max: 1, noNaN: true }), {
      minLength: 1,
      maxLength: 8
    });
    fc.assert(
      fc.property(matrixArbitrary, fc.double({ min: 0, max: 1, noNaN: true }), (values, threshold) => {
        const n = values.length;
        const matrix = new Float64Array(n * n);
        for (let i = 0; i < n; i += 1) {
          for (let j = 0; j < n; j += 1) {
            matrix[i * n + j] = i === j ? 1 : values[(i + j) % values.length]!;
          }
        }
        const result = clusterSimilarityMatrix(matrix, n, threshold, 2);
        const all = [...result.clusters.flat(), ...result.unclustered].sort((a, b) => a - b);
        expect(all).toEqual(Array.from({ length: n }, (_, index) => index));
        for (const cluster of result.clusters) expect(cluster.length).toBeGreaterThanOrEqual(2);
      }),
      { numRuns: 50 }
    );
  });

  it('pipeline never throws for arbitrary valid tab records', () => {
    const tabArbitrary = fc.record({
      id: fc.integer({ min: 0, max: 1000 }),
      title: fc.string({ maxLength: 80 }),
      url: fc.constantFrom(
        'https://example.com/a',
        'https://example.com/docs/linux',
        'http://localhost:3000/app',
        'chrome://newtab',
        'not a url'
      )
    });
    fc.assert(
      fc.property(fc.array(tabArbitrary, { maxLength: 12 }), (tabs) => {
        expect(() => analyzeTabs(tabs, { maxTabs: 100 })).not.toThrow();
      }),
      { numRuns: 40 }
    );
  });
});
