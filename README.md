# Tab Archaeologist

Local, non-destructive tab grouping suggestions for Firefox and Chromium.

Tab Archaeologist reads the titles, hostnames, and URL paths of the tabs in your
current window, finds groups of tabs that look related, and shows them as
suggestions in a popup. It never moves, closes, or renames browser tabs.
Chromium users can explicitly create a native browser group from a suggestion.

- **Local only.** No network requests, no page content, no analytics.
- **Non-destructive.** Suggestions are advisory. Nothing changes unless you
  click a tab or explicitly create a browser group.
- **Explainable.** Every group shows the shared terms and its average
  similarity.
- **User-controlled.** Dismiss and restore suggestions, rename them for the
  current popup session, or explicitly create a Chromium browser group.

## Quick start

Requirements: Node.js 22.12+ (Node 24 recommended) and npm.

```bash
npm install
npm run verify     # typecheck, tests, both builds, Firefox lint
npm run package    # write zips to web-ext-artifacts/
```

## Load the extension

### Chromium (Chrome, Edge, Brave, Opera, Vivaldi)

1. Run `npm run build:chromium`.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select `dist/chromium/`.
5. Click the Tab Archaeologist toolbar button and choose **Analyse tabs**.
6. Click **Create browser group** on a suggestion to create and name a native
   Chromium tab group.

### Firefox 142 or later

1. Run `npm run build:firefox`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Choose **Load Temporary Add-on…**.
4. Select `dist/firefox/manifest.json`.
5. Click the toolbar button and choose **Analyse tabs**.

Temporary add-ons disappear when Firefox closes. For a permanent install,
package and sign the extension through addons.mozilla.org. Firefox for Android
is not supported by this build.

### Packaged artifacts

`npm run package` writes:

- `web-ext-artifacts/tab-archaeologist-chromium.zip`
- `web-ext-artifacts/tab-archaeologist-firefox.zip`

Both zips contain `manifest.json`, `popup/`, `assets/`, and `icons/` at the
archive root.

## How it works

```text
Click "Analyse tabs"
        |
        v
Read current-window tab metadata (title, hostname, path)
        |
        v
Normalise, tokenise, and remove stop words
        |
        v
Build separate TF-IDF vectors for titles and paths
        |
        v
Score every tab pair (weighted cosine + capped hostname affinity)
        |
        v
Average-linkage agglomerative clustering
        |
        v
Generate labels, explanations, and similarity strength
        |
        v
Render suggestions in the popup (tabs unchanged)
```

Default weights are title `0.65`, path `0.25`, and hostname `0.10`. The default
similarity threshold is `0.18`. Query strings and fragments are ignored in this
version.

## Project layout

```text
src/core/       Browser-independent analysis pipeline
src/browser/    WebExtension API facade and tab adapter
src/popup/      Popup markup, styles, controller, and DOM rendering
src/types/      Shared TypeScript types
manifests/      Base manifest plus per-browser overrides
public/icons/   Extension icons
scripts/        Manifest finalisation and zip packaging
tests/          Unit, property, integration, UI, and build tests
evaluation/     Labelled sessions, metrics, baselines, reports
docs/           Architecture, privacy, testing, and design notes
```

## Commands

| Command | Purpose |
|---|---|
| `npm run build` | Build Chromium and Firefox outputs into `dist/` |
| `npm run build:chromium` | Build only `dist/chromium/` |
| `npm run build:firefox` | Build only `dist/firefox/` |
| `npm run typecheck` | Run `tsc --noEmit` |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run test:coverage` | Collect V8 coverage for core and browser modules |
| `npm run evaluate` | Score the pipeline on the labelled sessions |
| `npm run lint:firefox` | Run `web-ext lint` against the Firefox build |
| `npm run package` | Write both distribution zips |
| `npm run verify` | Typecheck, test, build, and lint in one command |

## Evaluation snapshot

Run `npm run evaluate` to regenerate the report. On the eight synthetic smoke
sessions at threshold `0.18`:

| Method | Precision | Recall | F1 |
|---|---:|---:|---:|
| Full model (micro) | 83.9% | 68.4% | 75.4% |
| Full model (macro) | 91.1% | 71.5% | 72.6% |
| Same-hostname baseline (micro) | 48.0% | 31.6% | 38.1% |

The target is precision of at least 80% and recall of at least 50%. These
sessions are a development smoke set, not a held-out benchmark. See
[`evaluation/README.md`](evaluation/README.md) and
[`docs/evaluation.md`](docs/evaluation.md) for methodology and caveats.

## Privacy

The extension requests `tabs` to read tab titles and URLs. Chromium builds also
request `tabGroups` to create a native group after explicit user action. Tab
data is processed in the popup's memory and is discarded when the popup closes.
There is no storage API, no background process, no content script, no host
permission, and no network code. See
[`docs/privacy.md`](docs/privacy.md).

## Documentation

- [Architecture](docs/architecture.md)
- [Testing](docs/testing.md)
- [Manual browser checklist](docs/manual-testing.md)
- [Privacy](docs/privacy.md)
- [Evaluation](docs/evaluation.md)
- [Limitations](docs/limitations.md)
- [Design decisions](docs/decisions.md)

## Status

Version 0.1.0. The core workflow is complete: analysis, clustering, labelling,
popup UI, tests, evaluation harness, builds, packaging, and documentation.
Known limitations are listed in [`docs/limitations.md`](docs/limitations.md).
