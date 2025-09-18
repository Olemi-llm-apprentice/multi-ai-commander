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
    'textarea[placeholder*="メッセージ"]',
    'textarea[placeholder*="message"]',
    'textarea'
  ];

  const SEND_SELECTORS = [
    'button[data-testid="send-button"]',
    'button[aria-label*="送信"]',
    'button[aria-label*="Send"]'
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

  registerAdapter('chatgpt', {
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
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  });
})();
