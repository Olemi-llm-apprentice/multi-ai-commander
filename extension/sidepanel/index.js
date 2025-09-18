const state = {
  targets: [],
  settings: null,
  statuses: {},
  debugLogs: []
};

const ui = {
  prompt: document.getElementById('prompt'),
  sendButton: document.getElementById('send-button'),
  targetsContainer: document.getElementById('targets-container'),
  progress: document.getElementById('progress'),
  voiceButton: document.getElementById('voice-button'),
  voiceStatus: document.getElementById('voice-status'),
  settingsButton: document.getElementById('open-settings'),
  settingsDialog: document.getElementById('settings-dialog'),
  settingVoice: document.getElementById('setting-voice'),
  settingDelay: document.getElementById('setting-delay'),
  settingDebug: document.getElementById('setting-debug'),
  debugSection: document.getElementById('debug-section'),
  debugOutput: document.getElementById('debug-output'),
  debugRefresh: document.getElementById('debug-refresh'),
  debugClear: document.getElementById('debug-clear')
};

let recognition = null;
let recognizing = false;
let micPermissionGranted = false;

init();

function init() {
  attachEvents();
  loadSettings();
  chrome.runtime.onMessage.addListener((message) => {
    if (!message?.type) {
      return;
    }
    if (message.type === 'prompt:status') {
      state.statuses[message.targetId] = {
        status: message.status,
        reason: message.reason
      };
      renderStatus();
      return;
    }
    if (message.type === 'debug:entry') {
      handleDebugEntry(message.entry);
      return;
    }
    if (message.type === 'debug:cleared') {
      state.debugLogs = [];
      renderDebugLogs();
    }
  });
}

function attachEvents() {
  ui.sendButton.addEventListener('click', onSendClick);
  ui.prompt.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      onSendClick();
    }
  });
  ui.voiceButton.addEventListener('click', toggleVoice);
  ui.settingsButton.addEventListener('click', () => ui.settingsDialog.showModal());
  ui.settingsDialog.addEventListener('close', onSettingsDialogClose);
  ui.debugRefresh.addEventListener('click', () => {
    loadDebugLogs();
  });
  ui.debugClear.addEventListener('click', async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'debug:clear' });
    } catch (error) {
      ui.progress.textContent = `Failed to clear logs: ${error.message}`;
    }
  });
}

async function loadSettings() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'settings:get' });
    state.targets = response.targets || [];
    state.settings = response.settings || {};
    if (!state.settings.enabledTargets) {
      state.settings.enabledTargets = state.targets.map((t) => t.id);
    }
    if (typeof state.settings.sendDelayMs !== 'number') {
      state.settings.sendDelayMs = 700;
    }
    state.settings.debugLogging = Boolean(state.settings.debugLogging);
    renderTargets();
    applySettingsToUI();
    setupVoiceRecognition();
    if (state.settings.debugLogging) {
      loadDebugLogs();
    }
  } catch (error) {
    ui.progress.textContent = `Failed to load settings: ${error.message}`;
  }
}

function renderTargets() {
  ui.targetsContainer.innerHTML = '';
  state.targets.forEach((target) => {
    const template = document.getElementById('target-template');
    const clone = template.content.cloneNode(true);
    const checkbox = clone.querySelector('.target-checkbox');
    const label = clone.querySelector('.target-label');
    checkbox.value = target.id;
    checkbox.checked = state.settings.enabledTargets.includes(target.id);
    checkbox.addEventListener('change', onTargetToggle);
    label.textContent = target.label;
    ui.targetsContainer.appendChild(clone);
  });
}

function applySettingsToUI() {
  ui.settingVoice.checked = Boolean(state.settings.voiceInput);
  ui.settingDelay.value = state.settings.sendDelayMs;
  ui.settingDebug.checked = Boolean(state.settings.debugLogging);
  updateDebugVisibility();
  if (state.settings.voiceInput && recognition) {
    ui.voiceStatus.textContent = 'Voice input ready';
  }
}

