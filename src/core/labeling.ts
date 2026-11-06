import type { AnalysisConfig } from '../types/config';
import type { Suggestion } from '../types/cluster';
import type { TabDocument } from '../types/tab';
import { isGenericLabelTerm } from './generic';
import type { ChannelVectors } from './tfidf';
import { displayTerm } from './tokenizer';

interface TermStats {
  weight: number;
  documents: Set<number>;
}

function truncateLabel(label: string, maxLength = 60): string {
  if (label.length <= maxLength) return label;
  const cut = label.slice(0, maxLength);
  const boundary = cut.lastIndexOf(' ');
  return `${(boundary > 12 ? cut.slice(0, boundary) : cut).trimEnd()}…`;
}

function medianIndex(
  members: number[],
  documents: TabDocument[],
  matrix: Float64Array,
  n: number
): number {
  if (members.length === 0) return 0;
  if (members.length === 1) return members[0]!;

  let bestIndex = members[0]!;
  let bestAverage = -1;
  for (const member of members) {
    let total = 0;
    for (const other of members) {
      if (member === other) continue;
      total += matrix[member * n + other] ?? 0;
    }
    const average = total / (members.length - 1);
    if (
      average > bestAverage ||
      (average === bestAverage && documents[member]!.id < documents[bestIndex]!.id)
    ) {
      bestAverage = average;
      bestIndex = member;
    }
  }
  return bestIndex;
}

function averageWithinSimilarity(members: number[], matrix: Float64Array, n: number): number {
  if (members.length < 2) return 0;
  let total = 0;
  let pairs = 0;
  for (let i = 0; i < members.length; i += 1) {
    for (let j = i + 1; j < members.length; j += 1) {
      total += matrix[members[i]! * n + members[j]!] ?? 0;
      pairs += 1;
    }
  }
  return pairs === 0 ? 0 : Math.min(1, Math.max(0, total / pairs));
}

function aggregateTerms(
  members: number[],
  titleVectors: ChannelVectors,
  pathVectors: ChannelVectors,
  config: AnalysisConfig
): Map<string, TermStats> {
  const stats = new Map<string, TermStats>();

  for (const member of members) {
    const title = titleVectors.vectors[member];
    if (title) {
      for (const [term, value] of title) {
        const current = stats.get(term) ?? { weight: 0, documents: new Set<number>() };
        current.weight += config.weights.title * value;
        current.documents.add(member);
        stats.set(term, current);
      }
    }

    const path = pathVectors.vectors[member];
    if (path) {
      for (const [term, value] of path) {
        const current = stats.get(term) ?? { weight: 0, documents: new Set<number>() };
        current.weight += config.weights.path * value;
        current.documents.add(member);
        stats.set(term, current);
      }
    }
  }

  return stats;
}

function formatTermList(terms: string[]): string {
  if (terms.length === 0) return '';
  if (terms.length === 1) return `"${terms[0]}"`;
  if (terms.length === 2) return `"${terms[0]}" and "${terms[1]}"`;
  return `${terms
    .slice(0, -1)
    .map((term) => `"${term}"`)
    .join(', ')}, and "${terms[terms.length - 1]}"`;
}

function fallbackLabel(
  members: number[],
  documents: TabDocument[],
  medoid: number
): string {
  const title = documents[medoid]?.title.trim();
  if (title) return title;
  const hostname = documents[medoid]?.hostname.trim();
  if (hostname) return hostname;
  const firstHostname = documents[members[0]!]?.hostname.trim();
  return firstHostname || 'Untitled group';
}

/**
 * Build labels, explanations and strength values for every cluster.
 * Label terms must appear in at least two member tabs (or half the cluster for
 * larger groups), so the explanation never claims a "shared" term that only one
 * tab contains.
 */
export function buildSuggestions(
  documents: TabDocument[],
  clusters: number[][],
  titleVectors: ChannelVectors,
  pathVectors: ChannelVectors,
  matrix: Float64Array,
  config: AnalysisConfig
): Suggestion[] {
  const n = documents.length;
  const suggestions: Suggestion[] = [];

  for (const members of clusters) {
    if (members.length === 0) continue;

    const medoid = medianIndex(members, documents, matrix, n);
    const average = averageWithinSimilarity(members, matrix, n);
    const termStats = aggregateTerms(members, titleVectors, pathVectors, config);
    const requiredDocuments = Math.max(2, Math.ceil(members.length / 2));

    const candidates = [...termStats.entries()]
      .filter(([term, stats]) => {
        if (isGenericLabelTerm(term)) return false;
        return stats.weight > 0 && stats.documents.size >= requiredDocuments;
      })
      .sort(([firstTerm, first], [secondTerm, second]) => {
        if (second.weight !== first.weight) return second.weight - first.weight;
        return firstTerm.localeCompare(secondTerm);
      })
      .slice(0, config.maxLabelTerms);

    const terms = candidates.map(([term]) => displayTerm(term));
    const keywordLabel = terms.join(' · ');
    const label = truncateLabel(keywordLabel || fallbackLabel(members, documents, medoid));

    const sharedTerms = formatTermList(terms);
    const hasTitles = members.every((member) => (documents[member]?.titleTokens.length ?? 0) > 0);
    const hasPaths = members.every((member) => (documents[member]?.pathTokens.length ?? 0) > 0);
    const channelText =
      hasTitles && hasPaths ? 'titles and paths' : hasTitles ? 'titles' : hasPaths ? 'paths' : 'metadata';

    let explanation = sharedTerms
      ? `Grouped because the tabs share the terms ${sharedTerms}.`
      : `Grouped because the tabs have similar ${channelText}.`;

    const hostKeys = new Set(members.map((member) => documents[member]?.hostKey ?? ''));
    if (hostKeys.size === 1 && !hostKeys.has('')) {
      explanation += ' They are also from the same site.';
    }
    explanation += ` Average similarity ${average.toFixed(2)}.`;

    const memberTabs = members
      .map((member) => documents[member]!)
      .sort((first, second) => first.id - second.id);

    suggestions.push({
      id: `cluster-${Math.min(...members.map((member) => documents[member]!.id))}`,
      tabIds: memberTabs.map((document) => document.id),
      tabs: memberTabs,
      label,
      terms,
      explanation,
      avgSimilarity: Math.round(average * 100) / 100,
      medoidTabId: documents[medoid]!.id
    });
  }

  suggestions.sort((first, second) => {
    if (second.avgSimilarity !== first.avgSimilarity) {
      return second.avgSimilarity - first.avgSimilarity;
    }
    return Math.min(...first.tabIds) - Math.min(...second.tabIds);
  });

  // Make duplicate display labels distinguishable without changing the browser.
  const seen = new Map<string, number>();
  for (const suggestion of suggestions) {
    const original = suggestion.label;
    const count = seen.get(original) ?? 0;
    seen.set(original, count + 1);
    if (count > 0) suggestion.label = `${original} (${count + 1})`;
  }

  return suggestions;
}
