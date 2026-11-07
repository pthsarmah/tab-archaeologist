import type { AnalysisResult, Suggestion } from '../types/cluster';
import type { SkipReason, SkippedTab, TabDocument } from '../types/tab';

export interface PopupUiState {
  dismissed: Set<string>;
  renamed: Map<string, string>;
  editingId: string | null;
  unclusteredLimit: number;
}

export interface RenderActions {
  onOpenTab(tab: TabDocument): void;
  onCreateGroup(suggestion: Suggestion): void;
  onCreateAllGroups(): void;
  onDismiss(id: string): void;
  onRestore(id: string): void;
  onStartRename(id: string): void;
  onCancelRename(): void;
  onRename(id: string, label: string): void;
  onShowMoreUnclustered(): void;
}

export function createInitialUiState(): PopupUiState {
  return {
    dismissed: new Set(),
    renamed: new Map(),
    editingId: null,
    unclusteredLimit: 50
  };
}

function element<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(
  doc: Document,
  label: string,
  className = 'button',
  type: 'button' | 'submit' = 'button'
): HTMLButtonElement {
  const node = element(doc, 'button', className, label);
  node.type = type;
  return node;
}

function tabList(doc: Document, tabs: TabDocument[], actions: RenderActions): HTMLUListElement {
  const list = element(doc, 'ul', 'tab-list');
  for (const tab of tabs) {
    const item = element(doc, 'li', 'tab-item');
    const tabButton = button(doc, '', 'tab-button');
    tabButton.title = tab.title || tab.hostname || 'Untitled tab';
    tabButton.setAttribute('aria-label', `Open tab: ${tabButton.title}`);

    const title = element(doc, 'span', 'tab-title', tab.title || tab.hostname || 'Untitled tab');
    title.dir = 'auto';
    const host = element(doc, 'span', 'tab-host', tab.hostname || '');
    host.dir = 'ltr';

    tabButton.append(title, host);
    tabButton.addEventListener('click', () => actions.onOpenTab(tab));
    item.append(tabButton);
    list.append(item);
  }
  return list;
}

function renderRenameForm(
  doc: Document,
  suggestion: Suggestion,
  currentLabel: string,
  actions: RenderActions
): HTMLFormElement {
  const form = element(doc, 'form', 'rename-form');
  const input = element(doc, 'input');
  input.value = currentLabel;
  input.maxLength = 60;
  input.setAttribute('aria-label', 'Group label');
  const save = button(doc, 'Save', 'button', 'submit');
  const cancel = button(doc, 'Cancel', 'button');

  form.append(input, save, cancel);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    actions.onRename(suggestion.id, input.value);
  });
  cancel.addEventListener('click', () => actions.onCancelRename());
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      actions.onCancelRename();
    }
  });

  const focusInput = (): void => input.focus();
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(focusInput);
  } else {
    setTimeout(focusInput, 0);
  }
  return form;
}

function clusterCard(
  doc: Document,
  suggestion: Suggestion,
  state: PopupUiState,
  actions: RenderActions,
  dismissed: boolean
): HTMLElement {
  const card = element(doc, 'article', dismissed ? 'cluster-card dismissed-card' : 'cluster-card');
  const header = element(doc, 'div', 'cluster-header');
  const titleWrap = element(doc, 'div', 'cluster-title-wrap');
  const label = element(
    doc,
    'h2',
    'cluster-label',
    state.renamed.get(suggestion.id) ?? suggestion.label
  );
  label.dir = 'auto';

  const meta = element(
    doc,
    'p',
    'cluster-meta',
    `${suggestion.tabs.length} tabs · strength ${suggestion.avgSimilarity.toFixed(2)}`
  );
  meta.title = 'Average pairwise similarity. This is a grouping strength, not a probability.';
  titleWrap.append(label, meta);

  const actionWrap = element(doc, 'div', 'cluster-actions');
  if (!dismissed) {
    const rename = button(doc, 'Rename', 'button button-subtle');
    rename.addEventListener('click', () => actions.onStartRename(suggestion.id));
    const dismiss = button(doc, 'Dismiss', 'button button-subtle');
    dismiss.addEventListener('click', () => actions.onDismiss(suggestion.id));
    const createGroup = button(doc, 'Create browser group', 'button button-subtle');
    createGroup.addEventListener('click', () => actions.onCreateGroup(suggestion));
    actionWrap.append(rename, dismiss, createGroup);
  } else {
    const restore = button(doc, 'Restore', 'button button-subtle');
    restore.addEventListener('click', () => actions.onRestore(suggestion.id));
    actionWrap.append(restore);
  }
  header.append(titleWrap, actionWrap);

  const explanation = element(doc, 'p', 'cluster-explanation', suggestion.explanation);
  card.append(header, explanation);

  if (state.editingId === suggestion.id) {
    card.append(renderRenameForm(doc, suggestion, state.renamed.get(suggestion.id) ?? suggestion.label, actions));
  }

  card.append(tabList(doc, suggestion.tabs, actions));
  return card;
}

