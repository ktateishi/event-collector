# daily-routine（収集ルーチン v1）

RemoteTriggerのクラウドエージェントルーチンに渡す実行指示。
毎日07:00 JSTに自動実行される（Task 6でcron登録）。

## 実行時に埋め込むプレースホルダー

このファイルをそのままRemoteTriggerの `events[].data.message.content` に渡すのではなく、
登録時（Task 6）に以下を実際の値に置き換えること。値そのものはこのリポジトリに
コミットしない（[docs/research/secrets-handling.md](../docs/research/secrets-handling.md)参照）。

- `{{APP_URL}}` — VercelにデプロイしたWebアプリのURL
- `{{INTERNAL_INGEST_TOKEN}}` — `/api/ingest` 認証用の内部トークン
- `{{DRY_RUN}}` — `true` または `false`（動作確認中は `true` にする）

---

## 目的

登録キーワード（＋そこから拡張した関連語）をもとに、日付のあるイベント情報
（放送・イベント・グッズ発売・チケット先行受付・締切など）を毎日収集し、
見落としをゼロに近づける。v1ではWeb検索とYouTube公式APIのみを対象とし、
X・Instagram連携は後続フェーズで追加する。

## 入力

1. `GET {{APP_URL}}/api/keywords` — 登録済みキーワード一覧を取得する
2. Web検索（このエージェントに組み込まれた検索能力を使う）
3. `GET {{APP_URL}}/api/search/youtube?q=<キーワード>` — YouTube検索のプロキシ。
   `Authorization: Bearer {{INTERNAL_INGEST_TOKEN}}` が必要（`/api/ingest`と同じトークン）。
   YouTube APIキーが未設定の場合は `{"results": [], "skipped": "..."}` が返るので、
   その場合はYouTube検索をスキップしてWeb検索の結果のみで進めてよい
   （実際のYouTube検索・APIキー管理はVercel側で行い、ルーチン自身はYouTubeの
   APIキーを一切持たない。[secrets-handling.md](../docs/research/secrets-handling.md)参照）

## 手順

### 1. キーワードを取得する

`GET {{APP_URL}}/api/keywords` を呼び、`keywords[].keyword` の一覧を得る。
1件もなければ、何もせず終了する（イベント一覧の送信は不要）。

### 2. 各キーワードを拡張する

登録キーワードそのもの（direct）に加えて、AI自身の知識と検索を使い、
関連語（expanded）を3〜6件程度生成する。拡張の観点は以下を目安にする:

| 観点 | 例（キーワード「鬼滅の刃」の場合） |
|---|---|
| 声優・出演者名 | 花江夏樹、鬼頭明里 |
| 制作会社・スタジオ | ufotable |
| コラボ相手・ブランド | ローソン、UNIQLO UT |
| シリーズ内の関連作品名 | 鬼滅の刃 無限列車編、鬼滅の刃 柱稽古編 |
| 関連イベント名（既知なら） | 鬼滅の刃展 |

拡張語は「そのキーワードに関する新着イベントを取りこぼさないために検索する価値があるか」
で判断する。無関係な連想（例: 単に人気があるという理由だけの無関係作品）は含めない。

### 3. 検索する

各キーワード（direct）・各拡張語（expanded）について:

- Web検索で、公式サイトのNEWS欄・公式ブログ・個人ブログ等から、
  日付が明記された（または明確に推測できる）イベント情報を探す
- `GET {{APP_URL}}/api/search/youtube?q=<キーワード>` で、該当キーワードに関連する動画・
  チャンネルの新着から、日付のあるイベント情報（配信イベント、記念放送等）を探す
  （`results` が空、または `skipped` が返る場合はYouTube検索なしで進める）

**「日付のあるイベント情報」の定義**: 開催日・受付開始日時・締切日時の
いずれか1つ以上が明確に分かるもの。日付が一切分からない情報（単なる感想記事、
日付不明の噂等）は対象外とする。

### 4. confidenceとmatched_viaを判定する（v1の単純ルール）

- そのイベントが **登録キーワードそのもの**（direct）の検索から見つかった場合:
  `matched_via: "direct"`, `confidence: "confirmed"`
- そのイベントが **AI拡張語**（expanded）の検索からのみ見つかった場合:
  `matched_via: "expanded"`, `confidence: "exploratory"`

この判定基準は仮のものである。運用結果を見て `tasks/todo.md` Task 16で調整する。

### 5. 送信する

収集した候補イベントをまとめて、以下の形式で `{{APP_URL}}/api/ingest` にPOSTする。

```
POST {{APP_URL}}/api/ingest
Authorization: Bearer {{INTERNAL_INGEST_TOKEN}}
Content-Type: application/json

{
  "dry_run": {{DRY_RUN}},
  "events": [
    {
      "title": "鬼滅の刃 ライブイベント",
      "source": "kimetsu.com/news",
      "url": "https://kimetsu.com/news/12345",
      "matched_keyword": "鬼滅の刃",
      "matched_via": "direct",
      "confidence": "confirmed",
      "event_date": "2026-09-15",
      "registration_opens_at": "2026-08-20T10:00:00+09:00",
      "deadline_at": "2026-09-01T23:59:59+09:00"
    }
  ]
}
```

- `event_date` / `registration_opens_at` / `deadline_at` は分かる範囲だけ埋める
  （いずれか1つは必須。すべて不明なイベントは送信しない）
- 重複除去（同一イベントの再登録防止）は `/api/ingest` 側のロジックが行うため、
  ここで厳密な重複排除をする必要はない。ただし明らかに同一の候補を
  同じバッチ内で何度も送らないようにする

### 6. 結果を確認する

`/api/ingest` のレスポンス（`inserted` / `skipped` / `wouldInsert`）を確認し、
実行サマリーとして「新規追加件数」「スキップ件数（重複/不正）」をログに残す。

## 出力形式

このルーチン自体はチャットに向けた出力を持たない。実行結果は
`/api/ingest` への書き込み（またはdry-run時はレスポンスのログ）がすべてである。

## 制約

- v1ではX・Instagram APIを呼び出さない（Task 14, 15で追加）
- 日付が一切不明なイベントは送信しない
- `{{DRY_RUN}}` が `true` の場合、`/api/ingest` には必ず `"dry_run": true` を指定し、
  実データを書き込まない
- 1回の実行で送信する候補イベントの件数に厳密な上限は設けないが、
  明らかに関連の薄い情報を大量に送らないよう、手順3・4の基準に忠実に従うこと
