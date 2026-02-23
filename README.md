# Claude Terminal

Claude Code 専用ターミナル。Windows での改行問題を解消し、ログ自動保存とエイリアス機能を搭載。

## 機能

- **Enter = 改行、Ctrl+Enter = 送信** (Windows ターミナルの改行問題を解消)
- **ログ自動保存** → `~/claude-terminal-logs/` に日時付きテキストファイルで保存
- **Claude Code 専用ボタン** → `claude` / `--continue` / `--resume` をワンクリック
- **エイリアス** → よく使うコマンドをドロップダウンから選択
- **コマンド履歴** → ↑↓キーで履歴を遡れる
- **Ctrl+C ボタン** → プロセス中断をワンクリック

## セットアップ

```bash
# 1. 依存関係インストール
npm install

# 2. 起動
npm start
```

## 必要なもの

- **Node.js** 18 以上
- **npm**
- **Claude Code** (`npm install -g @anthropic-ai/claude-code`)

## ビルド (exe/AppImage 作成)

```bash
npm run build
```

## キーボードショートカット

| キー | 動作 |
|------|------|
| Enter | 改行 |
| Ctrl+Enter | コマンド送信 |
| ↑ / ↓ | 入力履歴を移動 |
| Ctrl+C | プロセス中断 |
| Ctrl+L | 画面クリア |
| Tab | タブ補完 |

## ログの場所

```
~/claude-terminal-logs/
  session_2025-02-23T12-00-00.txt
  session_2025-02-23T15-30-00.txt
  ...
```

ANSI エスケープコードを除去したプレーンテキストで保存されます。

## エイリアス一覧

| キー | コマンド |
|------|----------|
| cc | claude |
| cc-c | claude --continue |
| cc-r | claude --resume |
| cc-p | claude --print |
| cc-debug | claude --debug |
| cc-dangerously | claude --dangerously-skip-permissions |
| git-s | git status |
| git-log | git log --oneline -10 |
| ll | ls -la |
| cls | clear |

エイリアスはツールバーのドロップダウンで選択、または `renderer.js` の `ALIASES` 配列を直接編集して追加できます。
