import type { SkippedTab, TabDocument } from './tab';

export interface Suggestion {
  id: string;
  tabIds: number[];
  tabs: TabDocument[];
  label: string;
  terms: string[];
  explanation: string;
  /** Mean pairwise similarity over unique member pairs. Never a probability. */
  avgSimilarity: number;
  medoidTabId: number;
}

export interface AnalysisStats {
  analyzedCount: number;
  skippedCount: number;
  clusterCount: number;
  unclusteredCount: number;
  durationMs: number;
}

export interface AnalysisResult {
  suggestions: Suggestion[];
  unclustered: TabDocument[];
  skipped: SkippedTab[];
  stats: AnalysisStats;
}
