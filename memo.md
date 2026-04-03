## プロジェクト概要: TimixedDiary

日付のない日記SNS。投稿した言葉が時間の外へ漂い、ランダムなタイミングでタイムラインに浮かび上がるアプリ。

## 現在の方針

- BaaS 前提ではなく self-hosted
- Node.js + PostgreSQL + Redis(任意) 寄り
- Sakura VPS のような単一サーバーでも MVP を載せやすくする
- `composed_at` / `surface_at` はクライアントに返さない
