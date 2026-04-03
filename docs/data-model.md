# TimixedDiary — データモデル設計

## テーブル一覧

```text
users
drifts
follows
resonances
```

## スキーマ方針

- auth 用の `email`, `password_hash` は `users` に内包する
- `composed_at` / `surface_at` は DB に保存するが API では公開しない
- `surface_at` は DB トリガーで生成する

## users

```sql
create table users (
  id uuid primary key default gen_random_uuid(),
  email citext unique not null,
  password_hash text not null,
  handle citext unique not null,
  display_name text not null,
  bio text,
  avatar_url text,
  created_at timestamptz not null default now()
);
```

## drifts

```sql
create table drifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  composed_at timestamptz not null default now(),
  surface_at timestamptz not null,
  resurface_count integer not null default 0,
  next_resurface_at timestamptz,
  deleted_at timestamptz
);
```

## follows

```sql
create table follows (
  follower_id uuid not null references users(id) on delete cascade,
  following_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id)
);
```

## resonances

```sql
create table resonances (
  drift_id uuid not null references drifts(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (drift_id, user_id)
);
```

## インデックス

```sql
create index idx_drifts_surface_at on drifts(surface_at) where deleted_at is null;
create index idx_drifts_next_resurface on drifts(next_resurface_at) where next_resurface_at is not null and deleted_at is null;
create index idx_drifts_user_id on drifts(user_id, composed_at desc) where deleted_at is null;
create index idx_follows_follower on follows(follower_id);
create index idx_follows_following on follows(following_id);
```

## アクセス制御方針

BaaS 依存の RLS ではなく、現行実装では API 層で以下を強制する。

- 未浮上の投稿は本人以外に返さない
- `composed_at` / `surface_at` はレスポンスから除外する
- 投稿作成は Bearer token の本人に限定する

## マイグレーション方針

- `db/migrations/*.sql` で管理する
- API 起動時に未適用分を自動適用する
- 将来的に専用 migrate コマンドへ切り出せる構成にしている
