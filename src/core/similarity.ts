import type { AnalysisConfig } from '../types/config';
import type { TabDocument } from '../types/tab';
import type { ChannelVectors } from './tfidf';
import { cosineSparse } from './tfidf';

export interface SimilarityMatrix {
  n: number;
  matrix: Float64Array;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

const SHARED_TERM_BONUS = 0.05;

function sharedTermRatio(first: string[], second: string[]): number {
  const firstTerms = new Set(first.filter((term) => term.length >= 3));
  const secondTerms = new Set(second.filter((term) => term.length >= 3));
  if (firstTerms.size === 0 || secondTerms.size === 0) return 0;

  let shared = 0;
  for (const term of firstTerms) {
    if (secondTerms.has(term)) shared += 1;
  }
  return shared / Math.min(firstTerms.size, secondTerms.size);
}

/**
 * Weighted pair score with missing-signal redistribution.
 *
 * Hostname never absorbs the weight of a missing text channel. Text channels
 * share the remaining weight; if no text signal exists for the pair, the score
 * is at most the configured hostname weight.
 */
export function pairScore(
  first: number,
  second: number,
  documents: TabDocument[],
  titleVectors: ChannelVectors,
  pathVectors: ChannelVectors,
  config: AnalysisConfig
): number {
  const a = documents[first];
  const b = documents[second];
  if (!a || !b) return 0;

  const titleAvailable =
    a.titleTokens.length > 0 &&
    b.titleTokens.length > 0 &&
    (titleVectors.vectors[first]?.size ?? 0) > 0 &&
    (titleVectors.vectors[second]?.size ?? 0) > 0;
  const pathAvailable =
    a.pathTokens.length > 0 &&
    b.pathTokens.length > 0 &&
    (pathVectors.vectors[first]?.size ?? 0) > 0 &&
    (pathVectors.vectors[second]?.size ?? 0) > 0;
  const hostAvailable = a.hostKey.length > 0 && b.hostKey.length > 0;

  const titleWeight = titleAvailable ? config.weights.title : 0;
  const pathWeight = pathAvailable ? config.weights.path : 0;
  const textWeight = titleWeight + pathWeight;
  const hostWeight = hostAvailable ? config.weights.hostname : 0;

  const hostSimilarity = hostAvailable && a.hostKey === b.hostKey ? 1 : 0;
  let score = hostWeight * hostSimilarity;

  if (textWeight > 0) {
    const scale = hostWeight > 0 ? Math.max(0, 1 - hostWeight) / textWeight : 1 / textWeight;
    if (titleWeight > 0) {
      score +=
        titleWeight *
        scale *
        cosineSparse(titleVectors.vectors[first]!, titleVectors.vectors[second]!);
    }
    if (pathWeight > 0) {
      score +=
        pathWeight *
        scale *
        cosineSparse(pathVectors.vectors[first]!, pathVectors.vectors[second]!);
    }

    // A small overlap bonus helps short titles where one strong topic term is
    // diluted by unrelated site or page-specific words.
    const titleOverlap = sharedTermRatio(a.titleTokens, b.titleTokens);
    const pathOverlap = sharedTermRatio(a.pathTokens, b.pathTokens);
    score += SHARED_TERM_BONUS * Math.max(titleOverlap, pathOverlap);
  }

  return clamp01(score);
}

export function buildSimilarityMatrix(
  documents: TabDocument[],
  titleVectors: ChannelVectors,
  pathVectors: ChannelVectors,
  config: AnalysisConfig
): SimilarityMatrix {
  const n = documents.length;
  const matrix = new Float64Array(n * n);

  for (let i = 0; i < n; i += 1) {
    matrix[i * n + i] = 1;
    for (let j = i + 1; j < n; j += 1) {
      const score = pairScore(i, j, documents, titleVectors, pathVectors, config);
      matrix[i * n + j] = score;
      matrix[j * n + i] = score;
    }
  }

  return { n, matrix };
}
