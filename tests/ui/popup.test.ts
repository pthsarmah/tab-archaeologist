// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserApiError } from '../../src/browser/adapter';
import { AnalysisError } from '../../src/core/pipeline';
import type { AnalysisResult } from '../../src/types/cluster';
import { mountPopup } from '../../src/popup/controller';
import { makeDoc } from '../helpers/fixtures';

function baseResult(): AnalysisResult {
  const first = makeDoc({ id: 1, windowId: 7, title: 'Linux <img src=x onerror=alert(1)>', hostname: 'example.test' });
  const second = makeDoc({ id: 2, windowId: 7, title: 'Linux memory', hostname: 'example.test' });
  return {
    suggestions: [
      {
        id: 'cluster-1',
        tabIds: [1, 2],
        tabs: [first, second],
        label: 'Linux',
        terms: ['Linux'],
        explanation: 'Grouped because the tabs share the term "Linux". Average similarity 0.62.',
        avgSimilarity: 0.62,
        medoidTabId: 1
      }
    ],
    unclustered: [],
    skipped: [],
    stats: {
      analyzedCount: 2,
      skippedCount: 0,
      clusterCount: 1,
      unclusteredCount: 0,
      durationMs: 1
    }
  };
}

function emptyResult(): AnalysisResult {
  return {
    suggestions: [],
    unclustered: [],
    skipped: [],
    stats: {
      analyzedCount: 0,
      skippedCount: 0,
      clusterCount: 0,
      unclusteredCount: 0,
      durationMs: 0
    }
  };
}

function setup(createGroup?: (tabIds: number[], title: string) => Promise<void>) {
  document.body.innerHTML = `
    <button id="analyze" type="button"></button>
    <p id="status"></p>
    <section id="results" hidden></section>
    <span id="version"></span>
  `;
  const openTab = vi.fn(async () => undefined);
  const analyze = vi.fn(() => baseResult());
  const fetchTabs = vi.fn(async () => [
    { id: 1, title: 'Linux', url: 'https://example.test/linux' },
    { id: 2, title: 'Linux memory', url: 'https://example.test/memory' }
  ]);
  const controller = mountPopup(document, {
    fetchTabs,
    analyze,
    openTab,
    createGroup,
    version: '0.1.0'
  });
  controller.init();
  return { controller, openTab, analyze, fetchTabs };
}

function setupWithGroups() {
  const createGroup = vi.fn(async () => undefined);
  return { ...setup(createGroup), createGroup };
}

function buttonWithText(label: string): HTMLButtonElement {
  const button = [...document.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === label
  );
  if (!button) throw new Error(`Button not found: ${label}`);
  return button as HTMLButtonElement;
}

describe('popup controller', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders a result, label, explanation and safe titles', async () => {
    const { controller } = setup();
    await controller.analyze();

    expect(document.querySelector('.cluster-label')?.textContent).toBe('Linux');
    expect(document.querySelector('.cluster-explanation')?.textContent).toContain('share the term');
    expect(document.querySelectorAll('.cluster-card')).toHaveLength(1);
    expect(document.querySelector('img')).toBeNull();
    expect(document.querySelector('.tab-title')?.textContent).toContain('<img');
    expect(document.getElementById('version')?.textContent).toBe('v0.1.0');
  });

  it('opens a tab without applying any other tab operation', async () => {
    const { controller, openTab } = setup();
    await controller.analyze();
    document.querySelector('.tab-button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(openTab).toHaveBeenCalledWith(1, 7);
  });

  it('dismisses and restores a suggestion', async () => {
    const { controller } = setup();
    await controller.analyze();
    buttonWithText('Dismiss').click();
    expect(document.querySelector('.cluster-card:not(.dismissed-card)')).toBeNull();
    expect(document.body.textContent).toContain('Dismissed (1)');
    buttonWithText('Restore').click();
    expect(document.querySelector('.cluster-label')?.textContent).toBe('Linux');
  });

  it('renames a label in the view only', async () => {
    const { controller } = setup();
    await controller.analyze();
    buttonWithText('Rename').click();
    const input = document.querySelector('.rename-form input') as HTMLInputElement;
    expect(input).toBeTruthy();
    input.value = 'Kernel reading';
    input.form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(document.querySelector('.cluster-label')?.textContent).toBe('Kernel reading');
    expect(controller.getState().renamed.get('cluster-1')).toBe('Kernel reading');
  });

  it('creates all active browser groups from one button', async () => {
    const { controller, createGroup } = setupWithGroups();
    await controller.analyze();
    buttonWithText('Create all browser groups').click();
    await vi.waitFor(() => expect(createGroup).toHaveBeenCalledWith([1, 2], 'Linux'));
    await vi.waitFor(() =>
      expect(document.getElementById('status')?.textContent).toContain('Created 1 browser group')
    );
  });

  it('shows a permission message when tab URLs are unavailable', async () => {
    const fetchTabs = vi.fn(async () => [{ id: 1, title: 'No access' }]);
    const analyze = vi.fn(() => baseResult());
    document.body.innerHTML = `
      <button id="analyze"></button><p id="status"></p>
      <section id="results" hidden></section><span id="version"></span>
    `;
    const controller = mountPopup(document, {
      fetchTabs,
      analyze,
      openTab: vi.fn(async () => undefined),
      version: '0.1.0'
    });
    controller.init();
    await controller.analyze();
    expect(document.getElementById('status')?.textContent).toContain('Tab access is required');
    expect(analyze).not.toHaveBeenCalled();
  });

  it('shows the empty state for zero tabs', async () => {
    const fetchTabs = vi.fn(async () => []);
    const analyze = vi.fn(() => emptyResult());
    document.body.innerHTML = `
      <button id="analyze"></button><p id="status"></p>
      <section id="results" hidden></section><span id="version"></span>
    `;
    const controller = mountPopup(document, {
      fetchTabs,
      analyze,
      openTab: vi.fn(async () => undefined),
      version: '0.1.0'
    });
    controller.init();
    await controller.analyze();
    expect(document.getElementById('status')?.textContent).toContain('No analysable tabs');
    expect(document.getElementById('results')?.hidden).toBe(false);
  });

  it('shows a browser error', async () => {
    const fetchTabs = vi.fn(async () => {
      throw new BrowserApiError('QUERY_FAILED', 'Tab metadata could not be read.');
    });
    document.body.innerHTML = `
      <button id="analyze"></button><p id="status"></p>
      <section id="results" hidden></section><span id="version"></span>
    `;
    const controller = mountPopup(document, {
      fetchTabs,
      analyze: vi.fn(() => baseResult()),
      openTab: vi.fn(async () => undefined),
      version: '0.1.0'
    });
    controller.init();
    await controller.analyze();
    expect(document.getElementById('status')?.textContent).toContain('could not be read');
  });

  it('shows the tab-cap error', async () => {
    const fetchTabs = vi.fn(async () => [{ id: 1, url: 'https://example.test' }]);
    const analyze = vi.fn(() => {
      throw new AnalysisError('TOO_MANY_TABS', 'This analysis is limited to 500 tabs.');
    });
    document.body.innerHTML = `
      <button id="analyze"></button><p id="status"></p>
      <section id="results" hidden></section><span id="version"></span>
    `;
    const controller = mountPopup(document, {
      fetchTabs,
      analyze,
      openTab: vi.fn(async () => undefined),
      version: '0.1.0'
    });
    controller.init();
    await controller.analyze();
    expect(document.getElementById('status')?.textContent).toContain('limited to 500');
  });
});
