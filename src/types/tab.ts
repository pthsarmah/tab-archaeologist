export type SkipReason =
  | 'no-id'
  | 'no-url'
  | 'restricted'
  | 'invalid-url'
  | 'no-metadata';

/** Minimal tab shape returned by the browser adapter. */
export interface RawTab {
  id?: number;
  title?: string;
  url?: string;
  pendingUrl?: string;
  windowId?: number;
}

export interface TabDocument {
  id: number;
  windowId?: number;
  title: string;
  hostname: string;
  hostKey: string;
  path: string;
  titleTokens: string[];
  pathTokens: string[];
}

export interface SkippedTab {
  id?: number;
  reason: SkipReason;
}
