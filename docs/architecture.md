# Architecture

This document describes how Tab Archaeologist is put together and why the
analysis pipeline behaves the way it does.

## Overview

The extension is a popup-only WebExtension. It has no background script, no
service worker, no content script, and no persistent storage. Opening the popup
creates the whole runtime; closing it discards all state.

```text
popup.html
   |
   v
popup/main.ts  ──> popup/controller.ts ──> browser/adapter.ts ──> WebExtension API
   |                     |
   |                     v
   |                core/pipeline.ts
   |                     |
   |                     +──> config.ts
   |                     +──> extractor.ts ──> normalizer.ts / tokenizer.ts
   |                     +──> tfidf.ts
   |                     +──> similarity.ts
   |                     +──> clustering.ts
   |                     +──> labeling.ts
   |
   v
popup/render.ts  (safe DOM construction)
```

`src/core/` is browser-independent. It can be exercised from Node, which is what
the tests and the evaluation harness do. `src/browser/` contains the only
WebExtension-specific code.

## Data flow

### 1. Trigger and tab query

`mountPopup` in `src/popup/controller.ts` wires the **Analyse tabs** button to
`fetchCurrentWindowTabs`. The adapter calls:

```ts
api.tabs.query({ currentWindow: true })
```

Only the current window is queried. The adapter maps browser tab records to a
small `RawTab` shape and never reads other windows or history.

### 2. Extraction and normalisation

`extractDocuments` in `src/core/extractor.ts` processes one tab at a time. A
bad tab is recorded in `skipped` and never aborts the run.

Skip reasons:

| Reason | Meaning |
|---|---|
| `no-id` | The browser did not provide a numeric tab id |
| `no-url` | Neither `url` nor `pendingUrl` is present |
| `restricted` | Non-HTTP(S) page such as `chrome://`, `about:`, or `file://` |
| `invalid-url` | The URL cannot be parsed |
| `no-metadata` | Title and path both produced no tokens |

`normalizeUrl` in `src/core/normalizer.ts`:

- Accepts only `http:` and `https:`.
- Lowercases hostnames, strips a trailing dot, and removes a leading `www.`.
- Keeps non-default ports in `hostKey` (for example `localhost:3000`).
- Removes query strings and fragments.
- Splits the path into segments, URL-decodes them, strips matrix parameters,
  and drops generic segments (`index`, `html`, `php`, `www`), UUIDs, long hex
  strings, and long numeric identifiers.
- Removes only known page extensions (`.html`, `.php`, `.asp`, `.jsp`), so
  technical names such as `node.js` survive.

`normalizeTitle` collapses control characters and whitespace and truncates to
`maxTitleChars` (default 300).

### 3. Tokenisation

`tokenize` in `src/core/tokenizer.ts` runs this sequence:

1. NFKC normalisation.
2. Protect known technical terms (`c++`, `c#`, `.net`, `node.js`, `objective-c`,
   product names such as `iPhone`, `iOS`, and `macOS`).
3. Split camelCase, snake_case, and kebab-case boundaries.
4. Extract CJK and Thai runs and convert them to prefixed character bigrams
   (`cjk:内存`, `thai:ภาษา`).
5. Remove punctuation and combining-mark noise.
6. Lowercase, drop stop words, drop 6+ digit identifiers, cap term length at 64
   characters.

Titles made only of generic terms (`Home`, `Docs`, `Loading`) are treated as
unavailable so the path channel carries the signal. Short technical terms such
as `C`, `R`, `Go`, `OS`, `API`, `SQL`, and `CPU` are deliberately not stop
words.

### 4. TF-IDF

Titles and paths are separate corpora. For each channel, `buildChannelVectors`
computes:

```text
idf(t) = ln((N + 1) / (df(t) + 1)) + 1
weight(t, d) = tf(t, d) * idf(t)
```

`N` is every analysed tab, including tabs with an empty channel. Each vector is
L2-normalised. Empty vectors stay empty rather than becoming zero-filled dense
arrays.

### 5. Pairwise similarity

`pairScore` combines the channels with missing-signal redistribution:

```text
score = hostWeight * hostMatch
      + titleWeight * scale * cos(titleA, titleB)
      + pathWeight  * scale * cos(pathA, pathB)
```

