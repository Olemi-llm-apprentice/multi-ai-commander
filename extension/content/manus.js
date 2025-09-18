(() => {
  const bridge = window.MultiAICommander;
  if (!bridge) {
    console.warn('MultiAICommander bridge is missing');
    return;
  }
  const { registerAdapter, utils } = bridge;

  const INPUT_SELECTORS = [
    'textarea[data-testid="prompt-input"]',
    'textarea[placeholder*="AI"]',
    'div[contenteditable="true"] textarea',
    'div[contenteditable="true"]'
  ];

  const SEND_SELECTORS = [
    'button[data-testid="send-button"]',
    'button[type="submit"]',
    'button[aria-label*="Send"]',
    'button[aria-label*="送信"]'
  ];

  function findInput() {
    for (const selector of INPUT_SELECTORS) {
      const el = document.querySelector(selector);
      if (el) {
        return el;
      }
    }
    return null;
  }

  function findSendButton() {
    for (const selector of SEND_SELECTORS) {
      const el = document.querySelector(selector);
      if (el) {
        return el;
      }
    }
    return null;
  }

  async function ensureNewChat() {
    const newChatSelectors = [
      'a[href="/app/new"]',
      'button[data-testid="compose-button"]',
      'button[aria-label*="New"]',
      'button[aria-label*="Compose"]',
      'button span'
    ];
    for (const selector of newChatSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        if (selector === 'button span') {
          const text = element.textContent?.trim().toLowerCase();
          if (!text || !['new', 'compose', '新規', '新しい'].some((keyword) => text.includes(keyword))) {
            continue;
          }
        }
        element.click();
        utils.logDebug('manus:new-chat:clicked', selector);
        await waitForIdle();
        return;
      }
    }
  }

  async function waitForIdle() {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  registerAdapter('manus', {
    async ensureReady() {
      await ensureNewChat();
    },
    isReady() {
      return Boolean(findInput());
    },
    async submitPrompt(prompt) {
      const input = findInput();
      if (!input) {
        throw new Error('input_not_found');
      }
      if (input instanceof HTMLTextAreaElement) {
        utils.focusElement(input);
        utils.setTextValue(input, '');
        utils.setTextValue(input, prompt);
      } else {
        input.focus({ preventScroll: true });
        input.textContent = '';
        input.textContent = prompt;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const sendButton = findSendButton();
      if (sendButton) {
        utils.clickElement(sendButton);
      } else {
        utils.simulateEnter(input);
      }
      await waitForIdle();
    }
  });
})();
