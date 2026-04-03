# TimixedDiary — Codex Agent Context

## プロジェクト概要

**TimixedDiary** は「日付のない日記SNS」。投稿した言葉が時間の外へ漂い、0〜7日のランダムな遅延後にタイムラインへ浮かび上がる。

コアコンセプト: 「いつ書いたか」を完全に消す。投稿日時は DB に保存するが、クライアントには **絶対に渡さない**。

## ドキュメント

| ファイル | 内容 |
|---|---|
| [docs/architecture.md](docs/architecture.md) | self-hosted 構成・技術選定 |
| [docs/data-model.md](docs/data-model.md) | PostgreSQL スキーマ |
| [docs/drift-algorithm.md](docs/drift-algorithm.md) | `surface_at` / 再浮上ルール |
| [docs/api.md](docs/api.md) | 現行 API |

## 技術スタック

| 層 | 技術 |
|---|---|
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| Backend | Hono + Node.js |
| Database | PostgreSQL |
| Cache | Redis（任意） |
| Auth | アプリ内 JWT 認証 |
| Scheduler | cron / worker 想定 |

## 絶対に守るべき設計原則

1. `composed_at` / `surface_at` をクライアントに返さない
2. タイムラインを時系列でソートしない
3. `surface_at` の生成はサーバーサイドのみ
4. 再浮上は最大 2 回まで

## ディレクトリ構成

```text
Timixed-SNS/
├── apps/
│   ├── web/
│   └── api/
├── packages/
│   └── types/
├── db/
│   └── migrations/
├── docs/
└── AGENTS.md
```

## UI 方針

- 背景 `#0d0d12`
- minimal / atmospheric / emotionally resonant
- 自分の投稿は「— わたし」で識別
- 再浮上した投稿は控えめなバッジ
- 投稿ボタン名は「流す」
