# Multi AI Commander (Chrome extension prototype)

This repository contains a Chrome extension prototype that broadcasts prompts to multiple LLM tabs from a single side panel.

## Structure

- `extension/manifest.json` - Manifest definition
- `extension/background.js` - Background service worker controlling tab lifecycle and broadcast queue
- `extension/sidepanel/` - Side panel UI, settings, and speech input handling
- `extension/content/` - Site-specific adapters for ChatGPT / Manus / Grok

## Setup

1. Open `chrome://extensions/`, enable Developer mode
2. Click "Load unpacked" and select the `extension` folder in this project
3. Ensure you are logged in to each target LLM site, then use `Ctrl+Shift+Y` to toggle the side panel
4. Enter a prompt, choose target LLMs, and send; the extension creates or reuses tabs in the current window and submits in the background

## Notes

- Enable debug logging from the side panel settings to capture runtime events.
- Manus/Grok change their DOM frequently; adjust selectors under `extension/content/*.js` if the automation breaks.
- If background tab submission feels slow, tune the delay in `extension/background.js`.
- Speech input relies on Chrome's Web Speech API; the button will be disabled if microphone access is blocked.

## Future work

- Retry UI and inline response summaries.
- Additional adapters (Claude, Google AI Studio, etc.).
- Prompt templates, tagging, and richer configuration.