function skippedSection(doc: Document, skipped: SkippedTab[]): HTMLElement {
  const details = element(doc, 'details', 'section');
  const summary = element(doc, 'summary', undefined, `Skipped (${skipped.length})`);
  details.append(summary);

  const labels: Record<SkipReason, string> = {
    'no-id': 'No tab id',
    'no-url': 'No URL available',
    restricted: 'Restricted browser page',
    'invalid-url': 'Unreadable URL',
    'no-metadata': 'No usable metadata'
  };
  const counts = new Map<SkipReason, number>();
  for (const tab of skipped) {
    counts.set(tab.reason, (counts.get(tab.reason) ?? 0) + 1);
  }

  const list = element(doc, 'ul', 'skipped-list');
  for (const [reason, count] of counts) {
    list.append(element(doc, 'li', undefined, `${labels[reason]}: ${count}`));
  }
  const body = element(doc, 'div', 'section-body');
  body.append(list);
  details.append(body);
  return details;
}

/**
 * Render the result snapshot. Every dynamic value is inserted with textContent;
 * page titles and user-entered labels never become HTML.
 */
export function renderResults(
  container: HTMLElement,
  result: AnalysisResult,
  state: PopupUiState,
  actions: RenderActions
): void {
  const doc = container.ownerDocument;
  container.replaceChildren();

  const active = result.suggestions.filter((suggestion) => !state.dismissed.has(suggestion.id));
  const dismissed = result.suggestions.filter((suggestion) => state.dismissed.has(suggestion.id));

  const summary = element(
    doc,
    'p',
    'result-summary',
    `${result.suggestions.length} suggested group${result.suggestions.length === 1 ? '' : 's'} · ` +
      `${result.unclustered.length} unclustered · ${result.skipped.length} skipped`
  );
  container.append(summary);

  if (active.length > 0) {
    const bulkActions = element(doc, 'div', 'bulk-actions');
    const createAll = button(doc, 'Create all browser groups', 'button button-primary');
    createAll.addEventListener('click', () => actions.onCreateAllGroups());
    bulkActions.append(createAll);
    container.append(bulkActions);
  }

  if (result.stats.analyzedCount === 0) {
    const note = element(doc, 'p', 'section-note', 'No analysable tabs were found in this window.');
    container.append(note);
  } else if (result.suggestions.length === 0) {
    const note = element(
      doc,
      'p',
      'section-note',
      'No strong groups were found. Your tabs are left unchanged and remain available below.'
    );
    container.append(note);
  } else if (active.length === 0) {
    const note = element(doc, 'p', 'section-note', 'All suggestions are dismissed. Restore one below.');
    container.append(note);
  }

  for (const suggestion of active) {
    container.append(clusterCard(doc, suggestion, state, actions, false));
  }

  if (result.unclustered.length > 0) {
    const details = element(doc, 'details', 'section');
    details.open = true;
    details.append(
      element(doc, 'summary', undefined, `Unclustered (${result.unclustered.length})`)
    );
    const body = element(doc, 'div', 'section-body');
    const visible = result.unclustered.slice(0, state.unclusteredLimit);
    body.append(tabList(doc, visible, actions));
    if (visible.length < result.unclustered.length) {
      const more = button(
        doc,
        `Show ${Math.min(50, result.unclustered.length - visible.length)} more`,
        'button'
      );
      more.addEventListener('click', () => actions.onShowMoreUnclustered());
      body.append(more);
    }
    details.append(body);
    container.append(details);
  }

  if (dismissed.length > 0) {
    const details = element(doc, 'details', 'section');
    details.open = true;
    details.append(element(doc, 'summary', undefined, `Dismissed (${dismissed.length})`));
    const body = element(doc, 'div', 'section-body');
    for (const suggestion of dismissed) {
      body.append(clusterCard(doc, suggestion, state, actions, true));
    }
    details.append(body);
    container.append(details);
  }

  if (result.skipped.length > 0) {
    container.append(skippedSection(doc, result.skipped));
  }
}
