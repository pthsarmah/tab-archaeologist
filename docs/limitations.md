# Limitations

Tab Archaeologist is a lexical grouping tool, not a semantic assistant. This
page lists what it does not do and where the design trades quality for privacy,
simplicity, and safety.

## Analysis quality

- **Lexical only.** It matches words and character bigrams. It does not know
  that "kernel panic" and "oops message" are related unless they share terms.
- **Recall is moderate.** On the development sessions, pairwise recall is
  52.6%. Related tabs with different vocabulary can stay unclustered.
- **Title quality matters.** Generic titles (`Home`, `Docs`, `Loading`) are
  discarded, leaving the path channel. Pages with short paths and generic titles
  provide little signal.
- **English-centric stop words.** Stop-word removal is tuned for English.
  CJK and Thai text is handled with character bigrams, which is a fallback, not
  proper segmentation.
- **No stemming or lemmatisation.** "Allocate", "allocator", and "allocation"
  remain different tokens. Only exact token overlap counts.
- **Subdomains are distinct hosts.** `mail.google.com` and `google.com` do not
  share a hostname bonus.
- **No query or fragment signal.** Query strings and fragments are deliberately
  removed in this version, so pages distinguished only by query parameters look
  identical.
- **Identifiers are discarded.** UUIDs, long hex strings, and long numbers are
  removed from paths, which helps noise but loses information on pages whose
  identity is an id.
- **Threshold is fixed.** There is no per-user learning or adaptive threshold.
  `0.18` is a development default, not a personalised setting.
- **In-sample tuning.** The default threshold was chosen on the same small set
  the evaluation reports, so the reported scores are optimistic.

## Scope

- **Current window only.** Tabs in other windows are ignored.
- **Open tabs only.** History, recently closed tabs, bookmarks, and sessions are
  not read.
- **500-tab cap.** Larger windows raise an error instead of risking a long
  analysis. The cap is configurable in code, not in the UI.
- **No cross-device or sync behaviour.** There is no account or sync layer.
- **Chromium-only browser grouping.** Chromium builds can create native tab
  groups from suggestions after an explicit click. Firefox has no compatible
  native grouping API in this build.
- **No automatic changes.** It never moves, closes, reorders, or renames tabs
  automatically; native grouping requires an explicit button click.
- **Dismissals and renames are session-only.** They disappear when the popup
  closes, by design, because nothing is persisted.

## Interface

- **Popup-sized UI.** There is no dashboard, search, or bulk action.
- **No drag-and-drop or manual regrouping.** Suggestions are read-only apart
  from rename, dismiss, and restore.
- **No settings page.** Weights, threshold, and limits live in code.
- **No accessibility audit with assistive technology.** The UI uses semantic
  elements, labels, focus styles, and live regions, but it has not been tested
  with screen readers.
- **No localisation.** The interface is English-only.

## Browser support

- **Firefox 142+.** Older versions do not understand
  `data_collection_permissions` in the manifest. Firefox for Android is not
  supported by this build.
- **Chromium 110+.** The build assumes promise-based `chrome.tabs` APIs.
- **Private/incognito windows** are not specially handled. Behaviour depends on
  whether the user has allowed the extension in private browsing.
- **Pinned, discarded, and loading tabs** are processed like any other tab.
  A loading tab may only have `pendingUrl` and a provisional title.
- **Restricted pages** such as `chrome://`, `about:`, `view-source:`, and
  `file://` are skipped and reported in the **Skipped** section.
- **Firefox temporary installs** disappear on restart. Permanent installation
  requires signing through addons.mozilla.org.

## Privacy trade-offs

- The `tabs` permission is broad by browser design. It is required to read tab
  URLs and titles, and Chromium describes it as "Read your browsing history".
  The code queries only the current window on explicit user action.
- There is no encrypted local cache, because there is no cache at all. Every
  analysis starts from a fresh query.
- The extension does not attempt to defend against a compromised browser,
  malicious other extensions, or an attacker with access to the popup's memory.

## Evaluation

- **Small synthetic sample.** Eight sessions and 38 truth pairs are enough to
  catch regressions, not enough to claim general accuracy.
- **Single annotator.** Truth labels reflect one interpretation of each task.
- **Pairwise metrics only.** They do not measure perceived usefulness, label
  quality, or explanation clarity.
- **No user study.** The interface has not been evaluated with target users.
- **No timing benchmark at the cap.** Runtime at 500 tabs is bounded by the
  algorithm but not measured in the report.

## Possible next steps

These are deliberately out of scope for version 0.1.0:

- Stemming or lightweight morphological normalisation.
- Optional query-string features with explicit privacy controls.
- A settings surface for threshold and weights.
- Optional persistence with clear user consent.
- Native tab-group creation, only as an explicit user action.
- Larger, consented, multi-annotator evaluation sets.
- Localisation and a screen-reader audit.
