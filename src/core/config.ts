import type { AnalysisConfig, PartialAnalysisConfig } from '../types/config';

export const DEFAULT_CONFIG: AnalysisConfig = {
  weights: {
    title: 0.65,
    path: 0.25,
    hostname: 0.1
  },
  // Tuned on the sample sessions; keeps moderately similar cross-site tabs.
  threshold: 0.18,
  minClusterSize: 2,
  maxTabs: 500,
  maxTitleChars: 300,
  maxTokensPerField: 80,
  maxLabelTerms: 3
};

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Validate and normalise user-provided configuration. Invalid values fall back
 * to defaults instead of causing a failed analysis.
 */
export function validateConfig(partial: PartialAnalysisConfig = {}): AnalysisConfig {
  const requested = partial.weights ?? {};
  const rawWeights = {
    title: finite(requested.title, DEFAULT_CONFIG.weights.title),
    path: finite(requested.path, DEFAULT_CONFIG.weights.path),
    hostname: finite(requested.hostname, DEFAULT_CONFIG.weights.hostname)
  };

  const nonNegative = {
    title: Math.max(0, rawWeights.title),
    path: Math.max(0, rawWeights.path),
    hostname: Math.max(0, rawWeights.hostname)
  };
  const total = nonNegative.title + nonNegative.path + nonNegative.hostname;

  const weights =
    total > 0
      ? {
          title: nonNegative.title / total,
          path: nonNegative.path / total,
          hostname: nonNegative.hostname / total
        }
      : { ...DEFAULT_CONFIG.weights };

  return {
    weights,
    threshold: clamp(finite(partial.threshold, DEFAULT_CONFIG.threshold), 0, 1),
    minClusterSize: Math.max(
      2,
      Math.floor(finite(partial.minClusterSize, DEFAULT_CONFIG.minClusterSize))
    ),
    maxTabs: Math.max(1, Math.floor(finite(partial.maxTabs, DEFAULT_CONFIG.maxTabs))),
    maxTitleChars: Math.max(
      20,
      Math.floor(finite(partial.maxTitleChars, DEFAULT_CONFIG.maxTitleChars))
    ),
    maxTokensPerField: Math.max(
      1,
      Math.floor(finite(partial.maxTokensPerField, DEFAULT_CONFIG.maxTokensPerField))
    ),
    maxLabelTerms: clamp(
      Math.floor(finite(partial.maxLabelTerms, DEFAULT_CONFIG.maxLabelTerms)),
      1,
      5
    )
  };
}
