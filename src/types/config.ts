export interface AnalysisWeights {
  title: number;
  path: number;
  hostname: number;
}

export interface AnalysisConfig {
  weights: AnalysisWeights;
  threshold: number;
  minClusterSize: number;
  maxTabs: number;
  maxTitleChars: number;
  maxTokensPerField: number;
  maxLabelTerms: number;
}

export type PartialAnalysisConfig = {
  weights?: Partial<AnalysisWeights>;
  threshold?: number;
  minClusterSize?: number;
  maxTabs?: number;
  maxTitleChars?: number;
  maxTokensPerField?: number;
  maxLabelTerms?: number;
};
