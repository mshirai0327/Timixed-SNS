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

## 技術スタック

| 層 | 技術 |
|---|---|
| Frontend | React + TypeScript + Vite |
| Backend | Hono (TypeScript) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (magic link) |
| Realtime | Supabase Realtime |
| Scheduler | pg_cron (Supabase) |

---

## 現在の進捗

完了しているもの:

- monorepo の基本構成（`apps/web`, `apps/api`, `packages/types`, `supabase/migrations`）
- 共有型パッケージ（クライアント公開用の `DriftPublic` など）
- Supabase 初期マイグレーション
- `users`, `drifts`, `follows`, `resonances` のテーブル定義
- `surface_at` / `next_resurface_at` をサーバー側で決める DB トリガー
- RLS と公開ビュー、タイムライン取得用 RPC
- Hono API の `POST /api/v1/drifts`
- Hono API の `GET /api/v1/timeline`
- React + Vite + Tailwind のフロント初期画面
- 投稿フォーム、「— わたし」表示、再浮上バッジ、API 未接続時のサンプル表示

まだ未完了のもの:

- Supabase Auth のログイン UI
- `DELETE /api/v1/drifts/:id` 以降の残り API
- 共鳴、フォロー、プロフィール更新、自分の投稿一覧
- Realtime 連携
- `pg_cron` を使った再浮上ジョブ本体
- Supabase ローカル開発用の `config.toml` や seed データ

現在の実装方針として、`composed_at` / `surface_at` は API レスポンス型にもフロント UI にも出していません。

## 動かし方

### 1. 依存を入れる

```bash
corepack pnpm install
```

`corepack` のキャッシュ周りで失敗する環境では、次でも動きます。

```bash
COREPACK_HOME=/tmp/corepack corepack pnpm install
```

### 2. Supabase を用意する

1. Supabase プロジェクトを作る
2. [supabase/migrations/20260403204500_initial_schema.sql](supabase/migrations/20260403204500_initial_schema.sql) を適用する
3. `service_role` キーと `project URL` を控える

このリポジトリにはまだ `supabase/config.toml` がないため、現時点では Supabase CLI の完全ローカル起動ではなく、既存の Supabase プロジェクトに接続する想定です。

### 3. API の環境変数を設定する

```bash
cp apps/api/.env.example apps/api/.env
```

`apps/api/.env` に以下を設定します。

```env
PORT=8787
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 4. Web の環境変数を設定する

```bash
cp apps/web/.env.example apps/web/.env
```

最低限そのままで動きます。

```env
VITE_API_BASE_URL=http://localhost:8787/api/v1
VITE_API_BEARER_TOKEN=
```

### 5. API を起動する

```bash
corepack pnpm dev:api
```

ヘルスチェック:

```bash
curl http://localhost:8787/health
```

### 6. Web を起動する

別ターミナルで:

```bash
corepack pnpm dev:web
```

Vite の開発サーバーは `http://localhost:5173` です。`/api` は自動で `http://localhost:8787` にプロキシされます。

## 現時点での使い方

### UI だけ確認したいとき

`corepack pnpm dev:web` だけでも画面は表示できます。API に接続できない場合はサンプル投稿を表示します。

### API までつないで確認したいとき

現時点の API は Supabase Auth の Bearer token が必要です。フロントにはまだログイン画面がないため、次のどちらかで一時的にトークンを渡してください。

- `apps/web/.env` の `VITE_API_BEARER_TOKEN` にアクセストークンを書く
- ブラウザのコンソールで `localStorage.setItem('drift.access_token', '<token>')` を実行する

トークンがない場合、フロントは 401 を受けてサンプル表示にフォールバックします。

## 検証コマンド

```bash
corepack pnpm typecheck
corepack pnpm build
```
