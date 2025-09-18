(() => {
  const bridge = window.MultiAICommander;
  if (!bridge) {
    console.warn('MultiAICommander bridge is missing');
    return;
  }
  const { registerAdapter, utils } = bridge;

  const INPUT_SELECTORS = [
    'textarea[data-testid="prompt-input"]',
    'div[contenteditable="true"][data-placeholder]',
    'textarea[placeholder*="Ask"]',
    'textarea'
  ];

  const SEND_SELECTORS = [
    'button[data-testid="send-button"]',
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

  registerAdapter('grok', {
    isReady() {
      return Boolean(findInput());
    },
    async submitPrompt(prompt) {
      const input = findInput();
      if (!input) {
        throw new Error('input_not_found');
      }

      if (input.getAttribute && input.getAttribute('contenteditable') === 'true') {
        input.focus({ preventScroll: true });
        input.textContent = '';
        input.textContent = prompt;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        utils.focusElement(input);
        utils.setTextValue(input, '');
        utils.setTextValue(input, prompt);
      }

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