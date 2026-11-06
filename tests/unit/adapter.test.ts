import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BrowserApiError,
  activateTab,
  fetchCurrentWindowTabs,
  hasTabAccessProblem
} from '../../src/browser/adapter';
import { getWebExtApi, type WebExtApi } from '../../src/browser/webext-api';

function apiWith(overrides: Partial<WebExtApi['tabs']> = {}): WebExtApi {
  return {
    tabs: {
      query: vi.fn(async () => []),
      update: vi.fn(async () => undefined),
      ...overrides
    },
    windows: {
      update: vi.fn(async () => undefined)
    }
  };
}

afterEach(() => {
  delete (globalThis as { browser?: unknown }).browser;
  delete (globalThis as { chrome?: unknown }).chrome;
});

describe('browser adapter', () => {
  it('queries only the current window and maps tab fields', async () => {
    const query = vi.fn(async () => [
      {
        id: 4,
        title: 'Linux',
        url: 'https://example.test/linux',
        windowId: 2,
        active: true,
        pinned: false
      }
    ]);
    const api = apiWith({ query });

    const tabs = await fetchCurrentWindowTabs(api);

    expect(query).toHaveBeenCalledWith({ currentWindow: true });
    expect(tabs).toEqual([
      {
        id: 4,
        title: 'Linux',
        url: 'https://example.test/linux',
        pendingUrl: undefined,
        windowId: 2
      }
    ]);
  });

  it('rejects when the tabs API is unavailable or returns a bad list', async () => {
    await expect(fetchCurrentWindowTabs(null)).rejects.toMatchObject({
      code: 'API_UNAVAILABLE'
    });

    const bad = apiWith({
      query: vi.fn(async () => null as never)
    });
    await expect(fetchCurrentWindowTabs(bad)).rejects.toMatchObject({
      code: 'QUERY_FAILED'
    });
  });

  it('wraps query failures in a typed browser error', async () => {
    const api = apiWith({
      query: vi.fn(async () => {
        throw new Error('permission denied');
      })
    });
    await expect(fetchCurrentWindowTabs(api)).rejects.toBeInstanceOf(BrowserApiError);
  });

  it('detects a window where every tab is missing URL metadata', () => {
    expect(hasTabAccessProblem([])).toBe(false);
    expect(hasTabAccessProblem([{ id: 1, title: 'A' }])).toBe(true);
    expect(
      hasTabAccessProblem([{ id: 1, title: 'A' }, { id: 2, pendingUrl: 'https://a.test' }])
    ).toBe(false);
  });

  it('activates the tab and focuses its window', async () => {
    const update = vi.fn(async () => undefined);
    const focus = vi.fn(async () => undefined);
    const api = apiWith({ update });
    api.windows = { update: focus };

    await activateTab(9, 3, api);

    expect(update).toHaveBeenCalledWith(9, { active: true });
    expect(focus).toHaveBeenCalledWith(3, { focused: true });
  });

  it('does not fail activation when focusing the window fails', async () => {
    const api = apiWith({ update: vi.fn(async () => undefined) });
    api.windows = {
      update: vi.fn(async () => {
        throw new Error('cannot focus');
      })
    };

    await expect(activateTab(9, 3, api)).resolves.toBeUndefined();
  });

  it('reports a tab that is no longer available', async () => {
    const api = apiWith({
      update: vi.fn(async () => {
        throw new Error('No tab with id 9');
      })
    });

    await expect(activateTab(9, undefined, api)).rejects.toMatchObject({
      code: 'UPDATE_FAILED'
    });
  });

  it('creates and names a native browser group', async () => {
    const group = vi.fn(async () => 12);
    const updateGroup = vi.fn(async () => undefined);
    const api = apiWith({ group });
    api.tabGroups = { update: updateGroup };

    const { createTabGroup } = await import('../../src/browser/adapter');
    await createTabGroup([3, 4], 'Linux', api);

    expect(group).toHaveBeenCalledWith({ tabIds: [3, 4] });
    expect(updateGroup).toHaveBeenCalledWith(12, { title: 'Linux' });
  });

  it('reports unsupported native groups explicitly', async () => {
    const { createTabGroup } = await import('../../src/browser/adapter');
    await expect(createTabGroup([3, 4], 'Linux', apiWith())).rejects.toMatchObject({
      code: 'GROUP_UNAVAILABLE'
    });
  });

  it('prefers the browser namespace and falls back to chrome', () => {
    expect(getWebExtApi()).toBeNull();

    const chrome = apiWith();
    (globalThis as { chrome?: WebExtApi }).chrome = chrome;
    expect(getWebExtApi()).toBe(chrome);

    const browser = apiWith();
    (globalThis as { browser?: WebExtApi }).browser = browser;
    expect(getWebExtApi()).toBe(browser);
  });
});
