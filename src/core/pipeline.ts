import type { AnalysisConfig, PartialAnalysisConfig } from '../types/config';
import type { AnalysisResult } from '../types/cluster';
import type { RawTab } from '../types/tab';
import { clusterSimilarityMatrix } from './clustering';
import { validateConfig } from './config';
import { extractDocuments } from './extractor';
import { buildSuggestions } from './labeling';
import { buildSimilarityMatrix } from './similarity';
import { buildChannelVectors } from './tfidf';

export type AnalysisErrorCode = 'TOO_MANY_TABS';

export class AnalysisError extends Error {
  readonly code: AnalysisErrorCode;

  constructor(code: AnalysisErrorCode, message: string) {
    super(message);
    this.name = 'AnalysisError';
    this.code = code;
  }
}

function now(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

/**
 * The complete browser-independent analysis pipeline.
 *
 * No browser API, network call, storage write, or tab mutation occurs here.
 */
export function analyzeTabs(
  rawTabs: RawTab[],
  partialConfig: PartialAnalysisConfig = {}
): AnalysisResult {
  const config: AnalysisConfig = validateConfig(partialConfig);
  if (rawTabs.length > config.maxTabs) {
    throw new AnalysisError(
      'TOO_MANY_TABS',
      `This analysis is limited to ${config.maxTabs} tabs. Close some tabs or raise the limit.`
    );
  }

  const startedAt = now();
  const { documents, skipped } = extractDocuments(rawTabs, config);
  const titleVectors = buildChannelVectors(documents.map((document) => document.titleTokens));
  const pathVectors = buildChannelVectors(documents.map((document) => document.pathTokens));
  const { matrix } = buildSimilarityMatrix(documents, titleVectors, pathVectors, config);
  const clustered = clusterSimilarityMatrix(
    matrix,
    documents.length,
    config.threshold,
    config.minClusterSize
  );
  const suggestions = buildSuggestions(
    documents,
    clustered.clusters,
    titleVectors,
    pathVectors,
    matrix,
    config
  );

  const unclustered = clustered.unclustered
    .map((index) => documents[index]!)
    .sort((first, second) => first.id - second.id);

  const durationMs = Math.round((now() - startedAt) * 100) / 100;

  return {
    suggestions,
    unclustered,
    skipped,
    stats: {
      analyzedCount: documents.length,
      skippedCount: skipped.length,
      clusterCount: suggestions.length,
      unclusteredCount: unclustered.length,
      durationMs
    }
  };
}
