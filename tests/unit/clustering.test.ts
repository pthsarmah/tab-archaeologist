import { describe, expect, it } from 'vitest';
import { clusterSimilarityMatrix } from '../../src/core/clustering';
import { matrixFor } from '../helpers/fixtures';

describe('clustering', () => {
  it('handles zero and one tab', () => {
    expect(clusterSimilarityMatrix(new Float64Array(0), 0, 0.35)).toEqual({
      clusters: [],
      unclustered: []
    });
    expect(clusterSimilarityMatrix(new Float64Array([1]), 1, 0.35)).toEqual({
      clusters: [],
      unclustered: [0]
    });
  });

  it('merges a pair above the threshold', () => {
    const result = clusterSimilarityMatrix(matrixFor([[1, 0.6], [0.6, 1]]), 2, 0.35);
    expect(result.clusters).toEqual([[0, 1]]);
    expect(result.unclustered).toEqual([]);
  });

  it('leaves a pair below the threshold unclustered', () => {
    const result = clusterSimilarityMatrix(matrixFor([[1, 0.2], [0.2, 1]]), 2, 0.35);
    expect(result.clusters).toEqual([]);
    expect(result.unclustered).toEqual([0, 1]);
  });

  it('merges exactly at the threshold', () => {
    const result = clusterSimilarityMatrix(matrixFor([[1, 0.35], [0.35, 1]]), 2, 0.35);
    expect(result.clusters).toEqual([[0, 1]]);
  });

  it('merges everything at threshold zero', () => {
    const result = clusterSimilarityMatrix(
      matrixFor([
        [1, 0.2, 0.1],
        [0.2, 1, 0.3],
        [0.1, 0.3, 1]
      ]),
      3,
      0
    );
    expect(result.clusters).toEqual([[0, 1, 2]]);
  });

  it('supports clusters larger than two tabs', () => {
    const result = clusterSimilarityMatrix(
      matrixFor([
        [1, 0.7, 0.65],
        [0.7, 1, 0.6],
        [0.65, 0.6, 1]
      ]),
      3,
      0.5
    );
    expect(result.clusters).toEqual([[0, 1, 2]]);
    expect(result.unclustered).toEqual([]);
  });

  it('merges only exact pairs at threshold one', () => {
    const result = clusterSimilarityMatrix(
      matrixFor([
        [1, 1, 0.1],
        [1, 1, 0.2],
        [0.1, 0.2, 1]
      ]),
      3,
      1
    );
    expect(result.clusters).toEqual([[0, 1]]);
    expect(result.unclustered).toEqual([2]);
  });

  it('does not chain through a low average (average linkage)', () => {
    const result = clusterSimilarityMatrix(
      matrixFor([
        [1, 0.8, 0.1],
        [0.8, 1, 0.8],
        [0.1, 0.8, 1]
      ]),
      3,
      0.5
    );
    expect(result.clusters).toEqual([[0, 1]]);
    expect(result.unclustered).toEqual([2]);
  });

  it('keeps every tab in exactly one cluster or in unclustered', () => {
    const result = clusterSimilarityMatrix(
      matrixFor([
        [1, 0.9, 0.1, 0.2],
        [0.9, 1, 0.1, 0.2],
        [0.1, 0.1, 1, 0.7],
        [0.2, 0.2, 0.7, 1]
      ]),
      4,
      0.5
    );
    const all = [...result.clusters.flat(), ...result.unclustered].sort((a, b) => a - b);
    expect(all).toEqual([0, 1, 2, 3]);
  });

  it('sanitises NaN and Infinity to zero', () => {
    const matrix = matrixFor([
      [1, Number.NaN],
      [Number.NaN, 1]
    ]);
    const result = clusterSimilarityMatrix(matrix, 2, 0.35);
    expect(result.clusters).toEqual([]);
    expect(result.unclustered).toEqual([0, 1]);
  });

  it('respects a larger minimum cluster size', () => {
    const result = clusterSimilarityMatrix(matrixFor([[1, 0.9], [0.9, 1]]), 2, 0.35, 3);
    expect(result.clusters).toEqual([]);
    expect(result.unclustered).toEqual([0, 1]);
  });

  it('is deterministic when repeated', () => {
    const matrix = matrixFor([
      [1, 0.6, 0.6],
      [0.6, 1, 0.6],
      [0.6, 0.6, 1]
    ]);
    const first = clusterSimilarityMatrix(matrix, 3, 0.35);
    const second = clusterSimilarityMatrix(matrix, 3, 0.35);
    expect(second).toEqual(first);
  });

  it('handles a threshold above one without merging', () => {
    const result = clusterSimilarityMatrix(matrixFor([[1, 1], [1, 1]]), 2, 2);
    expect(result.clusters).toEqual([]);
  });
});
