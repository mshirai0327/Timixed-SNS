# DRIFT — システムアーキテクチャ設計

## コンセプト整理

DRIFT は「時間を剥ぎ取った日記SNS」。投稿がいつ書かれたかを隠し、ランダムな遅延を経てタイムラインに浮かび上がる。

**設計上の制約（コンセプトから来るもの）：**

1. `composed_at`（投稿日時）はクライアントに一切渡さない
2. `surface_at`（浮上日時）もクライアントには渡さない
3. タイムラインの並び順に時系列的な意味を持たせない
4. 「誰のいつの投稿か」を読み取れる情報を露出しない

---

## システム全体構成

```
┌─────────────────────────────────────────────────────┐
│  Client (React + Vite + TypeScript)                  │
│  - タイムライン表示                                   │
│  - 投稿UI（「流す」ボタン）                           │
│  - プロフィール                                       │
└──────────────────┬──────────────────────────────────┘
                   │ HTTPS / REST + WebSocket (Realtime)
┌──────────────────▼──────────────────────────────────┐
│  API Server (Hono / Node.js or Cloudflare Workers)   │
│  - 認証（JWT検証）                                    │
│  - タイムライン組み立て（時刻情報を除去してから返す）  │
│  - 投稿受付・surface_at 生成                         │
│  - 浮上スケジューラ（cron or queue）                  │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│  Supabase                                            │
│  - PostgreSQL（drifts, users, follows, resonances）  │
│  - Auth（magic link / email）                        │
│  - Realtime（新規浮上イベントをPush）                 │
│  - Edge Functions（resurface cron job）              │
└─────────────────────────────────────────────────────┘
```

### 各層の役割

| 層 | 技術 | 役割 |
|---|---|---|
| Frontend | React + TypeScript + Vite | UI・状態管理・WebSocket受信 |
| API | Hono (TypeScript) | ビジネスロジック・時刻情報の隠蔽 |
| DB | Supabase (PostgreSQL) | データ永続化・RLS |
| Auth | Supabase Auth | magic link認証 |
| Realtime | Supabase Realtime | 浮上イベントのPush通知 |
| Scheduler | Supabase Edge Functions + pg_cron | 再浮上（resurface）の定期処理 |

---

## 技術選定の根拠

### フロントエンド：React + Vite + TypeScript

- 現プロトタイプ（drift.jsx）がReactベースのため継続
- Vite、TypeScriptは開発者の既存スキルと一致
- スタイリング：Tailwind CSS（ダーク系デザインとの相性良好）

### バックエンド：Hono

- TypeScriptファーストでフロントとの型共有が容易
- Cloudflare Workers・Node.js・Bun など複数ランタイムに対応
- 軽量で edge-ready（将来のスケールアップに対応）

### データベース：Supabase（PostgreSQL）

- PostgreSQLの表現力が必要（`surface_at <= NOW()` のような時刻クエリ）
- Auth・Realtime・Edge Functions が統合されていてインフラ管理コスト低
- RLS（Row Level Security）で「他人の composed_at は見えない」を強制できる
- `pg_cron` で resurface の定期処理を DB 側で完結させられる

### 認証：Supabase Auth（magic link）

- パスワードレスでコンセプトのミニマリズムと整合
- メールアドレスのみでアカウント作成可能

---

## フェーズ分け

### Phase 1 — MVP（クローズドベータ）

- ユーザー登録・ログイン
- テキスト投稿（drift）
- タイムライン（surface_at順、時刻表示なし）
- フォロー機能
- リアルタイム浮上通知

### Phase 2 — 機能拡張

- resurface（再浮上）機能
- リアクション（共鳴 / resonance）
- 自分の過去投稿一覧（自分だけが composed_at を見られる）
- 通知

### Phase 3 — オープン化・連合

- ActivityPub 対応（Mastodon/Misskey との連合）
- ただし「日時を隠す」コンセプトと ActivityPub の仕様の折り合いを設計要検討

---

## セキュリティ方針

| 脅威 | 対策 |
|---|---|
| `composed_at` の推測（投稿順序からの逆算） | タイムラインをランダムシャッフルして返す |
| APIレスポンスへの時刻情報混入 | APIレイヤーで `composed_at` / `surface_at` を除去してからシリアライズ |
| 他ユーザーの下書きへのアクセス | RLS: `surface_at > NOW()` の投稿は本人以外取得不可 |
| 大量投稿によるスパム | レート制限（投稿は1時間に10件まで等） |