Rules:

- A text channel is **available** only when both tabs have tokens and both
  vectors are non-empty. A missing title is treated as unavailable, not as
  dissimilarity.
- Available text channels are renormalised to fill `1 - hostWeight` when the
  hostname is available, so a missing channel does not silently lower scores.
- When the hostname is unavailable, text fills the whole weight.
- Hostname contributes at most `0.10`. Two tabs with no text signal cannot be
  clustered by hostname alone at the default threshold.
- Non-default ports must match exactly for the hostname bonus.

The result is a symmetric `Float64Array` matrix with a unit diagonal.

### 6. Clustering

`clusterSimilarityMatrix` performs agglomerative clustering with average
linkage:

- Candidate pairs at or above the threshold go into a binary max-heap.
- On merge, the new similarity to every active cluster is updated with the
  Lance-Williams average-linkage formula:

```text
s(new, c) = (sizeA * s(a, c) + sizeB * s(b, c)) / (sizeA + sizeB)
```

- Heap entries carry cluster versions and are lazily discarded when stale.
- The loop stops as soon as the best remaining candidate is below the
  threshold.
- Clusters smaller than `minClusterSize` are dissolved into `unclustered`.

Complexity is `O(N²)` memory and roughly `O(N² log N)` time. The runtime cap is
500 tabs by default.

### 7. Labelling and explanation

`buildSuggestions` in `src/core/labeling.ts`:

- Picks a medoid: the member with the highest mean similarity to the rest,
  breaking ties by the lowest tab id.
- Aggregates weighted term scores across member title and path vectors.
- Keeps a term only if it appears in at least
  `max(2, ceil(clusterSize / 2))` members. This prevents an explanation from
  claiming a "shared" term found in only one tab.
- Excludes generic label terms and raw CJK/Thai bigrams; for those clusters the
  medoid title is used as the label.
- Renders a label from up to three terms, or falls back to the medoid title,
  then hostname, then `Untitled group`.
- Adds a suffix such as ` (2)` when two labels collide.
- Reports `avgSimilarity` as the mean over unique member pairs, rounded to two
  decimals. The UI labels this **strength** and states it is not a probability.

### 8. Rendering

`renderResults` builds DOM nodes with `document.createElement` and
`textContent`. Dynamic text never becomes HTML. The UI contains:

- A summary line with group, unclustered, and skipped counts.
- Suggestion cards with label, strength, explanation, rename/dismiss actions,
  and a clickable tab list.
- A collapsible **Unclustered** section.
- A collapsible **Dismissed** section with **Restore**.
- A collapsible **Skipped** section with reason counts.

Dismissed and renamed state lives in the controller for the popup session only.

## Browser compatibility

`src/browser/webext-api.ts` resolves `globalThis.browser` first, then
`globalThis.chrome`. Both are used with promise-returning APIs.

- Firefox 142+ is required so that
  `browser_specific_settings.gecko.data_collection_permissions` is understood.
- Chromium 110+ is the declared minimum.
- The same source and manifest base are used for both builds; only the
  per-browser manifest overrides and output directory differ.

## Build and packaging

`vite.config.ts` builds `src/popup/popup.html` with `base: './'` into
`dist/<browser>/`. The version is injected at build time from `package.json`.

`scripts/finalize.mjs` then:

1. Merges `manifests/base.json` with `manifests/<browser>.json`.
2. Overwrites the manifest version from `package.json`.
3. Copies icons.
4. Asserts that permissions are exactly `["tabs"]`, that there are no content
   scripts or host permissions, and that the popup entry exists.
5. Writes `manifest.json`.

`scripts/package.mjs` zips each build with `fflate`, so no system `zip` binary
is required.

## Invariants

The following are enforced by tests:

- No `fetch`, `XMLHttpRequest`, `WebSocket`, storage API, or `innerHTML` in the
  analysis, adapter, or popup modules.
- Manifest permissions are exactly `["tabs"]`.
- No host permissions and no content scripts.
- Firefox declares `data_collection_permissions.required = ["none"]`.
- Similarity scores are symmetric and bounded to `[0, 1]`.
- Clustering returns a complete partition of all analysed tabs.
- The pipeline never mutates its input tab records.
- Repeated runs on the same input produce the same output.
