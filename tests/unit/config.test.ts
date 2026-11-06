import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, validateConfig } from '../../src/core/config';

describe('config validation', () => {
  it('returns defaults for an empty partial config', () => {
    expect(validateConfig()).toEqual(DEFAULT_CONFIG);
  });

  it('normalises weights to one', () => {
    const config = validateConfig({ weights: { title: 2, path: 1, hostname: 1 } });
    expect(config.weights.title + config.weights.path + config.weights.hostname).toBeCloseTo(1);
    expect(config.weights.title).toBeCloseTo(0.5);
  });

  it('clamps threshold, minimum size and limits', () => {
    const config = validateConfig({
      threshold: 4,
      minClusterSize: 0,
      maxTabs: -2,
      maxTitleChars: 1,
      maxTokensPerField: 0,
      maxLabelTerms: 19
    });
    expect(config.threshold).toBe(1);
    expect(config.minClusterSize).toBe(2);
    expect(config.maxTabs).toBe(1);
    expect(config.maxTitleChars).toBe(20);
    expect(config.maxTokensPerField).toBe(1);
    expect(config.maxLabelTerms).toBe(5);
  });

  it('falls back for non-finite values', () => {
    const config = validateConfig({
      threshold: Number.NaN,
      weights: { title: Number.POSITIVE_INFINITY }
    });
    expect(config.threshold).toBe(DEFAULT_CONFIG.threshold);
    expect(Number.isFinite(config.weights.title)).toBe(true);
  });
});
