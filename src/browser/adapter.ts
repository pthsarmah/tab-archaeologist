import type { RawTab } from '../types/tab';
import { getWebExtApi, type WebExtApi, type WebExtTab } from './webext-api';

export type BrowserErrorCode =
  | 'API_UNAVAILABLE'
  | 'QUERY_FAILED'
  | 'UPDATE_FAILED'
  | 'GROUP_UNAVAILABLE'
  | 'GROUP_FAILED';

export class BrowserApiError extends Error {
  readonly code: BrowserErrorCode;

  constructor(code: BrowserErrorCode, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'BrowserApiError';
    this.code = code;
    if (options?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function toRawTab(tab: WebExtTab): RawTab {
  return {
    id: optionalNumber(tab.id),
    title: optionalString(tab.title),
    url: optionalString(tab.url),
    pendingUrl: optionalString(tab.pendingUrl),
    windowId: optionalNumber(tab.windowId)
  };
}

/** Query the current window only; never another window or the full history. */
export async function fetchCurrentWindowTabs(api: WebExtApi | null = getWebExtApi()): Promise<RawTab[]> {
  if (!api) {
    throw new BrowserApiError(
      'API_UNAVAILABLE',
      'This browser does not expose the WebExtension tabs API.'
    );
  }

  try {
    const tabs = await api.tabs.query({ currentWindow: true });
    if (!Array.isArray(tabs)) {
      throw new BrowserApiError('QUERY_FAILED', 'The browser returned an invalid tab list.');
    }
    return tabs.map(toRawTab);
  } catch (error) {
    if (error instanceof BrowserApiError) throw error;
    throw new BrowserApiError(
      'QUERY_FAILED',
      'Tab metadata could not be read. Check that the extension has tab access.',
      { cause: error }
    );
  }
}

/**
 * Chromium and Firefox omit `url`, `pendingUrl` and often `title` when the
 * `tabs` permission is missing. Detect that instead of reporting "0 tabs".
 */
export function hasTabAccessProblem(tabs: RawTab[]): boolean {
  return (
    tabs.length > 0 &&
    tabs.every((tab) => !tab.url && !tab.pendingUrl)
  );
}

/** The only mutation: user-requested activation of an existing tab. */
export async function activateTab(
  tabId: number,
  windowId?: number,
  api: WebExtApi | null = getWebExtApi()
): Promise<void> {
  if (!api) {
    throw new BrowserApiError(
      'API_UNAVAILABLE',
      'This browser does not expose the WebExtension tabs API.'
    );
  }

  try {
    await api.tabs.update(tabId, { active: true });
  } catch (error) {
    throw new BrowserApiError('UPDATE_FAILED', 'That tab is no longer available.', {
      cause: error
    });
  }

  if (typeof windowId === 'number' && api.windows) {
    try {
      await api.windows.update(windowId, { focused: true });
    } catch {
      // Activation succeeded; focus failure is not worth blocking the user.
    }
  }

}

/** Create a native browser tab group when the browser supports it. */
export async function createTabGroup(
  tabIds: number[],
  title: string,
  api: WebExtApi | null = getWebExtApi()
): Promise<void> {
  if (!api) {
    throw new BrowserApiError(
      'API_UNAVAILABLE',
      'This browser does not expose the WebExtension tabs API.'
    );
  }
  if (!api.tabs.group || !api.tabGroups) {
    throw new BrowserApiError(
      'GROUP_UNAVAILABLE',
      'This browser does not support native tab groups. The suggestion remains unchanged.'
    );
  }
  const validTabIds = tabIds.filter((id) => Number.isInteger(id));
  if (validTabIds.length < 2) {
    throw new BrowserApiError('GROUP_FAILED', 'A browser group needs at least two open tabs.');
  }

  try {
    const groupId = await api.tabs.group({ tabIds: validTabIds });
    await api.tabGroups.update(groupId, { title: title.trim().slice(0, 60) || 'Tab group' });
  } catch (error) {
    throw new BrowserApiError('GROUP_FAILED', 'The browser group could not be created.', {
      cause: error
    });
  }
}
