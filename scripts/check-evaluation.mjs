import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const reportPath = resolve(projectRoot, 'evaluation/reports/latest.json');

const minimumPrecision = 0.8;
const minimumRecall = 0.5;

let report;
try {
  report = JSON.parse(readFileSync(reportPath, 'utf8'));
} catch {
  console.error(`Evaluation report not found or unreadable: ${reportPath}`);
  console.error('Run "npm run evaluate" first.');
  process.exit(1);
}

const full = report?.aggregate?.fullMicro;
if (!full || typeof full.precision !== 'number' || typeof full.recall !== 'number') {
  console.error('Evaluation report is missing aggregate.fullMicro metrics.');
  process.exit(1);
}

const percent = (value) => `${(value * 100).toFixed(1)}%`;
const failures = [];

if (full.precision < minimumPrecision) {
  failures.push(`precision ${percent(full.precision)} is below ${percent(minimumPrecision)}`);
}
if (full.recall < minimumRecall) {
  failures.push(`recall ${percent(full.recall)} is below ${percent(minimumRecall)}`);
}

if (failures.length > 0) {
  console.error(`Evaluation targets failed at threshold ${report.threshold}:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Evaluation targets met at threshold ${report.threshold}: ` +
    `precision ${percent(full.precision)}, recall ${percent(full.recall)}.`
);
