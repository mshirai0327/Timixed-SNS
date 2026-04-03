# DRIFT — Codex Agent Context

## プロジェクト概要

**DRIFT** は「日付のない日記SNS」。投稿した言葉が時間の外へ漂い、0〜7日のランダムな遅延後にタイムラインへ浮かび上がる。

コアコンセプト：「いつ書いたか」を完全に消す。投稿日時はDBに保存するが、クライアントには**絶対に渡さない**。

---

## 現在の状態

- React プロトタイプ（`drift.jsx`）は別リポジトリで作成済み（このリポジトリには未配置）
- このリポジトリには設計ドキュメントのみ存在
- バックエンド・フロントエンドの実装はこれから

## ドキュメント（必ず読むこと）

| ファイル | 内容 |
|---|---|
| [docs/architecture.md](docs/architecture.md) | システム構成・技術選定・フェーズ計画 |
| [docs/data-model.md](docs/data-model.md) | DBスキーマ・RLS・インデックス |
| [docs/drift-algorithm.md](docs/drift-algorithm.md) | コアアルゴリズム（surface_at生成・再浮上・タイムライン順序） |
| [docs/api.md](docs/api.md) | REST API定義・型・エラー仕様 |

---

## 技術スタック

| 層 | 技術 |
|---|---|
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| Backend | Hono (TypeScript) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (magic link) |
| Realtime | Supabase Realtime |
| Scheduler | pg_cron (Supabase) |

開発者スキル：TypeScript, Vite, PHP, Godot 経験あり。

---

## 絶対に守るべき設計原則

1. **`composed_at` / `surface_at` をクライアントに返さない**
   - APIレスポンスの型に含めない（TypeScriptの型レベルで除外）
   - Supabase RLSで `surface_at > NOW()` の投稿は本人以外取得不可

2. **タイムラインを時系列でソートしない**
   - `ORDER BY RANDOM()` を使う
   - ページネーションはセッションシード方式（`setseed()` + offset）

3. **`surface_at` の生成はサーバーサイドのみ**
   - クライアントから渡された値を使わない
   - `surface_at = NOW() + random(0, 7days)`

4. **再浮上は最大2回まで**
   - `resurface_count >= 2` になったら `next_resurface_at = NULL`

---

## ディレクトリ構成（予定）

```
Timixed-SNS/
├── apps/
│   ├── web/          ← React + Vite フロントエンド
│   └── api/          ← Hono バックエンド
├── packages/
│   └── types/        ← 共有型定義（DriftPublic等）
├── supabase/
│   └── migrations/   ← SQLマイグレーションファイル
├── docs/
└── AGENTS.md
```

monorepo（pnpm workspaces 推奨）。

---

## 次にやること（優先順）

1. `supabase/migrations/` にスキーマのSQLを配置（[docs/data-model.md](docs/data-model.md)をそのまま使える）
2. `apps/api/` に Hono をセットアップ
3. `POST /api/v1/drifts` と `GET /api/v1/timeline` を実装
4. `apps/web/` にフロントエンドをセットアップし、APIに接続

---

## UI・デザイン方針

- カラー：深いダーク系（背景 `#0d0d12`）
- フォント：Noto Sans JP（light）+ Zen Kaku Gothic New
- コンセプト：minimal・atmospheric・emotionally resonant（機能より体験重視）
- 自分の投稿：紫がかった背景で識別、「— わたし」バッジ
- 再浮上した投稿：サブルなバッジ（「また流れてきた」的な表現）
- 投稿ボタン名：「流す」

---

## 将来の展望（現時点では実装しない）

- 再浮上（resurface）機能 ← Phase 2
- ActivityPub / 連合対応（Mastodon/Misskey的）← Phase 3
