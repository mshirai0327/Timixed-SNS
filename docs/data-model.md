# DRIFT — データモデル設計

## テーブル一覧

```
users
drifts        ← 投稿（"drift" = 漂う投稿）
follows
resonances    ← リアクション（"like" ではなく "resonance" = 共鳴）
```

---

## スキーマ定義

### users

```sql
CREATE TABLE users (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  handle          TEXT        UNIQUE NOT NULL,        -- @username
  display_name    TEXT        NOT NULL,
  bio             TEXT,
  avatar_url      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### drifts（投稿の核）

```sql
CREATE TABLE drifts (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body                TEXT        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),

  -- === 時刻フィールド（クライアントには絶対に渡さない） ===
  composed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- ユーザーが書いた瞬間
  surface_at          TIMESTAMPTZ NOT NULL,                -- タイムラインに浮上する時刻
  --   surface_at = composed_at + random(0, 7 days)

  -- === 再浮上 ===
  resurface_count     INT         NOT NULL DEFAULT 0,
  next_resurface_at   TIMESTAMPTZ,                        -- 次の再浮上予定時刻（NULLは再浮上なし）

  -- === 削除 ===
  deleted_at          TIMESTAMPTZ                         -- ソフトデリート
);
```

**surface_at の生成式（アプリケーション層）：**

```typescript
const surfaceAt = new Date(
  Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000
);
```

**フィールド設計の意図：**

| フィールド | 公開 | 理由 |
|---|---|---|
| `id` | ○ | 投稿の識別に必要 |
| `user_id` | ○（フォロー相手のみ） | 誰の投稿かは分かる |
| `body` | ○ | 本文 |
| `composed_at` | **×** | 「いつ書いたか」を消すのがコアコンセプト |
| `surface_at` | **×** | 「いつ浮上したか」も渡すと時刻が推測される |
| `resurface_count` | ○ | 何度浮上したかは表示してよい |
| `deleted_at` | **×** | 内部管理用 |

### follows

```sql
CREATE TABLE follows (
  follower_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id)
);
```

### resonances（共鳴・リアクション）

```sql
CREATE TABLE resonances (
  drift_id    UUID        NOT NULL REFERENCES drifts(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (drift_id, user_id)
);
```

---

## インデックス

```sql
-- タイムラインクエリ最適化
-- 「浮上済み・削除なし」のフィルタが頻出
CREATE INDEX idx_drifts_surface_at
  ON drifts (surface_at)
  WHERE deleted_at IS NULL;

-- 再浮上スケジューラ用
CREATE INDEX idx_drifts_next_resurface
  ON drifts (next_resurface_at)
  WHERE next_resurface_at IS NOT NULL AND deleted_at IS NULL;

-- ユーザー別投稿一覧（自分のみ）
CREATE INDEX idx_drifts_user_id
  ON drifts (user_id, composed_at DESC)
  WHERE deleted_at IS NULL;

-- フォロー関係の引き当て
CREATE INDEX idx_follows_follower ON follows (follower_id);
CREATE INDEX idx_follows_following ON follows (following_id);
```

---

## Row Level Security (RLS)

```sql
-- drifts テーブルの公開ルール
--
-- 浮上済み（surface_at <= NOW()）かつ未削除のものだけ全員が読める
-- ただし自分の投稿は surface_at に関わらず常に読める
ALTER TABLE drifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "浮上済み投稿は全員が読める" ON drifts
  FOR SELECT USING (
    deleted_at IS NULL
    AND (
      surface_at <= NOW()              -- 浮上済み
      OR user_id = auth.uid()          -- 自分の投稿（未浮上でも見える）
    )
  );

CREATE POLICY "自分の投稿だけ書ける" ON drifts
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "自分の投稿だけ削除できる" ON drifts
  FOR UPDATE USING (user_id = auth.uid());
```

---

## ERダイアグラム（簡略）

```
users ──< follows >── users
  │
  └──< drifts >──< resonances >── users
```

---

## マイグレーション方針

- Supabase の `supabase/migrations/` ディレクトリで管理
- すべての変更を `.sql` ファイルとしてバージョン管理
- `composed_at` / `surface_at` は **マスクビュー**を作って API に公開用ビューを分離することを推奨

```sql
-- APIが使う公開用ビュー（時刻フィールドを含まない）
CREATE VIEW public_drifts AS
  SELECT
    id,
    user_id,
    body,
    resurface_count
  FROM drifts
  WHERE deleted_at IS NULL
    AND surface_at <= NOW();
```
