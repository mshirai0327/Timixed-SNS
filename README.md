# TimixedDiary

日付のない日記SNS。投稿した言葉が時間の外へ漂い、ランダムなタイミングでタイムラインに浮かび上がる。

---

## ドキュメント

| ファイル | 内容 |
|---|---|
| [docs/architecture.md](docs/architecture.md) | self-hosted 前提のシステム構成 |
| [docs/data-model.md](docs/data-model.md) | PostgreSQL スキーマと運用方針 |
| [docs/drift-algorithm.md](docs/drift-algorithm.md) | `surface_at` と再浮上のルール |
| [docs/api.md](docs/api.md) | 現行 API と auth フロー |

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
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| Backend | Hono + Node.js |
| Database | PostgreSQL |
| Cache / Queue 補助 | Redis（任意、現状はレート制限補助） |
| Auth | アプリ内 JWT 認証 |
| Scheduler | cron / worker 想定 |

Misskey のように self-hosted しやすい、`Node.js + PostgreSQL (+ Redis)` 寄りの構成を目指しています。BaaS 前提ではありません。

## 現在の進捗

完了しているもの:

- monorepo の基本構成（`apps/web`, `apps/api`, `packages/types`, `db/migrations`）
- 共有型パッケージ
- PostgreSQL 初期マイグレーション
- `users`, `drifts`, `follows`, `resonances` のテーブル定義
- `surface_at` / `next_resurface_at` を DB トリガーで生成する仕組み
- Hono API の `POST /api/v1/auth/register`
- Hono API の `POST /api/v1/auth/login`
- Hono API の `GET /api/v1/auth/me`
- Hono API の `POST /api/v1/drifts`
- Hono API の `GET /api/v1/timeline`
- API 起動時の自動マイグレーション適用
- React フロントのタイムライン、投稿フォーム、ログイン / 登録 UI

まだ未完了のもの:

- `DELETE /api/v1/drifts/:id` 以降の残り API
- 共鳴、フォロー、プロフィール更新、自分の投稿一覧
- Realtime
- 再浮上ジョブ本体
- Podman / Docker Compose の同梱

`composed_at` / `surface_at` は API レスポンス型にもフロント UI にも出していません。

## 動かし方

### 1. 依存を入れる

```bash
corepack pnpm install
```

環境によっては次でも動きます。

```bash
COREPACK_HOME=/tmp/corepack corepack pnpm install
```

### 2. PostgreSQL と Redis を用意する

最低限必要なのは PostgreSQL です。Redis は未設定でも動きますが、設定するとレート制限に使われます。

例:

- PostgreSQL: `postgres://timixed_diary:timixed_diary@127.0.0.1:5432/timixed_diary`
- Redis: `redis://127.0.0.1:6379`

### 3. API の環境変数を設定する

```bash
cp apps/api/.env.example apps/api/.env
```

```env
PORT=8787
DATABASE_URL=postgres://timixed_diary:timixed_diary@127.0.0.1:5432/timixed_diary
REDIS_URL=redis://127.0.0.1:6379
APP_SECRET=replace-this-with-a-long-random-secret
ACCESS_TOKEN_TTL_DAYS=30
```

`APP_SECRET` は 32 文字以上のランダム文字列にしてください。

### 4. Web の環境変数を設定する

```bash
cp apps/web/.env.example apps/web/.env
```

```env
VITE_API_BASE_URL=http://localhost:8787/api/v1
```

### 5. API を起動する

```bash
corepack pnpm dev:api
```

起動時に `db/migrations` が自動適用されます。

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

### 公開タイムラインを見る

未ログインでもタイムラインは見られます。API に接続できない場合はサンプル投稿を表示します。

### 投稿する

画面右側の `register` / `login` からアカウントを作成し、ログインしてください。ログイン後に「流す」が有効になります。

## 検証コマンド

```bash
corepack pnpm typecheck
corepack pnpm build
```
