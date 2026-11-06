/**
 * Titles made only of these terms carry little topical signal. Such titles are
 * treated as unavailable and the path/hostname channels carry the analysis.
 */
export const GENERIC_TITLE_TOKENS: ReadonlySet<string> = new Set([
  'dashboard',
  'default',
  'docs',
  'documentation',
  'home',
  'homepage',
  'index',
  'loading',
  'login',
  'new',
  'page',
  'search',
  'signin',
  'signup',
  'start',
  'tab',
  'untitled',
  'welcome'
]);

/** Terms that should never become the keyword label for a cluster. */
export const GENERIC_LABEL_TERMS: ReadonlySet<string> = new Set([
  'com',
  'default',
  'docs',
  'documentation',
  'html',
  'http',
  'https',
  'index',
  'login',
  'page',
  'www'
]);

export function isGenericTitle(tokens: string[]): boolean {
  return tokens.length > 0 && tokens.length <= 2 && tokens.every((token) => GENERIC_TITLE_TOKENS.has(token));
}

export function isGenericLabelTerm(term: string): boolean {
  if (term.startsWith('cjk:') || term.startsWith('thai:')) return true;
  return GENERIC_LABEL_TERMS.has(term);
}
