(() => {
  const bridge = window.MultiAICommander;
  if (!bridge) {
    console.warn('MultiAICommander bridge is missing');
    return;
  }
  const { registerAdapter, utils } = bridge;

  const INPUT_SELECTORS = [
    'textarea[data-id="root"]',
    'textarea[data-id="prompt-textarea"]',
    'textarea[placeholder*="message"]',
    'div[data-testid="conversation-turn"] textarea',
    'textarea'
  ];

  const SEND_SELECTORS = [
    'button[data-testid="send-button"]',
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
    const newChatButtonSelectors = [
      'button[data-testid="new-conversation-button"]',
      'a[href="/new"]'
    ];
    for (const selector of newChatButtonSelectors) {
      const button = document.querySelector(selector);
      if (button) {
        button.click();
        await waitForIdle();
        break;
      }
    }
  }

  async function waitForIdle() {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  registerAdapter('chatgpt', {
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
      utils.focusElement(input);
      utils.setTextValue(input, '');
      utils.setTextValue(input, prompt);
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