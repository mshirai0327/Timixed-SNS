# TimixedDiary — ドリフトアルゴリズム設計

TimixedDiary のコアは「時間的変位」。投稿した瞬間を見せず、あとから漂着させる。

## 1. 投稿時: `surface_at` の生成

```text
投稿
  ↓
API が drifts に insert
  ↓
DB trigger が surface_at を NOW() + random(0, 7days) に設定
  ↓
クライアントには id だけ返す
```

`surface_at` はクライアントから受け取らない。

## 2. タイムライン

- `surface_at <= now()` の投稿だけを公開表示する
- ログイン中の本人には未浮上の自分の投稿も返せる
- 並び順は `order by random()`
- `X-Session-Seed` をハッシュ化し、固定順の疑似ランダム並びに変換してページング時の再現性を持たせる

## 3. 再浮上

現行スキーマでは `next_resurface_at` と `resurface_count` まで保持する。

ルール:

- 初回浮上後、`surface_at + 7days + random(0, 3days)` を次回候補にする
- 最大 2 回まで
- 実ジョブは今後 cron / worker で実装する

## 4. 自己投稿の扱い

- 自分の投稿は `is_mine` で識別する
- UI では「— わたし」バッジを付ける
- 時刻情報はそれでも見せない
