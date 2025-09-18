# Multi AI Commander (Chrome拡張 下書き)

このディレクトリには、複数のLLMタブへ同時にプロンプトを送信するためのChrome拡張機能プロトタイプが含まれています。

## 構成

- `extension/manifest.json` ? 拡張機能のマニフェスト
- `extension/background.js` ? バックグラウンド(Service Worker)でタブ生成とブロードキャストを制御
- `extension/sidepanel/` ? サイドパネルUIと音声入力・設定周り
- `extension/content/` ? ChatGPT / Manus / Grok 向け操作アダプタ

## セットアップ手順

1. Chromeで `chrome://extensions/` を開き、右上の「デベロッパーモード」をオン
2. 「パッケージ化されていない拡張機能を読み込む」から、このプロジェクトの `extension` フォルダを選択
3. 対象LLMサイトにログインしておき、ホットキー `Ctrl+Shift+Y` でサイドパネルを表示
4. プロンプトを入力して送信先LLMを選択すると、対応タブがバックグラウンドで作成/再利用されて送信されます

## 既知の注意点

- Manus/GrokのDOM構造は頻繁に変わるため、`extension/content/*.js` のセレクタを環境に合わせて調整する必要があります
- 非アクティブタブでの入力反映が遅い場合は、`extension/background.js` のディレイ設定を調整してください
- 音声入力はChromeのWeb Speech APIに依存します。マイク権限がブロックされている場合はボタンが無効化されます

## 今後の拡張候補

- 送信失敗時のリトライUI、レスポンス本文のサマリー表示
- Claude, Google AI Studio向けアダプタの追加
- プロンプトテンプレートやタグ管理などの拡張設定
