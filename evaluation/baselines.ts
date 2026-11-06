import { normalizeUrl } from '../src/core/normalizer';
import { analyzeTabs } from '../src/core/pipeline';
import type { RawTab } from '../src/types/tab';

export function sameHostnameGroups(tabs: RawTab[]): number[][] {
  const groups = new Map<string, number[]>();

  for (const tab of tabs) {
    if (typeof tab.id !== 'number' || !tab.url) continue;
    const normalized = normalizeUrl(tab.url);
    if (!normalized) continue;
    const existing = groups.get(normalized.hostKey) ?? [];
    existing.push(tab.id);
    groups.set(normalized.hostKey, existing);
  }

  return [...groups.values()]
    .filter((group) => group.length >= 2)
    .map((group) => [...group].sort((a, b) => a - b));
}

export function titleOnlyGroups(tabs: RawTab[], threshold: number): number[][] {
  const result = analyzeTabs(tabs, {
    threshold,
    weights: { title: 1, path: 0, hostname: 0 }
  });
  return result.suggestions.map((suggestion) => suggestion.tabIds);
}

export function fullGroups(tabs: RawTab[], threshold: number): number[][] {
  return analyzeTabs(tabs, { threshold }).suggestions.map((suggestion) => suggestion.tabIds);
}
