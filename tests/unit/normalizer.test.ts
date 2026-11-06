import { describe, expect, it } from 'vitest';
import {
  normalizePath,
  normalizeTitle,
  normalizeUrl
} from '../../src/core/normalizer';

describe('normalizer', () => {
  it('extracts hostname and path without query or fragment', () => {
    const result = normalizeUrl('https://example.com/articles/linux?ref=123#section');
    expect(result).toEqual({
      hostname: 'example.com',
      hostKey: 'example.com',
      path: 'articles linux'
    });
  });

  it('normalises www, case, trailing dot and default ports away', () => {
    expect(normalizeUrl('https://WWW.Example.COM.:443/a')?.hostname).toBe('example.com');
    expect(normalizeUrl('https://WWW.Example.COM.:443/a')?.hostKey).toBe('example.com');
  });

  it('keeps non-default ports in the affinity key', () => {
    const first = normalizeUrl('http://localhost:3000/app');
    const second = normalizeUrl('http://localhost:3001/app');
    expect(first?.hostname).toBe('localhost');
    expect(first?.hostKey).toBe('localhost:3000');
    expect(second?.hostKey).toBe('localhost:3001');
    expect(first?.hostKey).not.toBe(second?.hostKey);
  });

  it('supports IDN hostnames', () => {
    const result = normalizeUrl('https://bücher.example/path');
    expect(result?.hostname).toMatch(/^xn--/);
  });

  it('removes identifiers and generic path segments', () => {
    const result = normalizeUrl(
      'https://example.com/index.html/12345678/550e8400-e29b-41d4-a716-446655440000/deadbeefdeadbeef/docs'
    );
    expect(result?.path).toBe('docs');
  });

  it('removes path matrix parameters and page extensions', () => {
    const result = normalizeUrl('https://example.com/docs/page.html;jsessionid=abc');
    expect(result?.path).toBe('docs page');
    expect(normalizeUrl('https://example.com/docs/node.js')?.path).toBe('docs node.js');
  });

  it('decodes percent-encoded segments without throwing', () => {
    expect(normalizeUrl('https://example.com/c%2B%2B')?.path).toBe('c++');
    expect(normalizeUrl('https://example.com/path%2Fto')?.path).toBe('path to');
    expect(() => normalizeUrl('https://example.com/bad%zz')).not.toThrow();
  });

  it('ignores credentials', () => {
    expect(normalizeUrl('https://user:pass@example.com/private')?.hostname).toBe('example.com');
  });

  it('rejects non-http and malformed URLs', () => {
    expect(normalizeUrl('chrome://newtab')).toBeNull();
    expect(normalizeUrl('file:///tmp/a.html')).toBeNull();
    expect(normalizeUrl('not a url')).toBeNull();
  });

  it('truncates long titles safely', () => {
    const title = normalizeTitle('  a\u0000b   c  ', 20);
    expect(title).toBe('a b c');
    expect(normalizeTitle('x'.repeat(100), 20)).toHaveLength(20);
  });

  it('normalises a standalone path', () => {
    expect(normalizePath('/docs/index.html/guide')).toBe('docs guide');
  });
});
