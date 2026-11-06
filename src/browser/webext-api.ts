export interface WebExtTab {
  id?: number;
  title?: string;
  url?: string;
  pendingUrl?: string;
  windowId?: number;
  active?: boolean;
  pinned?: boolean;
  status?: string;
}

export interface WebExtApi {
  tabs: {
    query(queryInfo: { currentWindow?: boolean; windowId?: number }): Promise<WebExtTab[]>;
    update(tabId: number, properties: { active?: boolean }): Promise<unknown>;
    group?: (options: { tabIds: number[] }) => Promise<number>;
  };
  tabGroups?: {
    update(groupId: number, properties: { title?: string }): Promise<unknown>;
  };
  windows?: {
    update(windowId: number, properties: { focused?: boolean }): Promise<unknown>;
  };
}

interface WebExtGlobals {
  browser?: WebExtApi;
  chrome?: WebExtApi;
}

/**
 * Firefox exposes `browser`; Chromium MV3 exposes `chrome` with promise-based
 * APIs in supported versions. This facade keeps the rest of the code neutral.
 */
export function getWebExtApi(): WebExtApi | null {
  const globals = globalThis as unknown as WebExtGlobals;
  if (globals.browser?.tabs) return globals.browser;
  if (globals.chrome?.tabs) return globals.chrome;
  return null;
}
