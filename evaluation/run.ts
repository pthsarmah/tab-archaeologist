import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeTabs } from '../src/core/pipeline';
import type { RawTab } from '../src/types/tab';
import { sameHostnameGroups, titleOnlyGroups } from './baselines';
import {
  aggregateCounts,
  evaluateGroups,
  formatPercent,
  macroMetrics,
  metricsFromCounts,
  type EvaluationCounts,
  type TruthLabel
} from './metrics';

interface SessionFile {
  name: string;
  notes?: string;
  tabs: RawTab[];
  truth: Record<string, TruthLabel>;
}

const root = fileURLToPath(new URL('..', import.meta.url));
const sessionDir = resolve(root, 'evaluation/sessions');
const reportDir = resolve(root, 'evaluation/reports');
const threshold = Number.parseFloat(
  process.argv.find((argument) => argument.startsWith('--threshold='))?.split('=')[1] ?? '0.18'
);

function loadSessions(): SessionFile[] {
  const files = readdirSync(sessionDir)
    .filter((file) => file.endsWith('.json'))
    .sort();
  if (files.length === 0) throw new Error('No evaluation sessions found.');

  return files.map((file) => {
    const session = JSON.parse(readFileSync(resolve(sessionDir, file), 'utf8')) as SessionFile;
    if (!session.name || !Array.isArray(session.tabs) || !session.truth) {
      throw new Error(`Invalid session: ${file}`);
    }
    const tabIds = new Set(session.tabs.map((tab) => tab.id));
    for (const id of Object.keys(session.truth)) {
      if (!tabIds.has(Number(id))) {
        throw new Error(`${file}: truth includes missing tab ${id}`);
      }
    }
    return session;
  });
}

interface MethodResult {
  name: string;
  counts: EvaluationCounts;
  predictedGroups: number;
}

const sessions = loadSessions();
const rows: Array<{
  session: SessionFile;
  full: MethodResult;
  titleOnly: MethodResult;
  hostname: MethodResult;
  runtimeMs: number;
  clusters: number;
  unclustered: number;
  skipped: number;
}> = [];

for (const session of sessions) {
  const result = analyzeTabs(session.tabs, { threshold });
  const fullGroups = result.suggestions.map((suggestion) => suggestion.tabIds);
  const fullCounts = evaluateGroups(fullGroups, session.truth);
  const titleCounts = evaluateGroups(titleOnlyGroups(session.tabs, threshold), session.truth);
  const hostCounts = evaluateGroups(sameHostnameGroups(session.tabs), session.truth);

  rows.push({
    session,
    full: { name: 'full', counts: fullCounts, predictedGroups: fullGroups.length },
    titleOnly: {
      name: 'title-only',
      counts: titleCounts,
      predictedGroups: titleOnlyGroups(session.tabs, threshold).length
    },
    hostname: {
      name: 'same-hostname',
      counts: hostCounts,
      predictedGroups: sameHostnameGroups(session.tabs).length
    },
    runtimeMs: result.stats.durationMs,
    clusters: result.stats.clusterCount,
    unclustered: result.stats.unclusteredCount,
    skipped: result.stats.skippedCount
  });
}

const fullMicro = metricsFromCounts(aggregateCounts(rows.map((row) => row.full.counts)));
const fullMacro = macroMetrics(rows.map((row) => metricsFromCounts(row.full.counts)));
const titleMicro = metricsFromCounts(aggregateCounts(rows.map((row) => row.titleOnly.counts)));
const hostMicro = metricsFromCounts(aggregateCounts(rows.map((row) => row.hostname.counts)));

const tableRows = rows
  .map((row) => {
    const full = metricsFromCounts(row.full.counts);
    const title = metricsFromCounts(row.titleOnly.counts);
    const host = metricsFromCounts(row.hostname.counts);
    return `| ${row.session.name} | ${row.session.tabs.length} | ${row.clusters} | ${row.unclustered} | ${
      row.skipped
    } | ${formatPercent(full.precision)} | ${formatPercent(full.recall)} | ${formatPercent(
      full.f1
    )} | ${formatPercent(title.f1)} | ${formatPercent(host.f1)} | ${row.runtimeMs.toFixed(1)} |`;
  })
  .join('\n');

const markdown = `# Tab Archaeologist Evaluation

Threshold: \`${threshold}\`
Sessions: ${sessions.length}
Generated: ${new Date().toISOString()}

## Aggregate

| Method | Precision | Recall | F1 | TP | FP | FN | Predicted pairs | Truth pairs |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Weighted full model (micro) | ${formatPercent(fullMicro.precision)} | ${formatPercent(
  fullMicro.recall
)} | ${formatPercent(fullMicro.f1)} | ${fullMicro.tp} | ${fullMicro.fp} | ${fullMicro.fn} | ${
  fullMicro.predictedPairs
} | ${fullMicro.truthPairs} |
| Weighted full model (macro) | ${formatPercent(fullMacro.precision)} | ${formatPercent(
  fullMacro.recall
)} | ${formatPercent(fullMacro.f1)} | ${fullMacro.tp} | ${fullMacro.fp} | ${fullMacro.fn} | ${
  fullMacro.predictedPairs
} | ${fullMacro.truthPairs} |
| Title-only TF-IDF (micro) | ${formatPercent(titleMicro.precision)} | ${formatPercent(
  titleMicro.recall
)} | ${formatPercent(titleMicro.f1)} | ${titleMicro.tp} | ${titleMicro.fp} | ${titleMicro.fn} | ${
  titleMicro.predictedPairs
} | ${titleMicro.truthPairs} |
| Same-hostname (micro) | ${formatPercent(hostMicro.precision)} | ${formatPercent(
  hostMicro.recall
)} | ${formatPercent(hostMicro.f1)} | ${hostMicro.tp} | ${hostMicro.fp} | ${hostMicro.fn} | ${
  hostMicro.predictedPairs
} | ${hostMicro.truthPairs} |

## Per session

| Session | Tabs | Groups | Unclustered | Skipped | Full P | Full R | Full F1 | Title F1 | Host F1 | ms |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
${tableRows}

## Notes

- Tabs left unclustered are scored as singleton clusters.
- Ambiguous and missing truth labels are excluded from pair counts.
- Each unrelated tab has its own truth label, so clustering noise together counts as a false positive.
- Runtime is measured inside the analysis pipeline, not by the harness.
`;

mkdirSync(reportDir, { recursive: true });
writeFileSync(resolve(reportDir, 'latest.md'), markdown);
writeFileSync(
  resolve(reportDir, 'latest.json'),
  `${JSON.stringify(
    {
      threshold,
      sessions: rows.map((row) => ({
        name: row.session.name,
        tabs: row.session.tabs.length,
        clusters: row.clusters,
        unclustered: row.unclustered,
        skipped: row.skipped,
        runtimeMs: row.runtimeMs,
        full: metricsFromCounts(row.full.counts),
        titleOnly: metricsFromCounts(row.titleOnly.counts),
        hostname: metricsFromCounts(row.hostname.counts)
      })),
      aggregate: {
        fullMicro,
        fullMacro,
        titleMicro,
        hostMicro
      }
    },
    null,
    2
  )}\n`
);

console.log(`Evaluated ${sessions.length} sessions at threshold ${threshold}.`);
console.log(
  `Full model: precision ${formatPercent(fullMicro.precision)}, recall ${formatPercent(
    fullMicro.recall
  )}, F1 ${formatPercent(fullMicro.f1)}`
);
console.log(`Report: evaluation/reports/latest.md`);