function updateDebugVisibility() {
  const enabled = Boolean(state.settings?.debugLogging);
  ui.debugSection.classList.toggle('hidden', !enabled);
  if (!enabled) {
    state.debugLogs = [];
    renderDebugLogs();
  }
}

function onTargetToggle(event) {
  const checkbox = event.target;
  if (!checkbox.checked) {
    state.settings.enabledTargets = state.settings.enabledTargets.filter((id) => id !== checkbox.value);
  } else if (!state.settings.enabledTargets.includes(checkbox.value)) {
    state.settings.enabledTargets.push(checkbox.value);
  }
  persistSettings();
}

async function onSendClick() {
  if (!state.settings) {
    return;
  }
  const prompt = ui.prompt.value.trim();
  if (!prompt) {
    ui.progress.textContent = 'Please enter a prompt.';
    return;
  }
  const targetIds = state.settings.enabledTargets.slice();
  if (targetIds.length === 0) {
    ui.progress.textContent = 'Select at least one target.';
    return;
  }

  setSending(true);
  state.statuses = {};

  try {
    const currentWindow = await chrome.windows.getCurrent();
    await chrome.runtime.sendMessage({
      type: 'prompt:broadcast',
      prompt,
      targetIds,
      windowId: currentWindow?.id || undefined,
      options: {
        sendDelayMs: state.settings.sendDelayMs
      }
    });
  } catch (error) {
    ui.progress.textContent = `Failed to send: ${error.message}`;
  } finally {
    setSending(false);
  }
}

function setSending(isSending) {
  ui.sendButton.disabled = isSending;
  ui.voiceButton.disabled = isSending;
  if (isSending) {
    ui.progress.textContent = 'Sending...';
  } else if (Object.keys(state.statuses).length === 0) {
    ui.progress.textContent = '';
  }
}

function renderStatus() {
  if (Object.keys(state.statuses).length === 0) {
    return;
  }
  ui.progress.innerHTML = '';
  Object.entries(state.statuses).forEach(([targetId, info]) => {
    const target = state.targets.find((t) => t.id === targetId);
    const line = document.createElement('div');
    line.className = 'status-line';
    const label = document.createElement('span');
    label.textContent = target ? target.label : targetId;
    const status = document.createElement('span');
    status.textContent = formatStatus(info.status, info.reason);
    line.append(label, status);
    ui.progress.appendChild(line);
  });
}

function formatStatus(status, reason) {
  switch (status) {
    case 'starting':
      return 'Preparing';
    case 'success':
      return 'Sent';
    case 'failed':
      return reason ? `Failed (${reason})` : 'Failed';
    case 'skipped':
      return reason ? `Skipped (${reason})` : 'Skipped';
    default:
      return status || 'Unknown';
  }
}

function setupVoiceRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    ui.voiceButton.disabled = true;
    ui.voiceStatus.textContent = 'Voice input unavailable';
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = 'ja-JP';
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    recognizing = true;
    ui.voiceStatus.textContent = 'Listening...';
    ui.voiceButton.textContent = 'Stop Voice';
  };

  recognition.onend = () => {
    recognizing = false;
    ui.voiceButton.textContent = 'Start Voice';
    ui.voiceStatus.textContent = state.settings.voiceInput ? 'Voice input ready' : '';
  };

  recognition.onerror = (event) => {
    recognizing = false;
    ui.voiceStatus.textContent = `Error: ${event.error}`;
    ui.voiceButton.textContent = 'Start Voice';
  };

  recognition.onresult = (event) => {
    let interim = '';
    let finalText = '';
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalText += transcript;
      } else {
        interim += transcript;
      }
    }
    if (finalText) {
      appendTranscript(finalText);
    }
    if (interim) {
      ui.voiceStatus.textContent = `Listening... ${interim}`;
    }
  };

  if (state.settings.voiceInput) {
    ui.voiceStatus.textContent = 'Voice input ready';
  }
}

