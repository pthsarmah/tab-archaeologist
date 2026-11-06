# Evaluation

## Run

```bash
npm run evaluate
```

Optional threshold override:

```bash
npm run evaluate -- --threshold=0.3
```

Reports are written to `evaluation/reports/latest.md` and `latest.json`.

## Session format

Each file in `evaluation/sessions/` uses this shape:

```json
{
  "name": "short-name",
  "notes": "optional",
  "tabs": [{ "id": 1, "title": "Page title", "url": "https://example.com/path" }],
  "truth": { "1": "task-label", "2": "task-label" }
}
```

Rules:

- One primary truth label per tab.
- A tab that genuinely belongs to two tasks uses an array; multi-label tabs are excluded from pairwise metrics.
- Each unrelated/noise tab gets a unique label, e.g. `noise-python`, `noise-coffee`.
- Include only analysable `http:` / `https:` tabs in the truth map.
- Tabs missing from every predicted group are scored as singleton clusters.
- Do not put personal browsing data in this directory. Replace real domains with stable synthetic domains while preserving equality/inequality, and paraphrase sensitive titles.

## Metrics

- Pairwise precision = TP / (TP + FP)
- Pairwise recall = TP / (TP + FN)
- F1 = harmonic mean of precision and recall
- Micro scores aggregate TP/FP/FN across sessions; macro scores average per-session scores.
- Precision or recall with no relevant pairs is reported as `0`, with pair counts visible.
- The full, title-only, and same-hostname methods use the same tab set and minimum cluster size.

## Baselines

- **Same hostname:** connected components of exact normalized host keys.
- **Title-only:** the same pipeline with title weight `1`, path weight `0`, hostname weight `0`.
- **Full model:** title/path TF-IDF plus capped hostname affinity.

The acceptance target is holdout precision ≥ 0.80 and recall ≥ 0.50. These sessions are a development smoke set, not a substitute for a larger held-out collection.
