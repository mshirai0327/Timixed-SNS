# TimixedDiary — システムアーキテクチャ設計

## コンセプト整理

TimixedDiary は「時間を剥ぎ取った日記SNS」。投稿がいつ書かれたかを隠し、ランダムな遅延を経てタイムラインに浮かび上がる。

設計上の制約:

1. `composed_at` はクライアントへ返さない
2. `surface_at` もクライアントへ返さない
3. タイムラインの順序に時系列的意味を持たせない
4. self-hosted しやすい単純な構成を優先する

## システム全体構成

```text
┌──────────────────────────────────────────────────┐
│ Client (React + Vite + TypeScript)              │
│ - タイムライン表示                               │
│ - 投稿UI                                         │
│ - ログイン / 登録                                │
└──────────────────┬───────────────────────────────┘
                   │ HTTPS / REST
┌──────────────────▼───────────────────────────────┐
│ API Server (Hono / Node.js)                      │
│ - JWT 認証                                       │
│ - タイムライン組み立て                           │
│ - 投稿受付                                       │
│ - cron / worker 連携ポイント                     │
└───────────────┬───────────────────┬──────────────┘
                │                   │
┌───────────────▼─────────────┐ ┌──▼────────────────┐
│ PostgreSQL                  │ │ Redis (optional)  │
│ - users                     │ │ - レート制限       │
│ - drifts                    │ │ - 将来のqueue/pubsub│
│ - follows                   │ └───────────────────┘
│ - resonances                │
└─────────────────────────────┘
```

## 各層の役割

| 層 | 技術 | 役割 |
|---|---|---|
| Frontend | React + TypeScript + Vite | UI・状態管理 |
| API | Hono + Node.js | ビジネスロジック・認証・時刻情報の隠蔽 |
| DB | PostgreSQL | データ永続化・浮上時刻生成 |
| Cache | Redis | レート制限、将来の queue / pubsub |

## 技術選定の根拠

### フロントエンド

- 既存プロトタイプが React ベース
- Vite と TypeScript で軽量に保守しやすい

### バックエンド

- Hono は軽量で、VPS 上でも扱いやすい
- TypeScript でフロントと型共有できる

### データベース

- `surface_at <= now()` のような時刻クエリに PostgreSQL が合う
- DB トリガーで `surface_at` をサーバー側強制できる
- BaaS なしでも十分に成立する

### Redis

- Misskey 寄りの self-hosted 構成に寄せやすい
- 現時点では必須ではない
- 将来的に rate limit / queue / realtime に使いやすい

### 認証

- MVP はアプリ内 JWT 認証
- self-hosted 前提で導入コストが低い
- magic link より運用が単純

## フェーズ分け

### Phase 1 — MVP

- ユーザー登録・ログイン
- テキスト投稿
- 公開タイムライン + ログイン後ホームタイムライン
- VPS での単一ノード運用

### Phase 2

- 再浮上ジョブ
- 共鳴
- フォロー
- 自分の過去投稿一覧

### Phase 3

- Realtime
- queue / worker の分離
- 連合対応の再検討
