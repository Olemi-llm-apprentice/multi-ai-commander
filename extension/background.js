importScripts('config/targets.js');

const TARGETS = self.TARGET_CONFIG || {};
const DEFAULT_SETTINGS = {
  enabledTargets: Object.keys(TARGETS),
  sendDelayMs: 700,
  voiceInput: false,
  debugLogging: false
};

let runtimeSettings = { ...DEFAULT_SETTINGS };
const debugLogs = [];
const DEBUG_LOG_LIMIT = 200;

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.sync.get('settings');
  if (!stored.settings) {
    await chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });
    runtimeSettings = { ...DEFAULT_SETTINGS };
  } else {
    runtimeSettings = normaliseSettings(stored.settings);
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.windowId) {
    return;
  }
  await chrome.sidePanel.open({ windowId: tab.windowId });
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-side-panel') {
    return;
  }
  const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (activeTab?.windowId) {
    await chrome.sidePanel.open({ windowId: activeTab.windowId });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) {
    return;
  }

  if (message.type === 'settings:get') {
    (async () => {
      const settings = await getCurrentSettings();
      sendResponse({
        settings,
        targets: Object.values(TARGETS).map(({ id, label }) => ({ id, label }))
      });
    })();
    return true;
  }

  if (message.type === 'settings:set') {
    (async () => {
      const nextSettings = normaliseSettings(message.settings);
      await chrome.storage.sync.set({ settings: nextSettings });
      runtimeSettings = nextSettings;
      if (runtimeSettings.debugLogging) {
        addDebugLog('settings:update', { debugLogging: true });
      }
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (message.type === 'prompt:broadcast') {
    (async () => {
      const result = await handleBroadcast(message);
      sendResponse(result);
    })();
    return true;
  }

  if (message.type === 'debug:get') {
    sendResponse({ ok: true, logs: getDebugSnapshot() });
    return false;
  }

  if (message.type === 'debug:clear') {
    clearDebugLogs();
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === 'debug:log') {
    addDebugLog(message.event || 'external', {
      detail: message.detail,
      sender: buildSenderInfo(sender)
    });
    sendResponse({ ok: true });
    return false;
  }
});

async function handleBroadcast(message) {
  const { prompt, targetIds, windowId, options } = message;
  if (!prompt || !Array.isArray(targetIds) || targetIds.length === 0) {
    return { ok: false, error: 'invalid_request' };
  }

  const settings = await getCurrentSettings();
  const delayMs = typeof options?.sendDelayMs === 'number' ? options.sendDelayMs : settings.sendDelayMs;
  const statusUpdates = [];

  addDebugLog('broadcast:init', {
    promptLength: prompt.length,
    targets: targetIds
  });

  for (const targetId of targetIds) {
    const target = TARGETS[targetId];
    if (!target) {
      const update = { targetId, status: 'skipped', reason: 'unknown_target' };
      statusUpdates.push(update);
      broadcastStatus(update);
      addDebugLog('broadcast:target:skipped', update);
      continue;
    }

    broadcastStatus({ targetId, status: 'starting' });
    addDebugLog('broadcast:target:start', { targetId });

    try {
      const tab = await createFreshTab(target, windowId);
      addDebugLog('broadcast:target:tab', { targetId, tabId: tab.id, url: tab.url });
      await waitForDomReady(tab.id, targetId);
      await injectContentScript(tab.id);
      await waitForAdapter(tab.id, targetId);
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'llm-commander:submit',
        targetId,
        prompt,
        config: target
      });
      const update = {
        targetId,
        status: response?.ok ? 'success' : 'failed',
        reason: response?.error
      };
      statusUpdates.push(update);
      broadcastStatus(update);
      addDebugLog('broadcast:target:result', update);
    } catch (error) {
      const update = { targetId, status: 'failed', reason: error.message };
      statusUpdates.push(update);
      broadcastStatus(update);
      addDebugLog('broadcast:target:error', update);
    }

    if (delayMs > 0) {
      await delay(delayMs);
    }
  }

  addDebugLog('broadcast:complete', { results: statusUpdates });
  return { ok: true, updates: statusUpdates };
}

