# Design decisions

Short records of the choices that shape the extension, with the reasoning and
trade-offs. Format is inspired by architecture decision records.

---

## ADR-001: Popup-only architecture

**Decision:** Put all runtime logic in the popup. No background script, service
worker, content script, or offscreen document.

**Why:**

- Analysis is user-triggered and short-lived; it does not need a persistent
  process.
- A popup-only extension cannot observe browsing in the background.
- Closing the popup discards all tab metadata, which simplifies the privacy
  story.
- Fewer moving parts across Firefox and Chromium.

**Consequences:** No automatic or scheduled analysis. State such as dismissed
suggestions is lost when the popup closes. Very large analyses run on the popup
thread, bounded by the tab cap.

---

## ADR-002: Zero runtime dependencies

**Decision:** Ship no third-party runtime libraries. Vite, Vitest, fast-check,
jsdom, tsx, web-ext, and fflate are development-only.

**Why:**

- Less code to audit for a privacy-focused extension.
- No supply-chain surface at runtime.
- Small bundle (about 21 kB of JavaScript before gzip).
- The algorithms are small enough to implement and test directly.

**Consequences:** The project owns its tokenizer, TF-IDF, similarity, and
clustering code. Those components need their own tests and maintenance.

---

## ADR-003: Separate title and path TF-IDF corpora

**Decision:** Build independent TF-IDF vectors and IDF values for titles and
paths, then combine their cosine similarities.

**Why:** Titles and paths have different vocabulary and repetition patterns. A
term appearing in many paths should not reduce its weight in titles. Separate
corpora make each channel's signal interpretable and let one channel be
unavailable without corrupting the other.

**Consequences:** Two vector sets and two IDF maps per analysis. Slightly more
memory, but the model is easier to reason about and explain.

---

## ADR-004: Weighted similarity with capped hostname affinity

**Decision:** Default weights are title `0.65`, path `0.25`, hostname `0.10`.
Hostname never contributes more than `0.10`.

**Why:** Titles usually carry the strongest topical signal. Paths help when
titles are generic. Hostname is useful but dangerous: many unrelated tabs share
a large site such as `github.com`. The cap keeps hostname from clustering by
itself at the default threshold.

**Consequences:** Two tabs with no usable text cannot be grouped, even on the
same site. That is intentional: the extension should not call a site a topic.

---

## ADR-005: Missing signal is "unavailable", not "zero similarity"

**Decision:** A channel counts only when both tabs have usable data. If a text
channel is unavailable, its weight is redistributed across the remaining
available text channels. Hostname does not absorb text weight.

**Why:** A tab with no title is not evidence that it is unrelated. Treating
missing data as zero would unfairly penalise pages with generic or absent
titles. Keeping hostname out of the redistribution prevents a missing title from
turning into a hostname-only match.

**Consequences:** Scores can rise when one channel is missing, so the UI reports
strength as a similarity value, not a probability. Tabs with no text at all
still score at most `0.10` from hostname.

---

## ADR-006: Average-linkage agglomerative clustering

**Decision:** Use agglomerative clustering with average linkage, a similarity
threshold, and a minimum cluster size of two.

**Why:**

- The number of groups does not need to be specified in advance.
- Average linkage resists chaining: a bridge tab cannot join two groups just
  because it is similar to one member of each.
- The threshold is a natural stopping rule.
- It is deterministic and explainable.

**Consequences:** Related tabs can fragment when vocabulary differs. Complete
linkage would be stricter; single linkage would over-merge. Average linkage is
the middle ground chosen for this project.

---

## ADR-007: Heap-based clustering with Lance-Williams updates

**Decision:** Store candidate merges in a binary max-heap with lazy version
invalidation. Update cluster similarities with the Lance-Williams formula.

**Why:** A naive implementation recomputes every cluster average after every
merge. The heap updates only the merged cluster's row, giving roughly
`O(N² log N)` time instead of repeated full passes. Version checks discard stale
heap entries without expensive deletion.

**Consequences:** More complex clustering code, covered by unit and property
tests. Memory remains `O(N²)` because the full similarity matrix is retained.

---

## ADR-008: Threshold `0.25`

**Decision:** Set the default similarity threshold to `0.25` rather than the
proposal's initial `0.35`.

**Why:** At `0.35`, genuinely related tabs such as a kernel page and an
allocator article were left unclustered. At `0.25`, precision stayed high on the
development sessions while recall improved. Lower values (`0.15`) raised recall
but produced too many false positives.

**Consequences:** The value is tuned in-sample on a small synthetic set. It may
not generalise to all users. It is a code constant, not a UI setting, in this
version.

---

## ADR-009: CJK and Thai character bigrams

