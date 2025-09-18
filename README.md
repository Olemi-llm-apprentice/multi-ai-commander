# Multi AI Commander

## Overview (English)
Multi AI Commander is a Chrome extension that lets you broadcast a single prompt to multiple LLM services (ChatGPT, Manus, Grok) from one side panel. It automates tab creation, waits for each target to become ready, injects the adapter, and reports per-target status back to the panel.

### Key Features
- Parallel prompt submission to multiple LLM targets with automatic tab management
- Side panel UI for target selection, live status updates, and an optional debug log stream
- Speech-to-text input powered by Chrome Web Speech (can be toggled on/off)
- Adapter-based DOM automation that can be tuned via extension/config/targets.js

### Installation
1. Open chrome://extensions/ and enable **Developer mode**.
2. Click **Load unpacked** and select the extension folder from this repository.
3. Sign in to each LLM target in Chrome before broadcasting prompts.

### Usage
1. Open the side panel from the toolbar icon or with Alt + Shift + M (you can remap the shortcut under chrome://extensions/shortcuts).
2. Type or dictate your prompt, then choose the target LLMs to broadcast to.
3. Press **Send**. The background service worker queues each target, waits for the DOM to settle, injects the adaptor, and shows real-time status updates.
4. (Optional) Enable debug logging in the settings dialog to inspect detailed automation events.
5. (Optional) Turn on voice input in settings; the first use will request microphone permission.

### Development Notes
- Target selectors and timing can be customised in extension/config/targets.js.
- The shared injector script lives at extension/content/injector.js and handles DOM automation per target.
- Icons are located under extension/icons/ and referenced from manifest.json.

---

## 概要 (日本語)
Multi AI Commander は、1 つのサイドパネルから複数の LLM（ChatGPT / Manus / Grok）へ同時にプロンプトを送信できる Chrome 拡張機能です。バックグラウンドでタブの生成や DOM の準備待ち、アダプタの注入、結果通知まで自動化します。

### 主な機能
- 複数の LLM へ並列にプロンプトを送信し、タブの生成・再利用を自動化
- ターゲット選択、進行状況表示、デバッグログ表示を備えたサイドパネル UI
- Chrome Web Speech を利用した音声入力（設定で有効／無効を切り替え可能）
- extension/config/targets.js から調整できるアダプタベースの DOM 自動化

### インストール手順
1. chrome://extensions/ を開き、**デベロッパーモード**をオンにします。
2. **パッケージ化されていない拡張機能を読み込む**をクリックし、本リポジトリの extension フォルダを選択します。
3. ブロードキャスト対象の LLM それぞれに Chrome 上でログインしておきます。

### 使い方
1. ツールバーアイコンまたは Alt + Shift + M でサイドパネルを開きます（ショートカットは chrome://extensions/shortcuts で変更可能）。
2. プロンプトを入力（または音声入力）し、送信したいターゲットを選択します。
3. **Send** を押すと、バックグラウンドが順番に自動送信し、ステータスがリアルタイムに更新されます。
4. 必要に応じて設定ダイアログからデバッグログを有効化し、詳細なイベントを確認できます。
5. 音声入力を有効化すると初回にマイク権限を要求します。拒否された場合は Chrome の設定から許可してください。

### 開発メモ
- ターゲットごとのセレクタやタイミングは extension/config/targets.js で調整可能です。
- DOM 自動化のロジックは共通インジェクタ extension/content/injector.js にまとまっています。
- アイコンは extension/icons/ フォルダにあり、manifest.json から参照されています。