function broadcastStatus(update) {
  chrome.runtime.sendMessage({ type: 'prompt:status', ...update }).catch(() => {});
}

async function createFreshTab(target, requestedWindowId) {
  const createProperties = {
    url: target.newChatUrl,
    active: false
  };
  if (requestedWindowId) {
    createProperties.windowId = requestedWindowId;
  }
  const createdTab = await chrome.tabs.create(createProperties);
  addDebugLog('tab:create', { targetId: target.id, tabId: createdTab.id, url: target.newChatUrl });
  await waitForTabComplete(createdTab.id);
  return createdTab;
}

async function waitForDomReady(tabId, targetId) {
  const target = TARGETS[targetId] || {};
  const primarySelectors = Array.isArray(target.domReadySelectors) ? target.domReadySelectors : [];
  const fallbackSelectors = Array.isArray(target.domReadyFallbackSelectors) ? target.domReadyFallbackSelectors : [];
  const blockerSelectors = Array.isArray(target.domBlockerSelectors) ? target.domBlockerSelectors : [];
  const timeout = target.domReadyTimeout || 15000;
  const intervalMs = 400;
  const deadline = Date.now() + timeout;
  const needsProbe = primarySelectors.length > 0 || fallbackSelectors.length > 0 || blockerSelectors.length > 0;

  while (Date.now() < deadline) {
    let tab;
    try {
      tab = await chrome.tabs.get(tabId);
    } catch (error) {
      throw new Error(`tab_missing:${targetId}`);
    }

    if (!isValidTargetUrl(targetId, tab.url)) {
      addDebugLog('dom:invalid-url', { targetId, tabId, url: tab.url });
      throw new Error(`navigation_blocked:${targetId}`);
    }

    if (!needsProbe) {
      if (tab.status === 'complete') {
        addDebugLog('dom:ready', { targetId, tabId, mode: 'no-selectors' });
        return;
      }
    } else {
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId, allFrames: true },
          func: (primary, fallback, blockers) => {
            const probe = (selectors) => {
              if (!Array.isArray(selectors) || selectors.length === 0) {
                return null;
              }
              for (const selector of selectors) {
                try {
                  const element = document.querySelector(selector);
                  if (element) {
                    return selector;
                  }
                } catch (error) {
                  // ignore invalid selectors
                }
              }
              return null;
            };

            const blockerSelector = probe(blockers);
            const readySelector = probe(primary);
            const fallbackSelector = readySelector ? null : probe(fallback);

            return {
              blockerSelector,
              readySelector,
              fallbackSelector,
              title: document.title,
              readyState: document.readyState
            };
          },
          args: [primarySelectors, fallbackSelectors, blockerSelectors]
        });

        const summary = results.reduce(
          (acc, frame) => {
            const result = frame?.result;
            if (!result) {
              return acc;
            }
            if (!acc.blockerSelector && result.blockerSelector) {
              acc.blockerSelector = result.blockerSelector;
            }
            if (!acc.readySelector && result.readySelector) {
              acc.readySelector = result.readySelector;
            }
            if (!acc.fallbackSelector && result.fallbackSelector) {
              acc.fallbackSelector = result.fallbackSelector;
            }
            if (!acc.title && result.title) {
              acc.title = result.title;
            }
            if (!acc.readyState && result.readyState) {
              acc.readyState = result.readyState;
            }
            return acc;
          },
          { blockerSelector: null, readySelector: null, fallbackSelector: null, title: null, readyState: null }
        );

        if (summary.title && summary.title.toLowerCase().includes('just a moment')) {
          addDebugLog('dom:blocker', { targetId, tabId, title: summary.title });
          throw new Error(`dom_blocker:${targetId}`);
        }

        if (summary.blockerSelector) {
          addDebugLog('dom:blocker', { targetId, tabId, selector: summary.blockerSelector });
          throw new Error(`dom_blocker:${targetId}`);
        }

        if (summary.readySelector) {
          addDebugLog('dom:ready', { targetId, tabId, selector: summary.readySelector });
          return;
        }

        if (summary.fallbackSelector) {
          addDebugLog('dom:ready:fallback', { targetId, tabId, selector: summary.fallbackSelector });
          return;
        }

        if (summary.readyState === 'complete' && primarySelectors.length === 0) {
          addDebugLog('dom:ready', { targetId, tabId, mode: 'readyState' });
          return;
        }
      } catch (error) {
        if (typeof error?.message === 'string' && error.message.startsWith('dom_blocker:')) {
          throw error;
        }
        addDebugLog('dom:probe:error', { targetId, tabId, error: error.message });
      }
    }

    await delay(intervalMs);
  }

  throw new Error(`dom_timeout:${targetId}`);
}
async function injectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/injector.js']
    });
    addDebugLog('adapter:inject', { tabId });
  } catch (error) {
    addDebugLog('adapter:inject:error', { tabId, error: error.message });
  }
}