**Decision:** Convert runs of Han, Hiragana, Katakana, Hangul, and Thai
characters into prefixed character bigrams instead of using a dictionary
segmenter.

**Why:** These scripts do not reliably separate words with spaces. A bigram
fallback is deterministic, dependency-free, and adequate for overlap-based
similarity. Raw bigrams are excluded from labels because they are not readable
words.

**Consequences:** Matching is coarser than proper segmentation. Single-character
runs produce one token. Mixed-script titles are handled by processing Latin and
script runs separately.

---

## ADR-010: Preserve non-default ports in the hostname key

**Decision:** Use `hostname:port` as the affinity key when a non-default port is
present, while displaying only the hostname.

**Why:** `localhost:3000` and `localhost:3001` are usually different development
projects. Treating them as the same host would create false groups.

**Consequences:** Development tabs on different ports get no hostname bonus.
Default ports (`:80`, `:443`) are normalised away by the URL parser.

---

## ADR-011: Remove query strings and fragments in V1

**Decision:** Ignore `?query` and `#fragment` when deriving path tokens.

**Why:** Query strings often contain tracking parameters, session ids, and
opaque identifiers. Removing them reduces noise and avoids retaining more URL
detail than necessary. The proposal scoped V1 to titles, hostnames, and paths.

**Consequences:** Single-page apps that encode the current view in a query
string may look identical. This is a known limitation and a candidate for a
future opt-in feature.

---

## ADR-012: Session-only dismiss and rename state

**Decision:** Keep dismissed suggestions and custom labels in memory for the
life of the popup.

**Why:** Persisting them would require a storage permission and would retain
user browsing context. Session-only state keeps the privacy surface minimal and
matches the advisory nature of the feature.

**Consequences:** Dismissals and renames are lost when the popup closes.
Dismissed suggestions remain available in a collapsed **Dismissed** section
with **Restore**, so the action is reversible within the session.

---

## ADR-013: Only one tab mutation, and only on user action

**Decision:** The extension may call `tabs.update(tabId, { active: true })` when
the user clicks a tab in the popup. It performs no other tab or window
mutation.

**Why:** The product principle is "suggest, explain, preserve user control".
Activating a tab is navigation, not organisation. It helps the user inspect a
suggestion without changing tab order or content.

**Consequences:** The extension cannot create native tab groups, move tabs, or
close tabs. Users who want those actions must do them manually.

---

## ADR-014: Safe DOM construction only

**Decision:** Build the popup UI with `createElement` and `textContent`. Do not
use `innerHTML` for dynamic content.

**Why:** Page titles and user-entered labels are untrusted strings. Setting them
as HTML would create an injection path inside the extension origin. A test
renders a title containing an `<img onerror>` payload and asserts that no element
is created.

**Consequences:** Rendering code is more verbose than template strings, but it
has no HTML parsing step and is easy to audit.

---

## ADR-015: Manifest composition with invariant checks

**Decision:** Keep a shared `manifests/base.json` plus per-browser overrides,
merge them in `scripts/finalize.mjs`, and fail the build if permissions are not
exactly `["tabs"]` or if host permissions/content scripts appear.

**Why:** Shipping different manifests is the easiest place to accidentally add
a permission. A build-time check plus a test makes the privacy claim
enforceable, not just documented.

**Consequences:** Manifest changes must go through the composition script. The
build fails loudly if an invariant is broken.

---

## ADR-016: Firefox minimum version 142

**Decision:** Set `strict_min_version` to `142.0`.

**Why:** Firefox 142 introduced support for
`browser_specific_settings.gecko.data_collection_permissions`. Older versions
cause `web-ext lint` warnings, and the project wants an explicit
"no data collection" declaration.

**Consequences:** Users on older Firefox cannot install the extension. Firefox
for Android support for this key starts at 142 as well, but this build does not
target Android UI.

---

## ADR-017: Package with fflate, not the system `zip`

**Decision:** `scripts/package.mjs` builds zips using the `fflate` development
dependency.

**Why:** The original script depended on a `zip` binary that is absent on some
Linux systems. An npm-based packer makes packaging reproducible across
environments.

**Consequences:** One more development dependency. Archive contents are
deterministic enough for local use, though timestamps still vary.

---

## ADR-018: Inject the version at build time

**Decision:** Vite defines `__APP_VERSION__` from `package.json`, and the popup
uses it instead of a hardcoded string.

**Why:** The manifest version already comes from `package.json`. A second
hardcoded version in the UI would drift.

**Consequences:** `src/popup/main.ts` depends on a Vite define, declared in
`src/types/globals.d.ts`. Unit tests mount the controller directly and pass an
explicit version, so they are unaffected.
