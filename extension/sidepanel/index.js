const state = {
  targets: [],
  settings: null,
  statuses: {}
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
  settingDelay: document.getElementById('setting-delay')
};

let recognition = null;
let recognizing = false;

init();

function init() {
  attachEvents();
  loadSettings();
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'prompt:status') {
      state.statuses[message.targetId] = {
        status: message.status,
        reason: message.reason
      };
      renderStatus();
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
    renderTargets();
    applySettingsToUI();
    setupVoiceRecognition();
  } catch (error) {
    ui.progress.textContent = `設定の読み込みに失敗しました: ${error.message}`;
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
  if (state.settings.voiceInput && recognition) {
    ui.voiceStatus.textContent = '音声入力待機中';
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
    ui.progress.textContent = 'プロンプトを入力してください。';
    return;
  }
  const targetIds = state.settings.enabledTargets.slice();
  if (targetIds.length === 0) {
    ui.progress.textContent = '送信先を1つ以上選択してください。';
    return;
  }

  setSending(true);
  state.statuses = {};

  try {
    const currentWindow = await chrome.windows.getCurrent();
    const response = await chrome.runtime.sendMessage({
      type: 'prompt:broadcast',
      prompt,
      targetIds,
      windowId: currentWindow?.id || undefined,
      options: {
        sendDelayMs: state.settings.sendDelayMs
      }
    });
    if (!response?.ok && Object.keys(state.statuses).length === 0) {
      ui.progress.textContent = '送信処理でエラーが発生しました。';
    }
  } catch (error) {
    ui.progress.textContent = `送信に失敗しました: ${error.message}`;
  } finally {
    setSending(false);
  }
}

function setSending(isSending) {
  ui.sendButton.disabled = isSending;
  ui.voiceButton.disabled = isSending;
  if (isSending) {
    ui.progress.textContent = '送信中...';
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
      return '送信準備中';
    case 'success':
      return '送信成功';
    case 'failed':
      return reason ? `失敗 (${reason})` : '失敗';
    case 'skipped':
      return reason ? `スキップ (${reason})` : 'スキップ';
    default:
      return status || '状態不明';
  }
}

function setupVoiceRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    ui.voiceButton.disabled = true;
    ui.voiceStatus.textContent = '音声入力は利用できません';
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = 'ja-JP';
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    recognizing = true;
    ui.voiceStatus.textContent = '録音中...';
    ui.voiceButton.textContent = '■ 停止';
  };

  recognition.onend = () => {
    recognizing = false;
    ui.voiceButton.textContent = '?? 音声';
    ui.voiceStatus.textContent = state.settings.voiceInput ? '音声入力待機中' : '';
  };

  recognition.onerror = (event) => {
    recognizing = false;
    ui.voiceStatus.textContent = `エラー: ${event.error}`;
    ui.voiceButton.textContent = '?? 音声';
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
      ui.voiceStatus.textContent = `録音中... ${interim}`;
    }
  };

  if (state.settings.voiceInput) {
    ui.voiceStatus.textContent = '音声入力待機中';
  }
}

function appendTranscript(text) {
  if (!text) {
    return;
  }
  const current = ui.prompt.value;
  ui.prompt.value = current ? `${current}\n${text}` : text;
}

function toggleVoice() {
  if (!recognition) {
    return;
  }
  if (recognizing) {
    recognition.stop();
  } else {
    try {
      recognition.start();
    } catch (error) {
      ui.voiceStatus.textContent = `開始できませんでした: ${error.message}`;
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
  persistSettings();
  if (state.settings.voiceInput && recognition && !recognizing) {
    ui.voiceStatus.textContent = '音声入力待機中';
  } else if (!state.settings.voiceInput && !recognizing) {
    ui.voiceStatus.textContent = '';
  }
}
