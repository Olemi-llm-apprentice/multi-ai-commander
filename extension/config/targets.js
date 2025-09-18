(() => {
  const TARGET_CONFIG = {
    chatgpt: {
      id: 'chatgpt',
      label: 'ChatGPT',
      newChatUrl: 'https://chatgpt.com/',
      domReadySelectors: [
        'div.ProseMirror',
        '#prompt-textarea',
        'textarea[name="prompt-textarea"]',
        'div[contenteditable="true"][data-id="root"]'
      ],
      domReadyTimeout: 15000,
      inputSelectors: [
        '#prompt-textarea',
        'textarea[name="prompt-textarea"]',
        'textarea[data-id="prompt-textarea"]',
        'div[contenteditable="true"][data-id="root"]',
        'div[contenteditable="true"]'
      ],
      submitSelectors: [
        'button[data-testid="send-button"]',
        'button[aria-label*="Send"]',
        'button[type="submit"]'
      ],
      newChatActions: [
        { selectors: ['button[data-testid="new-conversation-button"]', 'a[href="/new"]'] }
      ]
    },
    manus: {
      id: 'manus',
      label: 'Manus',
      newChatUrl: 'https://manus.im/app',
      domReadySelectors: [
        'textarea[data-testid="prompt-input"]',
        'div[role="textbox"]',
        'div[contenteditable="true"]'
      ],
      domReadyFallbackSelectors: [
        'div[role="textbox"]',
        'textarea',
        'div[contenteditable="true"]'
      ],
      domBlockerSelectors: [
        'form[action*="login"]',
        'form[action*="signin"]',
        'div[data-testid="auth-container"]'
      ],
      domReadyTimeout: 60000,
      inputSelectors: [
        'textarea[data-testid="prompt-input"]',
        'div[role="textbox"]',
        'textarea',
        'div[contenteditable="true"]'
      ],
      submitSelectors: [
        'button[data-testid="send-button"]',
        'button[type="submit"]',
        'button[aria-label*="Send"]'
      ],
      newChatActions: [
        { selectors: ['a[href="/app/new"]'] },
        { selectors: ['button', 'a'], textIncludes: ['new', 'compose', 'create', 'start'] }
      ]
    },
    grok: {
      id: 'grok',
      label: 'Grok',
      newChatUrl: 'https://grok.com/',
      domReadySelectors: [
        'div.tiptap.ProseMirror',
        'div[contenteditable="true"]',
        'textarea[placeholder*="何"]',
        'textarea[placeholder*="ask"]'
      ],
      domReadyFallbackSelectors: [
        'div[role="textbox"]',
        'textarea',
        'div[contenteditable="true"]'
      ],
      domBlockerSelectors: [
        'form[action*="login"]',
        'div.cf-browser-verification',
        'div.main-content'
      ],
      domReadyTimeout: 60000,
      inputSelectors: [
        'div.tiptap.ProseMirror',
        'div[contenteditable="true"]',
        'textarea'
      ],
      submitSelectors: [
        'button[data-testid="send-button"]',
        'button[aria-label*="Send"]',
        'button[type="submit"]'
      ],
      newChatActions: [
        { selectors: ['button[data-slot="button"]', 'button[aria-label*="New"]'], textIncludes: ['new', 'chat', 'start', 'begin', '新しい', '新規'] },
        { selectors: ['a[href="/new"]'] }
      ]
    }
  };

  self.TARGET_CONFIG = TARGET_CONFIG;
})();








