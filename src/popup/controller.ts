import { BrowserApiError, hasTabAccessProblem } from '../browser/adapter';
import type { AnalysisResult } from '../types/cluster';
import type { Suggestion } from '../types/cluster';
import type { RawTab, TabDocument } from '../types/tab';
import { AnalysisError, analyzeTabs } from '../core/pipeline';
import { createInitialUiState, renderResults, type PopupUiState } from './render';

export interface PopupDependencies {
  fetchTabs(): Promise<RawTab[]>;
  analyze(tabs: RawTab[]): AnalysisResult;
  openTab(tabId: number, windowId?: number): Promise<void>;
  createGroup?: (tabIds: number[], title: string) => Promise<void>;
  version: string;
}

export interface PopupController {
  init(): void;
  analyze(): Promise<void>;
  getState(): PopupUiState;
}

function requireElement<T extends HTMLElement>(doc: Document, id: string): T {
  const element = doc.getElementById(id);
  if (!element) throw new Error(`Missing popup element: #${id}`);
  return element as T;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}

export function mountPopup(doc: Document, dependencies: PopupDependencies): PopupController {
  const analyzeButton = requireElement<HTMLButtonElement>(doc, 'analyze');
  const status = requireElement<HTMLElement>(doc, 'status');
  const results = requireElement<HTMLElement>(doc, 'results');
  const version = requireElement<HTMLElement>(doc, 'version');

  let state = createInitialUiState();
  let result: AnalysisResult | null = null;
  let busy = false;

  const setStatus = (message: string, kind: 'info' | 'error' | 'success' | 'none' = 'info'): void => {
    status.textContent = message;
    if (kind === 'none') {
      delete status.dataset.kind;
    } else {
      status.dataset.kind = kind;
    }
  };

  const rerender = (): void => {
    if (!result) {
      results.hidden = true;
      results.replaceChildren();
      return;
    }
    results.hidden = false;
    renderResults(results, result, state, actions);
    setStatus(
      result.stats.analyzedCount === 0
        ? 'No analysable tabs in this window.'
        : `Analysis complete: ${result.suggestions.length} suggested group${
            result.suggestions.length === 1 ? '' : 's'
          }.`,
      'success'
    );
  };

  const actions = {
    onOpenTab: (tab: TabDocument): void => {
      void dependencies.openTab(tab.id, tab.windowId).catch(() => {
        setStatus('That tab is no longer available.', 'error');
      });
    },
    onCreateGroup: (suggestion: Suggestion): void => {
      const title = state.renamed.get(suggestion.id) ?? suggestion.label;
      if (!dependencies.createGroup) {
        setStatus('Native browser groups are unavailable in this browser.', 'error');
        return;
      }
      void dependencies.createGroup(suggestion.tabIds, title).then(
        () => setStatus(`Created browser group “${title}”.`, 'success'),
        (error: unknown) => {
          setStatus(
            error instanceof BrowserApiError
              ? error.message
              : 'The browser group could not be created.',
            'error'
          );
        }
      );
    },
    onCreateAllGroups: (): void => {
      if (!dependencies.createGroup) {
        setStatus('Native browser groups are unavailable in this browser.', 'error');
        return;
      }

      const activeSuggestions = result?.suggestions.filter(
        (suggestion) => !state.dismissed.has(suggestion.id)
      ) ?? [];
      if (activeSuggestions.length === 0) return;

      const createAllButton = [...results.querySelectorAll('button')].find(
        (button) => button.textContent === 'Create all browser groups'
      );
      if (createAllButton instanceof HTMLButtonElement) {
        createAllButton.disabled = true;
      }

      void Promise.allSettled(
        activeSuggestions.map((suggestion) => {
          const title = state.renamed.get(suggestion.id) ?? suggestion.label;
          return dependencies.createGroup!(suggestion.tabIds, title);
        })
      ).then((outcomes) => {
        const failures = outcomes.filter((outcome) => outcome.status === 'rejected');
        if (failures.length === 0) {
          setStatus(
            `Created ${activeSuggestions.length} browser group${
              activeSuggestions.length === 1 ? '' : 's'
            }.`,
            'success'
          );
        } else {
          const created = outcomes.length - failures.length;
          setStatus(
            `Created ${created} of ${activeSuggestions.length} browser groups. ${
              failures[0]?.status === 'rejected' && failures[0].reason instanceof BrowserApiError
                ? failures[0].reason.message
                : 'Some browser groups could not be created.'
            }`,
            'error'
          );
        }
      });
    },
    onDismiss: (id: string): void => {
      state.dismissed.add(id);
      state.editingId = null;
      rerender();
    },
    onRestore: (id: string): void => {
      state.dismissed.delete(id);
      rerender();
    },
    onStartRename: (id: string): void => {
      state.editingId = id;
      rerender();
    },
    onCancelRename: (): void => {
      state.editingId = null;
      rerender();
    },
    onRename: (id: string, label: string): void => {
      const trimmed = label.trim().slice(0, 60);
      if (trimmed) state.renamed.set(id, trimmed);
      state.editingId = null;
      rerender();
    },
    onShowMoreUnclustered: (): void => {
      state.unclusteredLimit += 50;
      rerender();
    }
  };

  const analyze = async (): Promise<void> => {
    if (busy) return;
    busy = true;
    analyzeButton.disabled = true;
    result = null;
    state = createInitialUiState();
    results.hidden = true;
    results.replaceChildren();
    setStatus('Reading open tabs…');

    try {
      await nextFrame();
      const tabs = await dependencies.fetchTabs();
      if (hasTabAccessProblem(tabs)) {
        setStatus(
          'Tab access is required. Enable the extension’s tab permission in the browser and reload this popup.',
          'error'
        );
        return;
      }

      result = dependencies.analyze(tabs);
      rerender();
      analyzeButton.textContent = 'Analyse again';
    } catch (error) {
      if (error instanceof AnalysisError) {
        setStatus(error.message, 'error');
      } else if (error instanceof BrowserApiError) {
        setStatus(error.message, 'error');
      } else {
        setStatus('The analysis could not be completed. Close and reopen the popup to retry.', 'error');
      }
    } finally {
      busy = false;
      analyzeButton.disabled = false;
    }
  };

  return {
    init(): void {
      version.textContent = `v${dependencies.version}`;
      analyzeButton.addEventListener('click', () => {
        void analyze();
      });
      setStatus('Suggestions only. Your tabs are never moved or closed.', 'none');
    },
    analyze,
    getState(): PopupUiState {
      return state;
    }
  };
}

export const DEFAULT_ANALYZE = analyzeTabs;
