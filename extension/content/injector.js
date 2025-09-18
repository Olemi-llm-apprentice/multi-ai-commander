(() => {
  const SLEEP_MS = 200;
  const ELEMENT_RETRY_DELAY_MS = 250;
  const INPUT_RETRY_ATTEMPTS = 30;
  const SUBMIT_RETRY_ATTEMPTS = 12;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message?.type) {
      return;
    }

    if (message.type === 'llm-commander:ping') {
      sendResponse({ ready: true });
      return false;
    }

    if (message.type === 'llm-commander:submit') {
      (async () => {
        try {
          await handleSubmit(message.config, message.prompt);
          sendResponse({ ok: true });
        } catch (error) {
          logDebug('injector:error', { message: error?.message, targetId: message.config?.id });
          sendResponse({ ok: false, error: error?.message || 'submit_failed' });
        }
      })();
      return true;
    }
  });

  async function handleSubmit(config, prompt) {
    if (!config) {
      throw new Error('missing_config');
    }
    if (Array.isArray(config.newChatActions)) {
      await performNewChatActions(config.newChatActions, config.id);
    }

    const input = await waitForElement(config.inputSelectors || []);
    if (!input) {
      throw new Error('input_not_found');
    }

    await setInputValue(input, prompt);
    await waitForUiReaction();

    const submitted = await submitInput(config.submitSelectors || [], input);
    if (!submitted) {
      simulateEnter(input);
      await waitForUiReaction();
    }
  }

  async function performNewChatActions(actions, targetId) {
    for (const action of actions) {
      const element = findClickableElement(action);
      if (!element) {
        continue;
      }
      element.click();
      logDebug('injector:new-chat:click', { targetId, selector: action.selectors });
      await waitForUiReaction(400);
      break;
    }
  }

  function findClickableElement(action) {
    const selectors = action?.selectors || [];
    const textFilters = (action?.textIncludes || []).map((t) => t.toLowerCase());
    for (const selector of selectors) {
      const candidates = document.querySelectorAll(selector);
      for (const candidate of candidates) {
        if (!isElementVisible(candidate)) {
          continue;
        }
        if (textFilters.length > 0) {
          const text = candidate.textContent?.toLowerCase() ?? '';
          if (!textFilters.some((needle) => text.includes(needle))) {
            continue;
          }
        }
        return candidate;
      }
    }
    return null;
  }

  function findElement(selectors) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && isElementVisible(element)) {
        return element;
      }
    }
    return null;
  }

  async function waitForElement(selectors, attempts = INPUT_RETRY_ATTEMPTS, delayMs = ELEMENT_RETRY_DELAY_MS) {
    if (!Array.isArray(selectors) || selectors.length === 0) {
      return null;
    }
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const element = findElement(selectors);
      if (element) {
        if (attempt > 0) {
          logDebug('injector:element:wait', { selectors, attempts: attempt + 1 });
        }
        return element;
      }
      await waitForUiReaction(delayMs);
    }
    return null;
  }
  async function setInputValue(element, value) {
    const tagName = element.tagName?.toLowerCase();
    if (tagName === 'textarea' || tagName === 'input') {
      const nativeSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')?.set;
      if (nativeSetter) {
        nativeSetter.call(element, value);
      } else {
        element.value = value;
      }
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    if (element.isContentEditable) {
      element.focus({ preventScroll: true });
      element.innerHTML = '';
      document.execCommand('insertText', false, value);
      element.dispatchEvent(new InputEvent('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    throw new Error('unsupported_input');
  }

  async function submitInput(selectors, fallbackElement) {
    if (Array.isArray(selectors) && selectors.length > 0) {
      for (let attempt = 0; attempt < SUBMIT_RETRY_ATTEMPTS; attempt += 1) {
        const element = findElement(selectors);
        if (element) {
          if (element.disabled) {
            await waitForUiReaction(ELEMENT_RETRY_DELAY_MS);
            continue;
          }
          element.click();
          await waitForUiReaction();
          return true;
        }
        await waitForUiReaction(ELEMENT_RETRY_DELAY_MS);
      }
    }

    if (fallbackElement?.form) {
      fallbackElement.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await waitForUiReaction();
      return true;
    }

    return false;
  }

  function simulateEnter(element) {
    const eventInit = {
      bubbles: true,
      cancelable: true,
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13
    };
    element.dispatchEvent(new KeyboardEvent('keydown', eventInit));
    element.dispatchEvent(new KeyboardEvent('keyup', eventInit));
  }

  function isElementVisible(element) {
    if (!element) {
      return false;
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function waitForUiReaction(ms = SLEEP_MS) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function logDebug(event, detail) {
    try {
      chrome.runtime.sendMessage({ type: 'debug:log', event, detail });
    } catch (error) {
      // ignore
    }
  }
})();










