import './popup.css';
import { activateTab, createTabGroup, fetchCurrentWindowTabs } from '../browser/adapter';
import { analyzeTabs } from '../core/pipeline';
import { mountPopup } from './controller';

const popup = mountPopup(document, {
  fetchTabs: () => fetchCurrentWindowTabs(),
  analyze: (tabs) => analyzeTabs(tabs),
  openTab: (tabId, windowId) => activateTab(tabId, windowId),
  createGroup: (tabIds, title) => createTabGroup(tabIds, title),
  version: __APP_VERSION__
});

popup.init();
