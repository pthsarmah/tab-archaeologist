import { describe, expect, it } from 'vitest';
import { validateConfig } from '../../src/core/config';
import { buildSuggestions } from '../../src/core/labeling';
import { channelsFor, makeDoc, matrixFor } from '../helpers/fixtures';

const config = validateConfig();

describe('labeling', () => {
  it('uses shared, high-weight terms and excludes generic path terms', () => {
    const documents = [
      makeDoc({ id: 1, title: 'Linux Memory Management', titleTokens: ['linux', 'memory', 'management'], pathTokens: ['docs'] }),
      makeDoc({ id: 2, title: 'Linux Slab Memory', titleTokens: ['linux', 'slab', 'memory'], pathTokens: ['docs'] }),
      makeDoc({ id: 3, title: 'Linux Memory Slab', titleTokens: ['linux', 'memory', 'slab'], pathTokens: ['docs'] })
    ];
    const channels = channelsFor(documents);
    const matrix = matrixFor([
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1]
    ]);
    const suggestions = buildSuggestions(documents, [[0, 1, 2]], channels.title, channels.path, matrix, config);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]!.label).toContain('Linux');
    expect(suggestions[0]!.label).not.toContain('Docs');
    expect(suggestions[0]!.terms).not.toContain('Docs');
    expect(suggestions[0]!.avgSimilarity).toBe(1);
    expect(suggestions[0]!.explanation).toContain('share the terms');
    expect(suggestions[0]!.explanation).toContain('Average similarity 1.00');
    expect(suggestions[0]!.tabIds).toEqual([1, 2, 3]);
  });

  it('falls back to the medoid title when no term is shared', () => {
    const documents = [
      makeDoc({ id: 10, title: 'Alpha topic', titleTokens: ['alpha'] }),
      makeDoc({ id: 11, title: 'Beta topic', titleTokens: ['beta'] })
    ];
    const channels = channelsFor(documents);
    const suggestions = buildSuggestions(
      documents,
      [[0, 1]],
      channels.title,
      channels.path,
      matrixFor([[1, 0.4], [0.4, 1]]),
      config
    );
    expect(suggestions[0]!.label).toBe('Alpha topic');
    expect(suggestions[0]!.terms).toEqual([]);
  });

  it('falls back to hostname and then Untitled group', () => {
    const first = makeDoc({ id: 1, title: '', hostname: 'example.test', titleTokens: [] });
    const second = makeDoc({ id: 2, title: '', hostname: 'example.test', titleTokens: [] });
    const channels = channelsFor([first, second]);
    const byHost = buildSuggestions(
      [first, second],
      [[0, 1]],
      channels.title,
      channels.path,
      matrixFor([[1, 0.4], [0.4, 1]]),
      config
    );
    expect(byHost[0]!.label).toBe('example.test');

    const empty = buildSuggestions(
      [first, second],
      [[0, 1]],
      channels.title,
      channels.path,
      matrixFor([[1, 0.4], [0.4, 1]]),
      config
    );
    expect(empty[0]!.label).toBeTruthy();
  });

  it('does not use CJK bigrams as a keyword label; uses the representative title', () => {
    const documents = [
      makeDoc({ id: 1, title: '内存管理', titleTokens: ['cjk:内存', 'cjk:存管', 'cjk:管理'] }),
      makeDoc({ id: 2, title: '内存管理实践', titleTokens: ['cjk:内存', 'cjk:存管', 'cjk:管理'] })
    ];
    const channels = channelsFor(documents);
    const suggestions = buildSuggestions(
      documents,
      [[0, 1]],
      channels.title,
      channels.path,
      matrixFor([[1, 0.8], [0.8, 1]]),
      config
    );
    expect(suggestions[0]!.terms).toEqual([]);
    expect(suggestions[0]!.label).toBe('内存管理');
  });

  it('describes path-only clusters without claiming title similarity', () => {
    const documents = [
      makeDoc({ id: 1, title: '', titleTokens: [], pathTokens: ['linux', 'kernel'] }),
      makeDoc({ id: 2, title: '', titleTokens: [], pathTokens: ['linux', 'kernel'] })
    ];
    const channels = channelsFor(documents);
    const suggestions = buildSuggestions(
      documents,
      [[0, 1]],
      channels.title,
      channels.path,
      matrixFor([[1, 0.8], [0.8, 1]]),
      config
    );
    expect(suggestions[0]!.explanation).toContain('share the terms');
    expect(suggestions[0]!.explanation).not.toContain('titles');
  });

  it('disambiguates duplicate labels', () => {
    const documents = [
      makeDoc({ id: 1, title: 'Alpha one', titleTokens: ['alpha'] }),
      makeDoc({ id: 2, title: 'Alpha two', titleTokens: ['alpha'] }),
      makeDoc({ id: 3, title: 'Alpha three', titleTokens: ['alpha'] }),
      makeDoc({ id: 4, title: 'Alpha four', titleTokens: ['alpha'] })
    ];
    const channels = channelsFor(documents);
    const suggestions = buildSuggestions(
      documents,
      [
        [0, 1],
        [2, 3]
      ],
      channels.title,
      channels.path,
      matrixFor([
        [1, 1, 0, 0],
        [1, 1, 0, 0],
        [0, 0, 1, 1],
        [0, 0, 1, 1]
      ]),
      config
    );
    expect(suggestions.map((suggestion) => suggestion.label)).toEqual(['Alpha', 'Alpha (2)']);
  });

  it('uses the lowest tab id for medoid ties', () => {
    const documents = [
      makeDoc({ id: 50, title: 'Same', titleTokens: ['same'] }),
      makeDoc({ id: 20, title: 'Same', titleTokens: ['same'] })
    ];
    const channels = channelsFor(documents);
    const suggestions = buildSuggestions(
      documents,
      [[0, 1]],
      channels.title,
      channels.path,
      matrixFor([[1, 0.5], [0.5, 1]]),
      config
    );
    expect(suggestions[0]!.medoidTabId).toBe(20);
    expect(suggestions[0]!.id).toBe('cluster-20');
  });
});
