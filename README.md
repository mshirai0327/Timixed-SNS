# DRIFT

日付のない日記SNS。投稿した言葉が時間の外へ漂い、ランダムなタイミングでタイムラインに浮かび上がる。

---

## ドキュメント

| ファイル | 内容 |
|---|---|
| [docs/architecture.md](docs/architecture.md) | システム全体構成・技術選定・フェーズ計画 |
| [docs/data-model.md](docs/data-model.md) | DBスキーマ・RLS・インデックス |
| [docs/drift-algorithm.md](docs/drift-algorithm.md) | コアアルゴリズム（surface_at生成・再浮上・タイムライン順序） |
| [docs/api.md](docs/api.md) | REST API定義・型・エラー仕様 |

---

## コンセプト

- 投稿日時を完全に非表示にする
- 投稿後 **0〜7日のランダムな遅延** でタイムラインに出現する
- 自分の投稿が他人の言葉のように流れてくる体験
- 「発酵した言葉」の価値を引き出す

---

## 技術スタック（予定）

| 層 | 技術 |
|---|---|
| Frontend | React + TypeScript + Vite |
| Backend | Hono (TypeScript) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (magic link) |
| Realtime | Supabase Realtime |
| Scheduler | pg_cron (Supabase) |

---

## 現在のステータス

- [x] React プロトタイプ（`drift.jsx`）
- [ ] バックエンド実装
- [ ] マルチユーザー対応
- [ ] 再浮上機能
