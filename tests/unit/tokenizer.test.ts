import { describe, expect, it } from 'vitest';
import { displayTerm, tokenize } from '../../src/core/tokenizer';

describe('tokenizer', () => {
  it('splits normal titles and lowercases', () => {
    expect(tokenize('Linux Kernel Memory Management')).toEqual([
      'linux',
      'kernel',
      'memory',
      'management'
    ]);
  });

  it('splits kebab, snake and camel case', () => {
    expect(tokenize('linux-kernel linux_kernel LinuxKernel')).toEqual([
      'linux',
      'kernel',
      'linux',
      'kernel',
      'linux',
      'kernel'
    ]);
    expect(tokenize('HTTPRequest')).toEqual(['http', 'request']);
  });

  it('preserves technical terms', () => {
    expect(tokenize('C++ C# .NET Node.js')).toEqual(['c++', 'c#', '.net', 'node.js']);
    expect(tokenize('C R Go OS API SQL CPU')).toEqual([
      'c',
      'r',
      'go',
      'os',
      'api',
      'sql',
      'cpu'
    ]);
  });

  it('protects product names from camel splitting', () => {
    expect(tokenize('iPhone iOS macOS JavaScript TypeScript')).toEqual([
      'iphone',
      'ios',
      'macos',
      'javascript',
      'typescript'
    ]);
  });

  it('removes stop words but keeps meaningful short terms', () => {
    expect(tokenize('the and for with a C')).toEqual(['c']);
  });

  it('drops long numeric identifiers', () => {
    expect(tokenize('123456 2024 v1')).toEqual(['2024', 'v1']);
  });

  it('builds prefixed CJK and Thai bigrams', () => {
    expect(tokenize('内存管理')).toEqual(['cjk:内存', 'cjk:存管', 'cjk:管理']);
    expect(tokenize('ภาษาไทย')).toEqual([
      'thai:ภา',
      'thai:าษ',
      'thai:ษา',
      'thai:าไ',
      'thai:ไท',
      'thai:ทย'
    ]);
  });

  it('handles mixed scripts', () => {
    const tokens = tokenize('React 内存');
    expect(tokens).toContain('react');
    expect(tokens).toContain('cjk:内存');
  });

  it('returns no tokens for punctuation, emoji and stop words', () => {
    expect(tokenize('!!! 🧠 …')).toEqual([]);
    expect(tokenize('the and with')).toEqual([]);
  });

  it('caps token length and token count', () => {
    expect(tokenize('a'.repeat(100))[0]).toHaveLength(64);
    expect(tokenize('one two three four five', 3)).toHaveLength(3);
  });

  it('does not throw on combining marks or malformed text', () => {
    expect(() => tokenize('café İstanbul \u0000 \uFFFD')).not.toThrow();
  });

  it('formats display terms without losing technical casing', () => {
    expect(displayTerm('c++')).toBe('C++');
    expect(displayTerm('api')).toBe('API');
    expect(displayTerm('linux')).toBe('Linux');
    expect(displayTerm('cjk:内存')).toBe('内存');
  });
});
