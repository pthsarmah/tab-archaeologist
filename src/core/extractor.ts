import type { AnalysisConfig } from '../types/config';
import type { RawTab, SkippedTab, TabDocument } from '../types/tab';
import { isGenericTitle } from './generic';
import { normalizeTitle, normalizeUrl } from './normalizer';
import { tokenize } from './tokenizer';

export interface ExtractionResult {
  documents: TabDocument[];
  skipped: SkippedTab[];
}

function safeTitle(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function urlProtocol(rawUrl: string): string | null {
  try {
    return new URL(rawUrl).protocol;
  } catch {
    return null;
  }
}

/**
 * Convert browser tab records into the browser-independent metadata model.
 * A single bad tab is skipped; it never aborts the run.
 */
export function extractDocuments(rawTabs: RawTab[], config: AnalysisConfig): ExtractionResult {
  const documents: TabDocument[] = [];
  const skipped: SkippedTab[] = [];

  for (const tab of rawTabs) {
    if (typeof tab.id !== 'number' || !Number.isFinite(tab.id)) {
      skipped.push({ reason: 'no-id' });
      continue;
    }

    const rawUrl = tab.url || tab.pendingUrl;
    if (!rawUrl) {
      skipped.push({ id: tab.id, reason: 'no-url' });
      continue;
    }

    const protocol = urlProtocol(rawUrl);
    if (protocol === null) {
      skipped.push({ id: tab.id, reason: 'invalid-url' });
      continue;
    }
    if (protocol !== 'http:' && protocol !== 'https:') {
      skipped.push({ id: tab.id, reason: 'restricted' });
      continue;
    }

    const normalizedUrl = normalizeUrl(rawUrl);
    if (!normalizedUrl) {
      skipped.push({ id: tab.id, reason: 'invalid-url' });
      continue;
    }

    const title = normalizeTitle(safeTitle(tab.title), config.maxTitleChars);
    let titleTokens = tokenize(title, config.maxTokensPerField);
    if (isGenericTitle(titleTokens)) titleTokens = [];
    const pathTokens = tokenize(normalizedUrl.path, config.maxTokensPerField);

    if (titleTokens.length === 0 && pathTokens.length === 0) {
      skipped.push({ id: tab.id, reason: 'no-metadata' });
      continue;
    }

    documents.push({
      id: tab.id,
      windowId: tab.windowId,
      title,
      hostname: normalizedUrl.hostname,
      hostKey: normalizedUrl.hostKey,
      path: normalizedUrl.path,
      titleTokens,
      pathTokens
    });
  }

  return { documents, skipped };
}
