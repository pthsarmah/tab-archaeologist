export type TruthLabel = string | string[];

export interface EvaluationCounts {
  tp: number;
  fp: number;
  fn: number;
  tn: number;
  predictedPairs: number;
  truthPairs: number;
  evaluatedTabs: number;
}

export interface EvaluationMetrics extends EvaluationCounts {
  precision: number;
  recall: number;
  f1: number;
}

export interface SessionMetrics {
  name: string;
  counts: EvaluationCounts;
  metrics: EvaluationMetrics;
}

export const AMBIGUOUS_LABEL = '__ambiguous__';

function evaluatedLabels(truth: Record<string, TruthLabel>): Map<number, string> {
  const labels = new Map<number, string>();
  for (const [rawId, label] of Object.entries(truth)) {
    const id = Number(rawId);
    if (!Number.isInteger(id)) continue;
    if (Array.isArray(label)) {
      if (label.length !== 1) continue;
      const only = label[0];
      if (!only || only === AMBIGUOUS_LABEL) continue;
      labels.set(id, only);
    } else if (label && label !== AMBIGUOUS_LABEL) {
      labels.set(id, label);
    }
  }
  return labels;
}

/**
 * Pairwise evaluation. Tabs omitted from every predicted group are treated as
 * singleton clusters, so failing to group related tabs counts as a false
 * negative rather than disappearing from the denominator.
 */
export function evaluateGroups(
  predictedGroups: number[][],
  truth: Record<string, TruthLabel>
): EvaluationCounts {
  const labels = evaluatedLabels(truth);
  const groupOf = new Map<number, number>();

  predictedGroups.forEach((group, groupIndex) => {
    for (const id of group) {
      if (!labels.has(id)) continue;
      if (groupOf.has(id)) {
        throw new Error(`Tab ${id} appears in more than one predicted group.`);
      }
      groupOf.set(id, groupIndex);
    }
  });

  const ids = [...labels.keys()].sort((a, b) => a - b);
  const counts: EvaluationCounts = {
    tp: 0,
    fp: 0,
    fn: 0,
    tn: 0,
    predictedPairs: 0,
    truthPairs: 0,
    evaluatedTabs: ids.length
  };

  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const first = ids[i]!;
      const second = ids[j]!;
      const truthSame = labels.get(first) === labels.get(second);
      const firstGroup = groupOf.get(first);
      const secondGroup = groupOf.get(second);
      const predictedSame = firstGroup !== undefined && firstGroup === secondGroup;

      if (truthSame) counts.truthPairs += 1;
      if (predictedSame) counts.predictedPairs += 1;

      if (truthSame && predictedSame) counts.tp += 1;
      else if (!truthSame && predictedSame) counts.fp += 1;
      else if (truthSame && !predictedSame) counts.fn += 1;
      else counts.tn += 1;
    }
  }

  return counts;
}

export function metricsFromCounts(counts: EvaluationCounts): EvaluationMetrics {
  const precision = counts.predictedPairs === 0 ? 0 : counts.tp / counts.predictedPairs;
  const recall = counts.truthPairs === 0 ? 0 : counts.tp / counts.truthPairs;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { ...counts, precision, recall, f1 };
}

export function aggregateCounts(sessions: EvaluationCounts[]): EvaluationCounts {
  return sessions.reduce<EvaluationCounts>(
    (total, session) => ({
      tp: total.tp + session.tp,
      fp: total.fp + session.fp,
      fn: total.fn + session.fn,
      tn: total.tn + session.tn,
      predictedPairs: total.predictedPairs + session.predictedPairs,
      truthPairs: total.truthPairs + session.truthPairs,
      evaluatedTabs: total.evaluatedTabs + session.evaluatedTabs
    }),
    {
      tp: 0,
      fp: 0,
      fn: 0,
      tn: 0,
      predictedPairs: 0,
      truthPairs: 0,
      evaluatedTabs: 0
    }
  );
}

export function macroMetrics(sessions: EvaluationMetrics[]): EvaluationMetrics {
  if (sessions.length === 0) {
    return metricsFromCounts(aggregateCounts([]));
  }
  const average = (selector: (metrics: EvaluationMetrics) => number): number =>
    sessions.reduce((total, session) => total + selector(session), 0) / sessions.length;

  return {
    ...aggregateCounts(sessions),
    precision: average((session) => session.precision),
    recall: average((session) => session.recall),
    f1: average((session) => session.f1)
  };
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
