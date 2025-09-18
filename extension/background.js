const LLM_TARGETS = {
  chatgpt: {
    id: 'chatgpt',
    label: 'ChatGPT',
    newChatUrl: 'https://chat.openai.com/',
    urlPatterns: ['https://chat.openai.com/*']
  },
  manus: {
    id: 'manus',
    label: 'Manus',
    newChatUrl: 'https://app.manus.ai/',
    urlPatterns: ['https://app.manus.ai/*', 'https://*.manus.app/*']
  },
  grok: {
    id: 'grok',
    label: 'Grok',
    newChatUrl: 'https://grok.com/',
    urlPatterns: ['https://grok.com/*', 'https://*.grok.com/*', 'https://*.x.ai/*']
  }
};

const DEFAULT_SETTINGS = {
  enabledTargets: Object.keys(LLM_TARGETS),
  sendDelayMs: 700,
  voiceInput: false
};

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.sync.get('settings');
  if (!stored.settings) {
    await chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });
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
        targets: Object.values(LLM_TARGETS)
      });
    })();
    return true;
  }

  if (message.type === 'settings:set') {
    (async () => {
      const nextSettings = normaliseSettings(message.settings);
      await chrome.storage.sync.set({ settings: nextSettings });
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
});

async function handleBroadcast(message) {
  const { prompt, targetIds, windowId, options } = message;
  if (!prompt || !Array.isArray(targetIds) || targetIds.length === 0) {
    return { ok: false, error: 'invalid_request' };
  }

  const settings = await getCurrentSettings();
  const delayMs = typeof options?.sendDelayMs === 'number' ? options.sendDelayMs : settings.sendDelayMs;
  const statusUpdates = [];

  for (const targetId of targetIds) {
    const target = LLM_TARGETS[targetId];
    if (!target) {
      const update = { targetId, status: 'skipped', reason: 'unknown_target' };
      statusUpdates.push(update);
      broadcastStatus(update);
      continue;
    }

    broadcastStatus({ targetId, status: 'starting' });

    try {
      const tab = await ensureTabForTarget(target, windowId);
      await waitForAdapter(tab.id, targetId);
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'llm-commander:submit',
        targetId,
        prompt
      });
      const update = {
        targetId,
        status: response?.ok ? 'success' : 'failed',
        reason: response?.error
      };
      statusUpdates.push(update);
      broadcastStatus(update);
    } catch (error) {
      const update = { targetId, status: 'failed', reason: error.message };
      statusUpdates.push(update);
      broadcastStatus(update);
    }

    if (delayMs > 0) {
      await delay(delayMs);
    }
  }

  return { ok: true, updates: statusUpdates };
}

function broadcastStatus(update) {
  chrome.runtime.sendMessage({ type: 'prompt:status', ...update }).catch(() => {});
}

async function ensureTabForTarget(target, requestedWindowId) {
  const existingTabs = await chrome.tabs.query({ url: target.urlPatterns });
  const candidate = existingTabs.find((tab) => !requestedWindowId || tab.windowId === requestedWindowId);
  if (candidate) {
    return candidate;
  }

  const createProperties = {
    url: target.newChatUrl,
    active: false
  };
  if (requestedWindowId) {
    createProperties.windowId = requestedWindowId;
  }
  const createdTab = await chrome.tabs.create(createProperties);
  await waitForTabComplete(createdTab.id);
  return createdTab;
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
        return;
      }
    } catch (error) {
      // retry after delay
    }
    await delay(400);
  }
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
  return normaliseSettings(stored.settings);
}

function normaliseSettings(input) {
  const settings = { ...DEFAULT_SETTINGS, ...(input || {}) };
  settings.enabledTargets = Array.isArray(settings.enabledTargets)
    ? settings.enabledTargets.filter((id) => LLM_TARGETS[id])
    : DEFAULT_SETTINGS.enabledTargets.slice();
  if (settings.enabledTargets.length === 0) {
    settings.enabledTargets = DEFAULT_SETTINGS.enabledTargets.slice();
  }
  if (typeof settings.sendDelayMs !== 'number' || Number.isNaN(settings.sendDelayMs)) {
    settings.sendDelayMs = DEFAULT_SETTINGS.sendDelayMs;
  }
  settings.voiceInput = Boolean(settings.voiceInput);
  return settings;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}