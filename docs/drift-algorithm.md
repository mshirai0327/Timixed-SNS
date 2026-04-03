# DRIFT — ドリフトアルゴリズム設計

DRIFTのコアは「時間的変位」のメカニズム。投稿日時を隠すための仕組みを詳細に定義する。

---

## 1. 投稿時：surface_at の生成

```
ユーザーが「流す」を押す
       │
       ▼
APIが受け取る
       │
       ▼
surface_at = NOW() + Uniform(0, 7days)
       │
       ▼
DB に保存（composed_at, surface_at は秘匿フィールド）
       │
       ▼
クライアントには id のみ返す
```

### surface_at の分布

- 最短：即時（0秒後）
- 最長：7日後
- 分布：一様乱数（Uniform）
- 期待値：3.5日後

```typescript
function generateSurfaceAt(composedAt: Date): Date {
  const maxDelayMs = 7 * 24 * 60 * 60 * 1000; // 7 days
  const delayMs = Math.random() * maxDelayMs;
  return new Date(composedAt.getTime() + delayMs);
}
```

**設計上の選択肢と判断：**

| 分布 | メリット | デメリット |
|---|---|---|
| 一様乱数（採用） | シンプル。7日以内に必ず浮上 | 集中しやすい時間帯が偏ることも |
| 指数分布 | 早めに浮上しやすい | 「漂う」感が薄れる |
| 正規分布（μ=3.5日） | 自然な集中 | 7日を超える可能性がある |

---

## 2. タイムラインの組み立て

タイムラインは「浮上済みの投稿をランダム順で返す」。時系列ソートは絶対に行わない。

### クエリ

```sql
-- フォロー中のユーザーの浮上済み投稿をランダム順で取得
SELECT
  d.id,
  d.user_id,
  d.body,
  d.resurface_count
FROM drifts d
JOIN follows f ON f.following_id = d.user_id
WHERE
  f.follower_id = :viewer_id
  AND d.surface_at <= NOW()
  AND d.deleted_at IS NULL
ORDER BY RANDOM()   -- ← 時系列を持ち込まないための核心
LIMIT 20
OFFSET :cursor;
```

### ページネーション問題

`ORDER BY RANDOM()` はページをまたぐとアイテムの重複・欠落が起きる。

**解決策：セッションシード方式**

```typescript
// セッション開始時に固定シードを生成
const sessionSeed = crypto.randomUUID();

// クエリにシードを渡してpg内で固定化
await db.execute(`SELECT setseed($1)`, [hashSeedToFloat(sessionSeed)]);
const posts = await db.execute(`
  SELECT ... ORDER BY RANDOM() LIMIT 20 OFFSET $1
`, [offset]);
```

これにより「同じセッション内では再現性のある順序」になり、ページネーションが機能する。セッションをリロードすると順序が変わる（意図通り）。

---

## 3. 再浮上（Resurface）

投稿が最初に浮上してから約1週間後、再びタイムラインに浮かび上がる。

### ルール

```
初回浮上（surface_at）後、
next_resurface_at = surface_at + 7days + Uniform(0, 3days)
に再浮上する。

最大再浮上回数は2回（resurface_count <= 2）。
3回目以降は next_resurface_at = NULL（再浮上終了）。
```

```typescript
function calculateNextResurface(
  surfaceAt: Date,
  resurface_count: number
): Date | null {
  const MAX_RESURFACING = 2;
  if (resurface_count >= MAX_RESURFACING) return null;

  const baseDelay = 7 * 24 * 60 * 60 * 1000;  // 7 days
  const jitter = Math.random() * 3 * 24 * 60 * 60 * 1000; // ±3 days
  return new Date(surfaceAt.getTime() + baseDelay + jitter);
}
```

### 再浮上スケジューラ（pg_cron）

```sql
-- 毎時実行：再浮上時刻を過ぎた投稿の resurface_count を更新
SELECT cron.schedule(
  'resurface-drifts',
  '0 * * * *',  -- 毎時0分
  $$
    UPDATE drifts
    SET
      resurface_count = resurface_count + 1,
      next_resurface_at = CASE
        WHEN resurface_count + 1 >= 2 THEN NULL
        ELSE NOW()
          + INTERVAL '7 days'
          + (RANDOM() * INTERVAL '3 days')
      END
    WHERE
      next_resurface_at <= NOW()
      AND deleted_at IS NULL
  $$
);
```

### タイムライン上での再浮上の扱い

再浮上した投稿はタイムラインの通常フローに混ざる。ただし：

- `resurface_count > 0` の場合、クライアントに渡す
- UIは「この言葉、また流れてきた」的なサブルな表現（例：薄いバッジ）で表現
- **再浮上した投稿も時刻情報は非表示のまま**

---

## 4. 自己投稿の特別扱い

自分の投稿がタイムラインに流れてきたとき、「— わたし」バッジで識別する（現プロトタイプと同様）。

**重要：** 自分の投稿一覧ページでは `composed_at` 順に表示する（自分だけが自分の過去を知れる）。他人には一切渡さない。

```typescript
// 自分の投稿一覧API（authored timeline）
// composed_at を返す唯一のエンドポイント
// ただし表示UIでは "XX日前" のような相対表記にとどめる
GET /api/me/drifts
```

---

## 5. フロー全体図

```
投稿
 │
 ├─ composed_at = NOW()
 ├─ surface_at  = composed_at + rand(0, 7d)
 ├─ next_resurface_at = surface_at + 7d + rand(0, 3d)
 └─ resurface_count = 0

                  ▼ [surface_at経過]

タイムライン初回浮上
 ├─ resurface_count = 0 → バッジなし
 └─ next_resurface_at が設定されている

                  ▼ [next_resurface_at経過]

再浮上 (1回目)
 ├─ resurface_count = 1 → 「また流れてきた」バッジ
 └─ next_resurface_at が更新される

                  ▼ [next_resurface_at経過]

再浮上 (2回目)
 ├─ resurface_count = 2 → 「また流れてきた」バッジ
 └─ next_resurface_at = NULL（これ以降は再浮上しない）
```
