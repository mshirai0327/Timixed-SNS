# TimixedDiary — API設計

## 基本方針

- RESTful JSON API
- ベースURL: `/api/v1`
- レスポンスに `composed_at` / `surface_at` は含めない
- 認証は self-hosted な Bearer token（JWT）

## 型定義

```ts
type PublicUser = {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
};

type DriftPublic = {
  id: string;
  author: PublicUser;
  body: string;
  resurface_count: number;
  resonance_count: number;
  is_resonated: boolean;
  is_mine: boolean;
};
```

## エンドポイント

### Auth

#### `POST /api/v1/auth/register`

```json
{
  "email": "hello@example.com",
  "handle": "mizuho",
  "display_name": "みずほ",
  "password": "password123"
}
```

レスポンス:

```json
{
  "token": "jwt",
  "user": {
    "id": "uuid",
    "handle": "mizuho",
    "display_name": "みずほ",
    "avatar_url": null
  }
}
```

#### `POST /api/v1/auth/login`

```json
{
  "login": "mizuho",
  "password": "password123"
}
```

#### `GET /api/v1/auth/me`

認証済みユーザーを返す。

### Timeline

#### `GET /api/v1/timeline`

- 未ログインでも閲覧可
- ログイン時は自分の未浮上投稿も見える
- `X-Session-Seed` によるランダム順の再現に対応

レスポンス:

```json
{
  "drifts": [DriftPublic],
  "has_more": true
}
```

### Drifts

#### `POST /api/v1/drifts`

認証必須。`surface_at` はサーバー側で決定する。

```json
{
  "body": "言葉の内容"
}
```

レスポンス:

```json
{
  "id": "uuid",
  "is_mine": true
}
```

## エラーレスポンス

```ts
type ErrorResponse = {
  error: {
    code: string;
    message: string;
  };
};
```

主な `code`:

- `VALIDATION_ERROR`
- `UNAUTHORIZED`
- `INVALID_CREDENTIALS`
- `EMAIL_ALREADY_USED`
- `HANDLE_ALREADY_USED`
- `RATE_LIMIT_EXCEEDED`
- `DRIFT_NOT_FOUND`
- `INTERNAL_ERROR`
