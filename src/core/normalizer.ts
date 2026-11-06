const GENERIC_PATH_SEGMENTS: ReadonlySet<string> = new Set([
  'aspx',
  'default',
  'htm',
  'html',
  'index',
  'jsp',
  'php',
  'www'
]);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX_PATTERN = /^[0-9a-f]{16,}$/i;
const LONG_NUMBER_PATTERN = /^\d{6,}$/;

export interface NormalizedUrl {
  hostname: string;
  hostKey: string;
  path: string;
}

export function normalizeTitle(input: string, maxChars: number): string {
  const normalised = input
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (normalised.length <= maxChars) return normalised;
  return normalised.slice(0, maxChars).trimEnd();
}

function normalisePathSegment(rawSegment: string): string {
  let decoded = rawSegment;
  try {
    decoded = decodeURIComponent(rawSegment);
  } catch {
    decoded = rawSegment;
  }

  const withoutParams = decoded.split(';')[0] ?? '';
  const segment = withoutParams
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\.(?:html?|php|aspx?|jsp)$/i, '')
    .trim();

  if (!segment) return '';
  if (GENERIC_PATH_SEGMENTS.has(segment)) return '';
  if (UUID_PATTERN.test(segment)) return '';
  if (HEX_PATTERN.test(segment)) return '';
  if (LONG_NUMBER_PATTERN.test(segment)) return '';

  return segment.replace(/[\\/]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function normaliseHostname(hostname: string): string {
  const lower = hostname.toLowerCase().replace(/\.$/, '');
  return lower.startsWith('www.') ? lower.slice(4) : lower;
}

export function normalizePath(pathname: string): string {
  return pathname
    .split('/')
    .map(normalisePathSegment)
    .filter(Boolean)
    .join(' ')
    .trim();
}

export function normalizeUrl(rawUrl: string): NormalizedUrl | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (!url.hostname) return null;

  const hostname = normaliseHostname(url.hostname);
  if (!hostname) return null;

  const hostKey = url.port ? `${hostname}:${url.port}` : hostname;
  return {
    hostname,
    hostKey,
    path: normalizePath(url.pathname)
  };
}
