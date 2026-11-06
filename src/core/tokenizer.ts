import { STOP_WORDS } from './stopwords';
import { extractScriptTokens } from './unicode';

const PROTECTED_TERMS = [
  'objective-c',
  'javascript',
  'typescript',
  'asp.net',
  'node.js',
  'next.js',
  'vue.js',
  'd3.js',
  'c++',
  'c#',
  'f#',
  '.net',
  'iphone',
  'ipad',
  'macos',
  'ios'
].sort((a, b) => b.length - a.length);

const DISPLAY_TERMS: Record<string, string> = {
  'c++': 'C++',
  'c#': 'C#',
  'f#': 'F#',
  '.net': '.NET',
  'asp.net': 'ASP.NET',
  'objective-c': 'Objective-C',
  'node.js': 'Node.js',
  'next.js': 'Next.js',
  'vue.js': 'Vue.js',
  'd3.js': 'D3.js',
  acl: 'ACL',
  api: 'API',
  apis: 'APIs',
  app: 'App',
  cpu: 'CPU',
  css: 'CSS',
  db: 'DB',
  devops: 'DevOps',
  gpu: 'GPU',
  html: 'HTML',
  http: 'HTTP',
  https: 'HTTPS',
  ios: 'iOS',
  js: 'JS',
  json: 'JSON',
  llm: 'LLM',
  macos: 'macOS',
  ml: 'ML',
  os: 'OS',
  ram: 'RAM',
  sql: 'SQL',
  ts: 'TS',
  ui: 'UI',
  url: 'URL',
  ux: 'UX',
  xml: 'XML',
  yaml: 'YAML'
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface ProtectedText {
  text: string;
  restore: Map<string, string>;
}

function protectTechnicalTerms(input: string): ProtectedText {
  let text = input;
  const restore = new Map<string, string>();

  PROTECTED_TERMS.forEach((term, index) => {
    const placeholder = `xqzz${index}zzqx`;
    const pattern = new RegExp(
      `(?<![a-z0-9])${escapeRegExp(term)}(?![a-z0-9])`,
      'gi'
    );
    text = text.replace(pattern, () => {
      restore.set(placeholder, term);
      return placeholder;
    });
  });

  return { text, restore };
}

function splitCamelCase(input: string): string {
  return input
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase();
}

function finishToken(raw: string, restore: Map<string, string>): string | null {
  const restored = restore.get(raw) ?? raw;
  const token = restored.normalize('NFKC').toLowerCase().trim();
  if (!token) return null;
  if (token.length > 64) return token.slice(0, 64);
  if (/^\d{6,}$/.test(token)) return null;
  if (STOP_WORDS.has(token)) return null;
  return token;
}

/**
 * Convert one text field into stable topical tokens.
 *
 * Pipeline: NFKC -> protect known technical terms -> camel/snake/kebab
 * splitting -> script bigrams -> punctuation removal -> stop words.
 */
export function tokenize(text: string, maxTokens = 80): string[] {
  if (!text) return [];

  const protectedText = protectTechnicalTerms(text.normalize('NFKC'));
  const prepared = splitCamelCase(protectedText.text);
  const script = extractScriptTokens(prepared, Math.max(maxTokens, 20));
  const tokens: string[] = [];

  for (const raw of script.stripped.split(/\s+/u)) {
    if (!raw) continue;
    const clean = raw.replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ').trim();
    if (!clean) continue;
    for (const part of clean.split(/\s+/u)) {
      const token = finishToken(part, protectedText.restore);
      if (token) tokens.push(token);
      if (tokens.length >= maxTokens) break;
    }
    if (tokens.length >= maxTokens) break;
  }

  for (const token of script.tokens) {
    if (tokens.length >= maxTokens) break;
    if (!tokens.includes(token)) tokens.push(token);
  }

  return tokens.slice(0, maxTokens);
}

export function displayTerm(term: string): string {
  if (term.startsWith('cjk:')) return term.slice(4);
  if (term.startsWith('thai:')) return term.slice(5);
  if (DISPLAY_TERMS[term]) return DISPLAY_TERMS[term];
  if (!term) return term;
  return term.charAt(0).toUpperCase() + term.slice(1);
}
