import { describe, expect, it } from 'vitest';
import { AnalysisError, analyzeTabs } from '../../src/core/pipeline';
import type { RawTab } from '../../src/types/tab';

const session: RawTab[] = [
  { id: 1, title: 'Linux Kernel Memory Management', url: 'https://kernel.org/doc/html/mm/' },
  { id: 2, title: 'Understanding Slab Allocators', url: 'https://lwn.net/Articles/slab/' },
  { id: 3, title: 'Linux Slab Allocation', url: 'https://linux.org/docs/slab/' },
  { id: 4, title: 'React Documentation', url: 'https://react.dev/learn' },
  { id: 5, title: 'React Hooks Guide', url: 'https://react.dev/reference/hooks' },
  { id: 6, title: 'Python Tutorial', url: 'https://python.org/tutorial/' }
];

describe('analysis pipeline', () => {
  it('produces explainable groups and leaves unrelated tabs alone', () => {
    const result = analyzeTabs(session);
    expect(result.suggestions.map((suggestion) => suggestion.tabIds)).toEqual([
      [4, 5],
      [2, 3]
    ]);
    expect(result.unclustered.map((document) => document.id)).toEqual([1, 6]);
    expect(result.stats).toMatchObject({
      analyzedCount: 6,
      skippedCount: 0,
      clusterCount: 2,
      unclusteredCount: 2
    });
    for (const suggestion of result.suggestions) {
      expect(suggestion.label.length).toBeGreaterThan(0);
      expect(suggestion.terms.length).toBeGreaterThan(0);
      expect(suggestion.explanation).toContain('Average similarity');
      expect(suggestion.avgSimilarity).toBeGreaterThanOrEqual(0.25);
    }
  });

  it('handles zero and one tab', () => {
    expect(analyzeTabs([]).stats.analyzedCount).toBe(0);
    const single = analyzeTabs([session[0]!]);
    expect(single.suggestions).toEqual([]);
    expect(single.unclustered).toHaveLength(1);
  });

  it('reports skipped tabs without failing the run', () => {
    const result = analyzeTabs([
      { id: 1, title: 'New tab', url: 'chrome://newtab' },
      { id: 2, title: 'Home', url: 'https://example.com/' },
      session[0]!
    ]);
    expect(result.stats.analyzedCount).toBe(1);
    expect(result.skipped).toHaveLength(2);
  });

  it('enforces the tab cap with a typed error', () => {
    expect(() => analyzeTabs(session, { maxTabs: 2 })).toThrowError(AnalysisError);
    try {
      analyzeTabs(session, { maxTabs: 2 });
    } catch (error) {
      expect((error as AnalysisError).code).toBe('TOO_MANY_TABS');
    }
  });

  it('does not mutate the input tabs', () => {
    const copy = JSON.parse(JSON.stringify(session));
    analyzeTabs(session);
    expect(session).toEqual(copy);
  });

  it('is deterministic across repeated runs', () => {
    const first = analyzeTabs(session);
    const second = analyzeTabs(session);
    expect(second.suggestions).toEqual(first.suggestions);
    expect(second.unclustered).toEqual(first.unclustered);
  });

  it('clusters path-only tabs when titles are generic', () => {
    const result = analyzeTabs([
      { id: 1, title: 'Home', url: 'https://one.test/docs/linux/kernel' },
      { id: 2, title: 'Documentation', url: 'https://two.test/docs/linux/kernel' }
    ]);
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]!.tabIds).toEqual([1, 2]);
  });

  it('clusters related tabs from different sites at the default threshold', () => {
    const result = analyzeTabs([
      {
        id: 1,
        title: 'Linux Tutorial - GeeksforGeeks',
        url: 'https://geeksforgeeks.org/linux-tutorial/'
      },
      {
        id: 2,
        title: 'The Linux Kernel documentation — The Linux Kernel documentation',
        url: 'https://docs.kernel.org/'
      },
      { id: 3, title: 'Be a tech bro', url: 'https://world.hey.com/' },
      {
        id: 4,
        title: 'RAG - Articles - IBM Developer',
        url: 'https://developer.ibm.com/articles/'
      },
      {
        id: 5,
        title: 'Introducing System One Models & Jey - TypeSafe AI Blog',
        url: 'https://typesafe.ai/'
      },
      { id: 6, title: 'Anthropic S-1 Breakdown | Kepler', url: 'https://kepler.ai/' }
    ]);

    expect(result.suggestions.map((suggestion) => suggestion.tabIds)).toEqual([[1, 2]]);
    expect(result.unclustered.map((document) => document.id)).toEqual([3, 4, 5, 6]);
  });

  it('supports CJK tabs through bigram overlap', () => {
    const result = analyzeTabs([
      { id: 1, title: '内存管理', url: 'https://one.test/memory' },
      { id: 2, title: '内存管理实践', url: 'https://two.test/memory' }
    ]);
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]!.label.length).toBeGreaterThan(0);
    expect(result.suggestions[0]!.terms.length).toBeGreaterThan(0);
  });

  it('honours a custom threshold and weights', () => {
    const result = analyzeTabs(session, {
      threshold: 0.9,
      weights: { title: 1, path: 0, hostname: 0 }
    });
    expect(result.suggestions).toEqual([]);
    expect(result.unclustered).toHaveLength(6);
  });
});
