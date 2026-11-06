import { describe, expect, it } from 'vitest';
import {
  aggregateCounts,
  evaluateGroups,
  macroMetrics,
  metricsFromCounts
} from '../../evaluation/metrics';

describe('evaluation metrics', () => {
  it('counts a true positive pair', () => {
    const counts = evaluateGroups([[1, 2]], { '1': 'linux', '2': 'linux' });
    expect(counts).toMatchObject({ tp: 1, fp: 0, fn: 0, tn: 0 });
    expect(metricsFromCounts(counts)).toMatchObject({ precision: 1, recall: 1, f1: 1 });
  });

  it('counts a false positive pair', () => {
    const counts = evaluateGroups([[1, 2]], { '1': 'linux', '2': 'react' });
    expect(counts).toMatchObject({ tp: 0, fp: 1, fn: 0, tn: 0 });
    expect(metricsFromCounts(counts).precision).toBe(0);
  });

  it('counts a false negative when related tabs stay unclustered', () => {
    const counts = evaluateGroups([], { '1': 'linux', '2': 'linux' });
    expect(counts).toMatchObject({ tp: 0, fp: 0, fn: 1, tn: 0 });
    expect(metricsFromCounts(counts).recall).toBe(0);
  });

  it('counts a true negative', () => {
    const counts = evaluateGroups([], { '1': 'linux', '2': 'react' });
    expect(counts).toMatchObject({ tp: 0, fp: 0, fn: 0, tn: 1 });
  });

  it('defines undefined precision and recall as zero', () => {
    const metrics = metricsFromCounts(evaluateGroups([], { '1': 'only' }));
    expect(metrics.precision).toBe(0);
    expect(metrics.recall).toBe(0);
    expect(metrics.f1).toBe(0);
  });

  it('excludes ambiguous and missing truth labels', () => {
    const counts = evaluateGroups([[1, 2], [3, 4]], {
      '1': 'linux',
      '2': 'linux',
      '3': ['react', 'docs'],
      '4': 'react',
      '5': '__ambiguous__'
    });
    expect(counts.evaluatedTabs).toBe(3);
    expect(counts).toMatchObject({ tp: 1, fp: 0, fn: 0 });
  });

  it('aggregates micro and macro metrics', () => {
    const first = metricsFromCounts(evaluateGroups([[1, 2], [3, 4]], {
      '1': 'a',
      '2': 'a',
      '3': 'b',
      '4': 'b'
    }));
    const second = metricsFromCounts(evaluateGroups([], { '5': 'c', '6': 'c' }));
    const micro = metricsFromCounts(aggregateCounts([first, second]));
    const macro = macroMetrics([first, second]);
    expect(micro.tp).toBe(2);
    expect(micro.fn).toBe(1);
    expect(macro.precision).toBeCloseTo(0.5);
    expect(macro.recall).toBeCloseTo(0.5);
  });

  it('rejects a tab in two predicted groups', () => {
    expect(() =>
      evaluateGroups([[1, 2], [2, 3]], { '1': 'a', '2': 'a', '3': 'a' })
    ).toThrow(/more than one predicted group/);
  });
});
