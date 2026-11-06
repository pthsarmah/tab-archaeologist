const CJK_RUN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+/gu;
const THAI_RUN = /[\p{Script=Thai}]+/gu;

export interface ScriptTokenResult {
  tokens: string[];
  stripped: string;
}

function bigrams(run: string, prefix: string): string[] {
  const chars = Array.from(run);
  if (chars.length === 0) return [];
  if (chars.length === 1) return [`${prefix}${chars[0]}`];

  const tokens: string[] = [];
  for (let index = 0; index < chars.length - 1; index += 1) {
    tokens.push(`${prefix}${chars[index]}${chars[index + 1]}`);
  }
  return tokens;
}

/**
 * Produce deterministic character bigrams for scripts that do not use spaces.
 * This is intentionally simple: no dictionary or external segmenter is needed.
 */
export function extractScriptTokens(text: string, limit = 120): ScriptTokenResult {
  const tokens: string[] = [];

  for (const run of text.match(CJK_RUN) ?? []) {
    tokens.push(...bigrams(run, 'cjk:'));
  }
  for (const run of text.match(THAI_RUN) ?? []) {
    tokens.push(...bigrams(run, 'thai:'));
  }

  const stripped = text.replace(CJK_RUN, ' ').replace(THAI_RUN, ' ');
  return { tokens: tokens.slice(0, limit), stripped };
}

export function isScriptToken(token: string): boolean {
  return token.startsWith('cjk:') || token.startsWith('thai:');
}