async function waitForAdapter(tabId, targetId) {
  const maxAttempts = 12;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, {
        type: 'llm-commander:ping',
        targetId
      });
      if (response?.ready) {
        if (attempt > 0) {
          addDebugLog('adapter:ready', { targetId, tabId, attempts: attempt + 1 });
        }
        return;
      }
    } catch (error) {
      addDebugLog('adapter:ping:error', { targetId, tabId, error: error.message });
    }
    await delay(400);
  }
  addDebugLog('adapter:timeout', { targetId, tabId });
  throw new Error(`adapter_timeout:${targetId}`);
}

async function waitForTabComplete(tabId) {
  const tab = await chrome.tabs.get(tabId);
  if (tab.status === 'complete') {
    return;
  }

  await new Promise((resolve) => {
    const listener = (updatedTabId, info) => {
      if (updatedTabId === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function getCurrentSettings() {
  const stored = await chrome.storage.sync.get('settings');
  const settings = normaliseSettings(stored.settings);
  runtimeSettings = settings;
  return settings;
}

function normaliseSettings(input) {
  const settings = { ...DEFAULT_SETTINGS, ...(input || {}) };
  settings.enabledTargets = Array.isArray(settings.enabledTargets)
    ? settings.enabledTargets.filter((id) => TARGETS[id])
    : DEFAULT_SETTINGS.enabledTargets.slice();
  if (settings.enabledTargets.length === 0) {
    settings.enabledTargets = DEFAULT_SETTINGS.enabledTargets.slice();
  }
  if (typeof settings.sendDelayMs !== 'number' || Number.isNaN(settings.sendDelayMs)) {
    settings.sendDelayMs = DEFAULT_SETTINGS.sendDelayMs;
  }
  settings.voiceInput = Boolean(settings.voiceInput);
  settings.debugLogging = Boolean(settings.debugLogging);
  return settings;
}

function addDebugLog(event, detail) {
  if (!runtimeSettings.debugLogging) {
    return;
  }
  const entry = {
    id: generateId(),
    event,
    detail,
    timestamp: new Date().toISOString()
  };
  debugLogs.push(entry);
  if (debugLogs.length > DEBUG_LOG_LIMIT) {
    debugLogs.shift();
  }
  chrome.runtime.sendMessage({ type: 'debug:entry', entry }).catch(() => {});
  console.debug('[Multi AI Commander]', event, detail);
}

function getDebugSnapshot() {
  return debugLogs.slice();
}

function clearDebugLogs() {
  debugLogs.length = 0;
  chrome.runtime.sendMessage({ type: 'debug:cleared' }).catch(() => {});
}

function buildSenderInfo(sender) {
  if (!sender) {
    return null;
  }
  return {
    id: sender.id,
    frameId: sender.frameId,
    url: sender.url,
    tabId: sender.tab?.id
  };
}

function generateId() {
  if (crypto?.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isValidTargetUrl(targetId, url) {
  if (!url) {
    return false;
  }
  try {
    const parsed = new URL(url);
    switch (targetId) {
      case 'chatgpt':
        return parsed.hostname.includes('chatgpt.com') || parsed.hostname.includes('chat.openai.com');
      case 'manus':
        return parsed.hostname.includes('manus.im') && parsed.pathname.startsWith('/app');
      case 'grok':
        return (
          parsed.hostname.includes('grok.com') ||
          parsed.hostname.includes('grok.x.ai') ||
          parsed.hostname.includes('chat.x.ai')
        );
      default:
        return true;
    }
  } catch (error) {
    return false;
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