async function ensureMicrophonePermission() {
  if (micPermissionGranted) {
    return true;
  }
  const mediaDevices = navigator?.mediaDevices;
  if (!mediaDevices?.getUserMedia) {
    // Browser does not expose permissions API; assume allowed.
    micPermissionGranted = true;
    return true;
  }
  try {
    const stream = await mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    micPermissionGranted = true;
    ui.voiceStatus.textContent = 'Voice input ready';
    return true;
  } catch (error) {
    const message = error?.name === 'NotAllowedError'
      ? 'Microphone access was blocked. Enable it in Chrome settings and try again.'
      : `Microphone error: ${error.message}`;
    ui.voiceStatus.textContent = message;
    ui.voiceButton.textContent = 'Start Voice';
    return false;
  }
}function appendTranscript(text) {
  if (!text) {
    return;
  }
  const current = ui.prompt.value;
  ui.prompt.value = current ? `${current}\n${text}` : text;
}

async function toggleVoice() {
  if (!recognition) {
    return;
  }
  if (recognizing) {
    recognition.stop();
    return;
  }
  const permissionOk = await ensureMicrophonePermission();
  if (!permissionOk) {
    return;
  }
  try {
    recognition.start();
  } catch (error) {
    ui.voiceStatus.textContent = `Could not start: ${error.message}`;
    ui.voiceButton.textContent = 'Start Voice';
  }
}
  if (recognizing) {
    recognition.stop();
  } else {
    try {
      recognition.start();
    } catch (error) {
      ui.voiceStatus.textContent = `Could not start: ${error.message}`;
    }
  }
}

async function persistSettings() {
  await chrome.runtime.sendMessage({
    type: 'settings:set',
    settings: state.settings
  });
}

function onSettingsDialogClose() {
  if (ui.settingsDialog.returnValue !== 'ok') {
    return;
  }
  state.settings.voiceInput = ui.settingVoice.checked;
  state.settings.sendDelayMs = Number(ui.settingDelay.value) || 0;
  const debugBefore = Boolean(state.settings.debugLogging);
  state.settings.debugLogging = ui.settingDebug.checked;
  persistSettings();
  updateDebugVisibility();
  if (state.settings.debugLogging) {
    if (!debugBefore) {
      loadDebugLogs();
    }
  }
  if (state.settings.voiceInput && recognition && !recognizing) {
    ui.voiceStatus.textContent = 'Voice input ready';
  } else if (!state.settings.voiceInput && !recognizing) {
    ui.voiceStatus.textContent = '';
  }
}

async function loadDebugLogs() {
  if (!state.settings?.debugLogging) {
    return;
  }
  try {
    const response = await chrome.runtime.sendMessage({ type: 'debug:get' });
    if (response?.ok) {
      state.debugLogs = Array.isArray(response.logs) ? response.logs : [];
      renderDebugLogs();
    }
  } catch (error) {
    ui.progress.textContent = `Failed to load logs: ${error.message}`;
  }
}

function handleDebugEntry(entry) {
  if (!state.settings?.debugLogging || !entry) {
    return;
  }
  state.debugLogs.push(entry);
  if (state.debugLogs.length > 200) {
    state.debugLogs.shift();
  }
  renderDebugLogs();
}

function renderDebugLogs() {
  if (!state.settings?.debugLogging) {
    ui.debugOutput.textContent = '';
    return;
  }
  const lines = state.debugLogs.map((entry) => {
    const detail = typeof entry.detail === 'object' ? JSON.stringify(entry.detail) : String(entry.detail ?? '');
    return `${entry.timestamp || ''}  ${entry.event || ''}\n${detail}`.trim();
  });
  ui.debugOutput.textContent = lines.join('\n\n');
  ui.debugOutput.scrollTop = ui.debugOutput.scrollHeight;
}












