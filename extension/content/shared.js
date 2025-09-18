(() => {
  if (window.MultiAICommander) {
    return;
  }

  const adapters = new Map();

  const utils = {
    setTextValue(element, value) {
      if (!element) {
        throw new Error('input_not_found');
      }
      const nativeSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')?.set;
      const valueSetter = nativeSetter || Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      if (valueSetter) {
        valueSetter.call(element, value);
      } else {
        element.value = value;
      }
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    },
    simulateEnter(element) {
      if (!element) {
        return;
      }
      element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
      element.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    },
    focusElement(el) {
      if (!el) {
        return;
      }
      el.focus({ preventScroll: true });
    },
    clickElement(el) {
      if (!el) {
        return;
      }
      el.click();
    }
  };

  function registerAdapter(id, adapter) {
    adapters.set(id, adapter);
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.type) {
      return;
    }

    if (message.type === 'llm-commander:ping') {
      const adapter = adapters.get(message.targetId);
      const ready = adapter && typeof adapter.isReady === 'function' ? adapter.isReady() : Boolean(adapter);
      Promise.resolve(ready)
        .then((value) => sendResponse({ ready: Boolean(value) }))
        .catch(() => sendResponse({ ready: false }));
      return true;
    }

    if (message.type === 'llm-commander:submit') {
      const adapter = adapters.get(message.targetId);
      if (!adapter) {
        sendResponse({ ok: false, error: 'adapter_missing' });
        return;
      }
      (async () => {
        try {
          if (adapter.ensureReady) {
            await adapter.ensureReady();
          }
          await adapter.submitPrompt(message.prompt, utils);
          sendResponse({ ok: true });
        } catch (error) {
          sendResponse({ ok: false, error: error?.message || 'unknown_error' });
        }
      })();
      return true;
    }
  });

  window.MultiAICommander = {
    registerAdapter,
    utils
  };
})();
