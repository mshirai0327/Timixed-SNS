# DRIFT — API設計

## 基本方針

- RESTful JSON API
- 認証：Bearer token（Supabase Auth JWT）
- ベースURL：`/api/v1`
- **レスポンスに `composed_at` / `surface_at` は絶対に含めない**

---

## 型定義（TypeScript）

```typescript
// クライアントに返す Drift 型（時刻なし）
type DriftPublic = {
  id: string;
  author: {
    id: string;
    handle: string;
    display_name: string;
    avatar_url: string | null;
  };
  body: string;
  resurface_count: number;    // 0=初回, 1以上=再浮上
  resonance_count: number;
  is_resonated: boolean;      // 自分がリアクション済みか
  is_mine: boolean;           // 自分の投稿か
};

// 自分の投稿一覧のみ composed_at を含む（相対表記用）
type DriftOwned = DriftPublic & {
  composed_at: string;        // ISO 8601 だが表示は "3日前" などに限定
  is_surfaced: boolean;       // 浮上済みかどうか
};
```

---

## エンドポイント一覧

### タイムライン

#### `GET /api/v1/timeline`

フォロー中ユーザーの浮上済み投稿をランダム順で返す。

**Headers:**
```
Authorization: Bearer <token>
X-Session-Seed: <uuid>   ← ページネーション再現性のため（任意）
```

**Query params:**

| param | type | default | description |
|---|---|---|---|
| `limit` | int | 20 | 取得件数（max 50） |
| `offset` | int | 0 | ページネーション |

**Response 200:**
```json
{
  "drifts": [DriftPublic],
  "has_more": true
}
```

**設計補足：** `ORDER BY RANDOM()` のため `cursor` ではなく `offset` を使用。セッションシードを保持することで同一セッション内のページングを一貫させる。

---

### 投稿

#### `POST /api/v1/drifts`

新規投稿。サーバー側で `surface_at` を生成する。

**Body:**
```json
{
  "body": "言葉の内容（1〜500文字）"
}
```

**Response 201:**
```json
{
  "id": "uuid",
  "is_mine": true
}
```

`surface_at` の値はレスポンスに含めない。クライアントは「言葉が漂い始めます」と表示するだけでよい。

---

#### `DELETE /api/v1/drifts/:id`

自分の投稿を削除（ソフトデリート）。

**Response 204:** No Content

---

### 共鳴（Resonance）

#### `POST /api/v1/drifts/:id/resonance`

リアクションを付ける。

**Response 200:**
```json
{
  "resonance_count": 5
}
```

#### `DELETE /api/v1/drifts/:id/resonance`

リアクションを外す。

**Response 200:**
```json
{
  "resonance_count": 4
}
```

---

### 自分の投稿

#### `GET /api/v1/me/drifts`

自分が書いた全投稿。`composed_at` を含む唯一のエンドポイント。

**Query params:**

| param | type | default |
|---|---|---|
| `limit` | int | 20 |
| `cursor` | string | （最後のcomposed_at） |

**Response 200:**
```json
{
  "drifts": [DriftOwned],
  "next_cursor": "2024-01-15T12:34:56Z"
}
```

---

### ユーザー

#### `GET /api/v1/users/:handle`

ユーザープロフィールと浮上済み投稿一覧（自分以外は時刻なし）。

**Response 200:**
```json
{
  "user": {
    "id": "uuid",
    "handle": "mizuho",
    "display_name": "みずほ",
    "bio": "...",
    "avatar_url": null,
    "drift_count": 42,
    "follower_count": 10,
    "following_count": 8,
    "is_following": false
  },
  "drifts": [DriftPublic]
}
```

#### `PATCH /api/v1/me`

プロフィール更新。

**Body:**
```json
{
  "display_name": "新しい名前",
  "bio": "新しいBio"
}
```

---

### フォロー

#### `POST /api/v1/users/:handle/follow`

フォローする。

**Response 200:** `{ "is_following": true }`

#### `DELETE /api/v1/users/:handle/follow`

フォロー解除。

**Response 200:** `{ "is_following": false }`

---

## Realtime（WebSocket）

Supabase Realtime を使って新規浮上をクライアントにPushする。

**Channel:** `timeline:{user_id}`

**Event: `drift_surfaced`**
```json
{
  "drift": DriftPublic
}
```

これにより、ページをリロードしなくても言葉が「漂い着く」体験を実現できる。

---

## エラーレスポンス

```typescript
type ErrorResponse = {
  error: {
    code: string;   // e.g. "DRIFT_NOT_FOUND", "RATE_LIMIT_EXCEEDED"
    message: string;
  };
};
```

| HTTPステータス | code | 状況 |
|---|---|---|
| 400 | `VALIDATION_ERROR` | バリデーション失敗 |
| 401 | `UNAUTHORIZED` | 認証切れ・未ログイン |
| 403 | `FORBIDDEN` | 他人の投稿を操作しようとした |
| 404 | `DRIFT_NOT_FOUND` | 投稿が存在しない（または未浮上） |
| 429 | `RATE_LIMIT_EXCEEDED` | 投稿レート超過 |
| 500 | `INTERNAL_ERROR` | サーバーエラー |

---

## レート制限

| エンドポイント | 制限 |
|---|---|
| `POST /drifts` | 10回/時間 per user |
| `POST /resonance` | 100回/時間 per user |
| `GET /timeline` | 60回/分 per user |
