import { describe, expect, it } from 'vitest';
import { validateConfig } from '../../src/core/config';
import { extractDocuments } from '../../src/core/extractor';

const config = validateConfig();

describe('extractor', () => {
  it('extracts and normalises valid tabs', () => {
    const result = extractDocuments(
      [
        {
          id: 0,
          title: '  Linux Kernel  ',
          url: 'https://www.example.com/docs/linux?ref=1#intro',
          windowId: 7
        }
      ],
      config
    );
    expect(result.skipped).toEqual([]);
    expect(result.documents[0]).toMatchObject({
      id: 0,
      windowId: 7,
      title: 'Linux Kernel',
      hostname: 'example.com',
      hostKey: 'example.com',
      path: 'docs linux'
    });
    expect(result.documents[0]!.titleTokens).toEqual(['linux', 'kernel']);
  });

  it('uses pendingUrl when url is absent', () => {
    const result = extractDocuments(
      [{ id: 1, title: 'Loading docs', pendingUrl: 'https://example.com/docs/guide' }],
      config
    );
    expect(result.documents).toHaveLength(1);
  });

  it('skips tabs without an id or URL', () => {
    const result = extractDocuments(
      [
        { title: 'No id', url: 'https://example.com/a' },
        { id: 2, title: 'No URL' }
      ],
      config
    );
    expect(result.skipped).toEqual([
      { reason: 'no-id' },
      { id: 2, reason: 'no-url' }
    ]);
  });

  it('skips restricted and malformed URLs', () => {
    const result = extractDocuments(
      [
        { id: 1, title: 'New tab', url: 'chrome://newtab' },
        { id: 2, title: 'File', url: 'file:///tmp/a.html' },
        { id: 3, title: 'Bad', url: 'not a url' }
      ],
      config
    );
    expect(result.skipped).toEqual([
      { id: 1, reason: 'restricted' },
      { id: 2, reason: 'restricted' },
      { id: 3, reason: 'invalid-url' }
    ]);
  });

  it('treats a generic title as unavailable and falls back to the path', () => {
    const result = extractDocuments(
      [{ id: 1, title: 'Home', url: 'https://example.com/docs/linux' }],
      config
    );
    expect(result.documents[0]!.titleTokens).toEqual([]);
    expect(result.documents[0]!.pathTokens).toEqual(['docs', 'linux']);
  });

  it('skips tabs with no usable metadata', () => {
    const result = extractDocuments(
      [{ id: 1, title: 'Home', url: 'https://example.com/' }],
      config
    );
    expect(result.skipped).toEqual([{ id: 1, reason: 'no-metadata' }]);
  });

  it('keeps duplicate tabs and technical path tokens', () => {
    const result = extractDocuments(
      [
        { id: 1, title: 'C++ guide', url: 'https://example.com/c%2B%2B' },
        { id: 2, title: 'C++ guide', url: 'https://example.com/c%2B%2B' }
      ],
      config
    );
    expect(result.documents).toHaveLength(2);
    expect(result.documents[0]!.pathTokens).toEqual(['c++']);
  });

  it('truncates long titles', () => {
    const result = extractDocuments(
      [{ id: 1, title: 'x'.repeat(500), url: 'https://example.com/a' }],
      config
    );
    expect(result.documents[0]!.title.length).toBe(config.maxTitleChars);
  });
});
