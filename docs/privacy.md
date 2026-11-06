# Privacy

Tab Archaeologist is designed to work without collecting, storing, or
transmitting browsing data.

## What data is read

Only after you click **Analyse tabs**, the extension reads the following fields
for tabs in the **current window**:

- Tab id and window id
- Page title
- URL (used to derive hostname, port, and path)
- Pending URL, when a tab is still loading

Query strings and fragments are removed during normalisation. Page content,
form data, cookies, history, bookmarks, downloads, and tabs in other windows are
never read.

## Where data goes

```text
Browser tab records
        |
        v
Popup memory (JavaScript objects)
        |
        v
Similarity matrix and cluster suggestions
        |
        v
Rendered DOM
        |
        v
Discarded when the popup closes
```

There is no server, no analytics, no telemetry, no crash reporting, and no
third-party library at runtime. The extension makes no network requests.
Creating a Chromium tab group is the only tab mutation and requires an explicit
click on the **Create browser group** button.

## Storage

The extension has no storage layer:

- No `storage` permission.
- No `localStorage`, `sessionStorage`, or `indexedDB`.
- No background script or service worker that could retain state.
- Dismissed and renamed suggestions live only in the popup controller and are
  lost when the popup closes.
- No analysis results, tab titles, or URLs are written to disk.

## Permissions

The manifest requests `tabs` for reading tab metadata. Chromium builds also
request `tabGroups` for the explicit native grouping action:

```json
"permissions": ["tabs"]
```

The `tabs` permission is required to read tab titles and URLs and to activate a
tab when you click it. It does **not** grant access to page content. The
extension declares:

- No `host_permissions`.
- No `content_scripts`.
- No optional permissions.
- No `storage`, `history`, `bookmarks`, or `webNavigation` permissions.

Chromium may describe the `tabs` permission as "Read your browsing history".
This is the browser's standard wording for URL/title access; the extension only
queries the current window and only when you ask it to analyse.

Firefox builds declare:

```json
"data_collection_permissions": {
  "required": ["none"]
}
```

## Network isolation

`tests/build/manifest.test.ts` scans the analysis, adapter, and popup modules
for:

- `fetch(`
- `XMLHttpRequest`
- `WebSocket`
- `localStorage`
- `indexedDB`
- `chrome.storage` / `browser.storage`
- `innerHTML`

The Content Security Policy for extension pages is:

```text
script-src 'self'; object-src 'self'
```

The popup loads only bundled local assets. There are no remote scripts, fonts,
images, or styles.

## Tab mutation policy

The only browser mutation in the codebase is:

```ts
api.tabs.update(tabId, { active: true })
```

It runs only when you click a tab in the popup. The extension never calls
`tabs.move`, `tabs.remove`, `tabs.group`, `tabs.update` with a URL, or any API
that changes tab order, grouping, or content.

## Auditing

To verify the claims yourself:

1. Search the source for the forbidden APIs listed above.
2. Build the extension and inspect `dist/<browser>/manifest.json`.
3. Open the popup with DevTools and watch the Network panel while analysing.
4. Run `npm test`, which includes the privacy invariant checks.
5. Run `npm run lint:firefox` for Mozilla's manifest validation.

## Data in the repository

The evaluation sessions use synthetic domains such as `example.test`,
`one.test`, and `react.dev`, with short paraphrased titles. Contributors must not
commit real browsing data, personal URLs, or private page titles to tests,
fixtures, reports, or documentation.
