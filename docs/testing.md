# Testing

The project uses [Vitest](https://vitest.dev/) for unit, property, integration,
UI, and build tests. There are currently 14 test files and 111 tests.

## Commands

```bash
npm test               # run once
npm run test:watch     # watch mode
npm run test:coverage  # V8 coverage for src/core and src/browser
npm run typecheck      # tsc --noEmit
npm run verify         # typecheck + tests + both builds + Firefox lint
```

`npm run verify` is the pre-release gate. It is also what CI runs.

## Test layers

| Layer | Location | What it covers |
|---|---|---|
| Unit | `tests/unit/` | Config, normalisation, tokenisation, TF-IDF, similarity, clustering, labelling, extraction, browser adapter |
| Property | `tests/property/` | Invariants over generated text and matrices using `fast-check` |
| Integration | `tests/integration/` | End-to-end pipeline behaviour on realistic tab sessions |
| UI | `tests/ui/` | Popup controller, rendering, actions, and error states in jsdom |
| Evaluation | `tests/evaluation/` | Pairwise metric correctness and label handling |
| Build | `tests/build/` | Manifest privacy invariants and built asset paths |

### Unit tests

- `config.test.ts` — defaults, weight normalisation, clamping, non-finite
  fallbacks.
- `normalizer.test.ts` — query/fragment removal, `www` and port handling, IDN
  hosts, path identifiers, matrix parameters, extension handling, malformed
  URLs.
- `tokenizer.test.ts` — camel/snake/kebab splitting, technical terms, stop
  words, CJK and Thai bigrams, mixed scripts, caps.
- `tfidf.test.ts` — smoothed IDF, rare-term weighting, unit norms, separate
  channels, deterministic vocabulary, sparse cosine.
- `similarity.test.ts` — identical metadata, hostname cap, port sensitivity,
  missing-channel redistribution, symmetry and bounds.
- `clustering.test.ts` — empty/single input, threshold boundaries, average
  linkage, complete partitions, NaN handling, determinism.
- `labeling.test.ts` — shared terms, generic-term exclusion, medoid fallback,
  CJK fallback, path-only wording, duplicate labels, medoid ties.
- `extractor.test.ts` — valid tabs, pending URLs, skip reasons, generic titles,
  duplicates, truncation.
- `adapter.test.ts` — current-window query, field mapping, typed errors,
  permission detection, tab activation, window focus, and namespace selection.

### Property tests

`tests/property/invariants.test.ts` uses generated inputs to check that:

- Tokens are never empty or whitespace and respect the token cap.
- TF-IDF vectors are finite and either unit length or empty.
- Similarity matrices are symmetric, bounded, and have a unit diagonal.
- Clustering always returns a complete partition.
- The pipeline does not throw for arbitrary valid tab records.

### Integration tests

`tests/integration/pipeline.test.ts` covers:

- Expected groups for a mixed Linux/React/Python session.
- Zero-tab and one-tab cases.
- Skipped tabs not aborting the run.
- The 500-tab cap raising a typed `TOO_MANY_TABS` error.
- Input immutability.
- Determinism.
- Path-only clustering when titles are generic.
- CJK bigram clustering.
- Custom threshold and weights.

### UI tests

`tests/ui/popup.test.ts` runs in jsdom and verifies:

- Labels, explanations, and tab titles render as text, not HTML.
- A malicious-looking title does not create an `img` element.
- Clicking a tab calls the activation dependency with the tab and window ids.
- Dismiss moves a card to the dismissed section; restore brings it back.
- Rename updates only the in-memory state.
- Tab-access, browser, empty, and tab-cap messages appear correctly.

### Build tests

`tests/build/manifest.test.ts` checks:

- The manifest uses MV3, only the `tabs` permission, and no host permissions or
  content scripts.
- Firefox declares no data collection.
- Source files contain no network, storage, or HTML-injection APIs.
- Built popup HTML uses relative asset paths and no inline scripts, when a build
  exists.

## Coverage

`npm run test:coverage` collects V8 coverage for `src/core/**/*.ts` and
`src/browser/**/*.ts`. The popup and build layers are covered by behaviour
tests rather than line coverage because jsdom and filesystem checks are a better
fit for them.

Coverage is a guide, not a target. The important paths are the scoring,
clustering, and privacy invariants.

## Adding tests

- Put pure algorithm tests in `tests/unit/`.
- Use `tests/helpers/fixtures.ts` for `TabDocument` and matrix construction.
- Prefer fixed, small matrices for clustering cases; they are easier to reason
  about than generated data.
- Add an evaluation session when a new real-world pattern matters. See
  [`evaluation/README.md`](../evaluation/README.md).
- Do not add real browsing data to fixtures or sessions. Use `example.test` or
  other synthetic domains and paraphrase titles when needed.

## Manual testing

Automated tests cannot verify actual browser permission prompts, popup layout,
or tab activation. Use the checklist in
[`manual-testing.md`](manual-testing.md) before a release.
