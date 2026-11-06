# Evaluation

The evaluation checks whether the clustering pipeline produces useful groups
on hand-labelled tab sessions. It is a development smoke set, not a held-out
benchmark.

Run it with:

```bash
npm run evaluate
npm run evaluate -- --threshold=0.3
```

Results are written to `evaluation/reports/latest.md` and `latest.json`. Both
are generated and excluded from git. The authoritative session format and
scoring rules live in [`evaluation/README.md`](../evaluation/README.md).

## Dataset

Eight synthetic sessions cover the behaviours the design cares about:

| Session | Focus |
|---|---|
| `linux-and-react` | Two topics plus unrelated tabs |
| `cross-domain-linux` | Topical relation across different hostnames |
| `databases-and-cloud` | Two technology groups with noise |
| `generic-titles` | Title unusable; path must carry grouping |
| `same-domain-unrelated` | All tabs on `github.com`; hostname must not over-group |
| `duplicates-and-skipped` | Duplicate tabs and inaccessible pages |
| `cjk-tabs` | Chinese bigrams and mixed-language titles |
| `ambiguous-labels` | One tab belonging to two tasks; excluded from scoring |

Session rules:

- One primary truth label per tab.
- A tab that genuinely belongs to two tasks uses an array; multi-label tabs are
  excluded from pairwise scoring.
- Every unrelated/noise tab gets a unique label so grouping noise together is a
  false positive.
- Only analysable `http:`/`https:` tabs appear in the truth map.

## Metrics

Evaluation is pairwise:

- A **true positive** is a pair of tabs with the same truth label that the
  extension put in the same suggested group.
- A **false positive** is a pair grouped together with different truth labels.
- A **false negative** is a pair with the same truth label that was not grouped.
- Tabs missing from every suggested group are treated as singleton clusters, so
  missed groups count as false negatives.

```text
precision = TP / (TP + FP)
recall    = TP / (TP + FN)
F1        = 2 * precision * recall / (precision + recall)
```

Micro scores aggregate TP/FP/FN across sessions. Macro scores average each
session's metric. Precision or recall with no relevant pairs is reported as `0`
with the pair counts visible.

## Baselines

- **Same hostname:** connected components of exact normalised host keys.
- **Title-only:** the same pipeline with title weight `1`, path weight `0`, and
  hostname weight `0`.
- **Full model:** title/path TF-IDF plus capped hostname affinity.

## Current results

At threshold `0.18` on the eight sessions:

| Method | Precision | Recall | F1 | TP | FP | FN |
|---|---:|---:|---:|---:|---:|---:|
| Full model (micro) | 83.9% | 68.4% | 75.4% | 26 | 5 | 12 |
| Full model (macro) | 91.1% | 71.5% | 72.6% | 26 | 5 | 12 |
| Title-only (micro) | 80.6% | 65.8% | 72.5% | 25 | 6 | 13 |
| Same-hostname (micro) | 48.0% | 31.6% | 38.1% | 12 | 13 | 26 |

The full model clears the precision target of 80% and the recall target of
50% on this set. It substantially outperforms the same-hostname baseline, which
confirms that hostname-only grouping is too coarse.

The title-only baseline matches the full model on these sessions because most
sessions carry useful titles. The path channel earns its place on
`generic-titles`, where title-only scores 0% F1 and the full model reaches 100%.

## Threshold sensitivity

Micro scores on the same sessions:

| Threshold | Precision | Recall | F1 | TP | FP | FN |
|---:|---:|---:|---:|---:|---:|---:|
| 0.15 | 75.0% | 71.1% | 73.0% | 27 | 9 | 11 |
| 0.20 | 80.0% | 52.6% | 63.5% | 20 | 5 | 18 |
| **0.18** | **83.9%** | **68.4%** | **75.4%** | 26 | 5 | 12 |
| 0.25 | 95.2% | 52.6% | 67.8% | 20 | 1 | 18 |
| 0.30 | 100.0% | 28.9% | 44.9% | 11 | 0 | 27 |
| 0.35 | 100.0% | 23.7% | 38.3% | 9 | 0 | 29 |
| 0.40 | 100.0% | 23.7% | 38.3% | 9 | 0 | 29 |
| 0.50 | 100.0% | 18.4% | 31.1% | 7 | 0 | 31 |

`0.15` has the highest F1 but produces nine false-positive pairs and misses the
80% precision target. `0.25` is the chosen default: precision is high, recall
still clears the target, and false positives are almost eliminated. `0.30` and
above are too conservative on this set.

This table is a tuning aid, not a claim of general optimality. The sessions were
used during development, so the numbers are in-sample.

## Interpretation

- Recall is limited by strict average linkage and the requirement that at least
  two tabs share a term. A cluster can fragment when one tab uses different
  vocabulary.
- Precision is high because the similarity threshold filters weak pairs and the
  hostname weight is capped at `0.10`.
- The `databases-and-cloud` session has the lowest recall: the database tabs
  share general terms (`database`, `index`) but the per-tab titles differ enough
  that some pairs fall below the threshold.
- Thresholds are a trade-off. Lower values group more aggressively and raise
  false positives; higher values leave related tabs unclustered.

## Threats to validity

- Eight sessions and 38 truth pairs are a small sample. Confidence intervals
  would be wide.
- Sessions are synthetic and English-heavy, with one CJK session. They do not
  represent the diversity of real browsing.
- Truth labels are one plausible interpretation. A user might group tabs
  differently for the same task.
- Pairwise metrics reward consistency but do not measure whether a suggestion
  is useful to a person.
- Timings are measured on one machine and exclude popup rendering.
- The threshold was tuned on this set, so held-out performance is likely lower.

## Extending the evaluation

1. Add a JSON file to `evaluation/sessions/` matching
   `evaluation/schema.json`.
2. Add every analysable tab id to `truth`.
3. Give each unrelated tab a unique label.
4. Run `npm run evaluate` and inspect the per-session table.
5. Do not commit real browsing data; use synthetic domains and paraphrased
   titles.

A larger held-out collection, ideally recorded from consented participants and
manually labelled by more than one person, is the main missing piece for a
stronger claim.
