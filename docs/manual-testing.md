# Manual browser checklist

Automated tests cover logic, but they cannot verify real permission prompts,
popup rendering, or tab activation. Run this checklist in both browsers before a
release.

## Preparation

Build both targets:

```bash
npm run verify
```

Open a fresh browser window with at least eight tabs, including:

- Three tabs on a related topic from different sites, for example three Linux
  kernel or memory-management articles.
- Two tabs on a second topic, for example two React documentation pages.
- Two unrelated tabs, for example a recipe and a news page.
- One generic-title tab, for example a path ending in `/docs/linux/kernel`.
- One restricted tab, for example `about:blank` or `chrome://settings`.

## Chromium

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select `dist/chromium/`.
4. Confirm the extension loads with no errors and the toolbar icon appears.
5. Open the test window and click the toolbar icon.
6. Confirm the popup shows **Analyse tabs** and the privacy footer.

Checks:

- [ ] Clicking **Analyse tabs** shows a loading state, then results.
- [ ] Related tabs appear in suggested groups with readable labels.
- [ ] Each suggestion explains why it was grouped and shows a strength value.
- [ ] The two unrelated tabs are not grouped together.
- [ ] The generic-title tab is grouped using its path.
- [ ] The restricted tab appears under **Skipped**, not in a group.
- [ ] Clicking a tab in a suggestion activates that tab and focuses the window.
- [ ] Clicking **Dismiss** moves the card into **Dismissed**.
- [ ] Clicking **Restore** brings it back.
- [ ] Renaming a group changes only the popup label.
- [ ] Closing and reopening the popup resets dismissed and renamed state.
- [ ] **Analyse again** re-reads the current window; tabs opened since the first
      run appear.
- [ ] The popup footer shows the version from `package.json`.
- [ ] No horizontal scrolling or clipped text at the default popup size.
- [ ] Dark mode is readable when the OS uses a dark theme.
- [ ] Keyboard-only use reaches the analyse button, tab buttons, and actions.
- [ ] Tab titles containing `<`, `>`, `&`, or quotes render as literal text.

## Firefox

1. Run `npm run build:firefox`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Choose **Load Temporary Add-on…** and select `dist/firefox/manifest.json`.
4. Repeat the Chromium checks.

Additional checks:

- [ ] Firefox asks for the expected `tabs` permission or shows it in the
      add-on's permissions panel.
- [ ] `about:debugging` reports no manifest warnings.
- [ ] The popup works after closing and reopening it.
- [ ] Removing and reloading the temporary add-on works after a rebuild.

## Permission failure path

1. Open the extension's settings and remove or block its tab access if the
   browser allows it.
2. Open the popup and run an analysis.
3. Confirm the popup says that tab access is required instead of showing
   "0 tabs".
4. Restore access and confirm analysis works again.

## Privacy verification

1. Open the popup's DevTools console.
2. Clear the Network panel.
3. Run an analysis.
4. Confirm no network requests are made.
5. In the console, confirm `localStorage.length`, `sessionStorage.length`, and
   `indexedDB.databases()` show no extension data.
6. Inspect `dist/<browser>/manifest.json` and confirm:
   - `permissions` is exactly `["tabs"]`.
   - There is no `host_permissions`.
   - There is no `content_scripts`.
   - There is no `background`.
7. Run `npm run lint:firefox` and confirm zero errors and warnings.

## Packaging

1. Run `npm run package`.
2. Inspect each zip:

   ```bash
   unzip -l web-ext-artifacts/tab-archaeologist-chromium.zip
   unzip -l web-ext-artifacts/tab-archaeologist-firefox.zip
   ```

3. Confirm `manifest.json`, `popup/popup.html`, `assets/`, and `icons/` are at
   the archive root, with no extra top-level directory.
4. Install the Firefox zip as a temporary add-on and repeat the smoke checks.
5. For Chromium, unzip to a clean directory, load it unpacked, and repeat the
   smoke checks.

## Release notes

Record:

- Browser and version used.
- Operating system.
- Any failed check and the steps to reproduce it.
- A screenshot of the popup with a representative result.
