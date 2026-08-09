# Task List: event_collector

詳細な背景・依存関係の全体像は [plan.md](plan.md) を参照。

---

## Task 1: 秘密情報の受け渡し方式を確定する — **完了（2026-08-08）**

**Description:** クラウドエージェントルーチン（RemoteTrigger）の実行環境に、LINEトークン・
X/Instagram/YouTube各APIキー・SupabaseのAPIキーをどう安全に渡すか調査し、方式を決定する。
`schedule`スキルのドキュメントには環境変数管理の記載がなく未解決。

→ 調査の結果、RemoteTriggerには秘密情報専用の仕組みがないことが判明。
**ルーチンは内部トークン1本のみ保持し、実際の高価値APIキー（Supabase/LINE/X/Instagram/YouTube）
はすべてVercelの環境変数として保持、ルーチンはVercel経由でアクセスする方式**を採用する。
詳細は [docs/research/secrets-handling.md](../docs/research/secrets-handling.md) 参照。

**Acceptance criteria:**
- [x] クラウドエージェントの実行環境に秘密情報を渡す具体的な方法が判明している
      （環境変数、MCP connector、Webhook経由での間接渡し、等）
- [x] 判明した方式を `docs/research/secrets-handling.md` に記録している
- [x] 少なくとも1つの秘密情報（Supabase接続情報）を使い、実際にテスト書き込み/読み取りが成功している
      （Task 3のNext.jsアプリからSupabaseへの疎通で確認済み。RemoteTrigger経由の内部トークンは
      Task 5着手時に改めて検証する）

**Verification:**
- [x] Next.jsアプリからSupabaseへ接続し、`events`テーブルの件数取得に成功（2026-08-08確認）
- [x] 秘密情報（Supabase URL/キー）はリポジトリにコミットされていない（`.gitignore`で`.env.local`除外）

**Dependencies:** None（設計）／実地検証はTask 2に依存（当初計画から修正）— **完了**

**Files likely touched:**
- `docs/research/secrets-handling.md`

**Estimated scope:** S

---

## Task 2: Supabase プロジェクト作成 + DBスキーマ定義 — **完了（2026-08-08）**

**Description:** Supabaseプロジェクトを作成し、keywords / events / notifications /
reminder_settings の4テーブルを定義する。

→ マイグレーションSQLを [supabase/migrations/0001_init.sql](../supabase/migrations/0001_init.sql)
に作成済み。RLSは全テーブルで有効化しポリシーなし（default deny）、
Next.jsサーバー側のみservice_roleキーでアクセスする方針とした。
**ユーザー本人によるSupabaseアカウント・プロジェクト作成が完了次第、このSQLを
SQL Editorで実行して残りのAcceptance criteriaを満たす。**

**Acceptance criteria:**
- [x] `keywords` テーブル（id, keyword, created_at）— SQL定義済み
- [x] `events` テーブル（id, title, source, matched_keyword, matched_via[direct|expanded],
      confidence[confirmed|exploratory], event_date, registration_opens_at, deadline_at,
      url, created_at）— SQL定義済み
- [x] `notifications` テーブル（id, event_id, sent_at, type[daily|reminder]）— SQL定義済み
- [x] `reminder_settings` テーブル（id, days_before, created_at）— SQL定義済み
- [x] SupabaseのRLS方針を決めている（全テーブルRLS有効・ポリシーなし。
      アプリはサーバー側でservice_roleキーのみ使用）
- [x] ユーザー本人がSupabaseプロジェクトを作成し、上記SQLを適用済み（2026-08-08）

**Verification:**
- [x] Next.jsアプリ（Task 3）からのクエリ成功により、テーブルが正しく作成されていることを確認

**Dependencies:** None（Task 1と並行可）

**Files likely touched:**
- `supabase/migrations/0001_init.sql`（作成済み）
- `docs/spec/event-collector-spec.md`（Code Style節のJSON例を更新済み）

**Estimated scope:** S

---

## Task 3: Next.js アプリ骨格を Vercel にデプロイし、Supabaseに接続する — **完了（2026-08-08）**

**Description:** Next.jsアプリの初期セットアップを行い、Vercelにデプロイする。
Supabaseクライアントを組み込み、DBから1件読み取って表示するだけの最小ページを作る。

**Acceptance criteria:**
- [x] `web/` にNext.jsアプリが存在し、`npm run build` が通る
- [x] Vercelにデプロイされ、公開URLでアクセスできる
      （https://web-three-eta-ruwyukkmq1.vercel.app）
- [x] トップページがSupabaseの `events` テーブルから件数を取得して表示する
- [x] Supabase接続情報は `web/.env.local`（ローカル）とVercelの環境変数（本番）に設定され、
      リポジトリにはコミットされていない

**Verification:**
- [x] `npm run build` 成功、`npm run dev` でローカル起動し「収集済みイベント: 0 件」を表示（2026-08-08）
- [x] 本番URLにアクセスし、同様に「収集済みイベント: 0 件」の表示を確認（2026-08-08）

**Dependencies:** Task 2

**Files likely touched:**
- `web/package.json`, `web/app/page.tsx`, `web/lib/supabase.ts`

**Estimated scope:** S

---

## Checkpoint: 基盤（Task 1-3 完了後）
- [ ] クラウドエージェントルーチンからSupabaseへのテスト書き込みが成功する
- [ ] Vercelにデプロイした最小ページがSupabaseのデータを表示できる
- [ ] 人間によるレビュー

---

## Task 4: キーワード管理画面 — **完了（2026-08-08）**

**Description:** `keywords` テーブルに対する追加・削除・一覧表示のUIを作る。

**Acceptance criteria:**
- [x] キーワードの一覧が表示される（`/keywords`）
- [x] 新規キーワードを追加できる
- [x] 既存キーワードを削除できる
- [x] 空文字・重複キーワードの追加を防ぐ（`lib/keywords.ts`でバリデーション、
      Vitestでテスト済み）

**Verification:**
- [x] 実際のSupabaseに対し、追加→重複拒否→空文字拒否→削除のAPI呼び出しをcurlで確認（2026-08-08）
- [x] `npx vitest run` 全8件パス

**Dependencies:** Task 3

**Files likely touched:**
- `web/app/keywords/page.tsx`, `web/app/api/keywords/route.ts`

**Estimated scope:** S

---

## Task 5: 収集ロジック v2（Vertex AI Gemini呼び出し）— **完了（2026-08-09）**

**Description:** ~~クラウドエージェントルーチンのプロンプト~~ を廃止し、
**GCP Vertex AI（Gemini + Google検索グラウンディング）への単発API呼び出し**で
キーワード拡張・Web検索・構造化抽出を行うロジックを実装する。

→ 経緯: RemoteTrigger（egress制限）→ ローカル`claude -p`+launchd（Macスリープ依存）と
2度不採用になり、「自律型AIエージェント」という設計自体をやめてVercelの通常の
サーバーレス関数から単発API呼び出しを行う方式に確定した（2026-08-08）。
`prompts/daily-routine.md` と `scripts/run-daily-routine.sh` は廃止する。

**Acceptance criteria:**
- [x] `web/lib/gemini.ts` に、キーワードを受け取りVertex AIへリクエストして
      候補イベント配列（`CandidateEvent[]`、`lib/ingest.ts`の型と一致）を返す関数がある
- [x] プロンプト（`web/lib/gemini-prompt.ts`）に、キーワード拡張の観点
      （声優名・制作会社・コラボ相手等）と「日付のあるイベント情報」の定義が
      具体例つきで含まれている
- [x] Google検索グラウンディングと構造化出力（JSON schema指定）を同一リクエストで使用する
- [x] 認証情報（GCPサービスアカウントキー）はVercelの環境変数として保持する設計
      （`.env.example`に追記済み）。リポジトリにはコミットしない

**Verification:**
- [x] モックを使ったユニットテストで、認証・リクエスト内容・レスポンス解析・
      エラーハンドリングを確認（`gemini.test.ts`, `gemini-prompt.test.ts`、計11件）
- [x] 実際のGCPプロジェクトに対し、「呪術廻戦」「ワンピース」で呼び出し、
      妥当な候補（各7〜8件）が返り、Supabaseに書き込まれることを確認（テストデータは削除済み）

**判明した制約（重要）**: このプロジェクトのVertex AIでは **Gemini 3系モデルが未提供**
（`gemini-3-flash`等は404）で、代わりに `gemini-2.5-flash` を使用している。
また `gemini-2.5-flash` では **Search Tool（Google検索グラウンディング）と
構造化出力（responseSchema/responseMimeType）を同一リクエストで併用できない**
（400 "controlled generation is not supported with Search tool"）。

**精度改善（2026-08-09、ユーザー報告により再修正）**: 初回実装（1回のAPI呼び出しで
検索+抽出）は、モデルが文章として書いたURLの多くがリンク切れ・誤ページになる
精度問題があった。**3段階パイプライン**（①`gemini-search.ts`で検索しgroundingChunksの
中継URLを実URLに解決 → ②`fetch-page.ts`で実ページ本文を取得 → ③`gemini-extract.ts`で
実ページ本文から構造化抽出、URLは文字列でなくpage_id番号で返させて取り違えを防止）
に再設計し、検証したURLがすべて実在（HTTP 200）することを確認した
（修正前は17件中5件が404だったのに対し、修正後は4件中0件）。詳細は
[secrets-handling.md](../docs/research/secrets-handling.md) の「精度改善」参照。

**Dependencies:** Task 1, Task 2

**Files likely touched:**
- `web/lib/gemini-client.ts`, `web/lib/gemini-search.ts`, `web/lib/gemini-extract.ts`,
  `web/lib/gemini.ts`（オーケストレーター）, `web/lib/fetch-page.ts`（新規）＋各テスト
- `web/app/api/cron/collect/route.ts`（新規、Vercel Cronから起動）
- `web/vercel.json`（新規、cron設定）
- `prompts/daily-routine.md`, `scripts/run-daily-routine.sh`（削除）

**Estimated scope:** M

---

## Task 6: Vercel Cronへの登録 — **完了（2026-08-09）**

**Description:** Task 5のロジックを、Vercelの `vercel.json` の `crons` 設定で
毎日07:00 JST（`0 22 * * *`、UTC）に自動実行されるようにする。

**Acceptance criteria:**
- [x] `vercel.json` に cron設定があり、`/api/cron/collect` を毎日07:00 JSTに叩く
- [x] cronエンドポイントは `CRON_SECRET` でVercel Cron以外からの呼び出しを拒否する
      （ローカル・Vercel双方に設定済み）
- [x] 本番環境で手動トリガーにより正常終了する

**Verification:**
- [x] 本番URLの `/api/cron/collect` に正しい認証で叩き、Supabaseにイベントが反映されることを確認
      （「ワンピース」で7件収集・書き込み、削除して確認済み）
- [x] 認証なしでは401になることを確認済み（実装済みのコード上のガード）

**Dependencies:** Task 5

**Files likely touched:**
- `web/vercel.json`
- `web/app/api/cron/collect/route.ts`

**Estimated scope:** S

---

## Task 7: 全件閲覧画面（イベント一覧・詳細ページ）

**Description:** Supabaseの `events` テーブルを参照し、収集した全イベントの一覧画面と、
イベントごとの詳細ページを作る。LINE通知からのリンク先としても使う。

**Acceptance criteria:**
- [x] イベント一覧が新しい順（`created_at` 降順）に表示される
- [x] 各イベントに confidence（確実/探索）が視覚的に区別できる
- [x] イベント詳細ページ（`/events/[id]`）が個別URLでアクセスできる（存在しないIDは404）
- [x] LINEに通知されなかったイベントも一覧に表示される（LINE連携は未実装のため、
      現状すべてのイベントがこれに該当する）

**Verification:**
- [x] 実際に「呪術廻戦」を収集（8件）し、一覧・詳細ページの両方で正しく表示されることを
      curlで確認（テストデータは削除済み）
- [x] `npx vitest run` 全29件パス、本番デプロイ済み

**Dependencies:** Task 3, Task 5（表示するデータが必要）

**Files likely touched:**
- `web/app/events/page.tsx`, `web/app/events/[id]/page.tsx`
- `web/lib/events.ts`, `web/lib/events.test.ts`（`listEvents`/`getEventById`を追加）

**Estimated scope:** S

---

## Checkpoint: コアループ（Task 4-7 完了後）
- [x] キーワードを1件登録し、ルーチンを手動実行すると、関連イベントがWeb画面に表示される
- [x] 過去に収集済みのイベントが重複して増えない（`lib/ingest.ts`の重複除去で確認済み）
- [ ] 人間によるレビュー

---

## Task 8: LINE連携（アカウント作成 + Push送信ロジック）

**Description:** LINE公式アカウント・Messaging APIチャネルをユーザー本人が作成する。
その後、当日の新着イベントから5件（確実3件＋探索2件）を選定し、重複通知を避けつつ
LINE Push APIで送信するロジックを実装する。メッセージにはWeb詳細ページへのリンクを含める。

**Acceptance criteria:**
- [ ] （ユーザー作業）LINE Messaging APIチャネルが作成され、チャネルアクセストークンが
      Vercelの環境変数として設定されている
- [ ] 当日 `created_at` の新規イベントのうち、confirmed優先で3件・exploratory2件を選ぶロジックがある
      （5件に満たない日は、ある分だけ送る）
- [ ] `notifications` テーブルを見て、既に送信済みのイベントを再送しない
- [ ] メッセージ本文に各イベントのタイトルとWeb詳細ページへのリンクが含まれる

**Verification:**
- [ ] テストイベントを使い、実際にLINEへメッセージが届くことを確認する
- [ ] 同じイベントに対して2回実行しても、2通目が送られないことを確認する

**Dependencies:** Task 7（リンク先のイベント詳細ページが必要）

**Files likely touched:**
- `web/app/api/notify/route.ts`, `web/lib/line.ts`

**Estimated scope:** M

---

## Task 9: Push送信の自動起動

**Description:** 収集ルーチン完了後に、Task 8のPush送信ロジックが自動的に起動する仕組みを作る。
Vercel Cron（毎日07:00過ぎの固定時刻）と、収集ルーチン完了時のWebhook呼び出しのどちらかを選ぶ
（着手時に判断、[plan.md](plan.md) Open Questions参照）。

**Acceptance criteria:**
- [ ] 収集ルーチンの完了後、人手を介さずにLINE Pushが送信される
- [ ] 収集が0件だった日は、Push送信がスキップされる（空メッセージを送らない）

**Verification:**
- [ ] cron実行後、追加操作なしにLINEへ通知が届くことを確認する

**Dependencies:** Task 6, Task 8

**Files likely touched:**
- `web/vercel.json`（Cron設定）または `prompts/daily-routine.md`（Webhook呼び出し追加）

**Estimated scope:** S

---

## Task 10: LINE通知タップ→Web詳細ページ遷移の確認

**Description:** Task 8で組み込んだリンクが、実際にLINEアプリからタップして
正しくWeb詳細ページに遷移することを確認する。

**Acceptance criteria:**
- [ ] スマホのLINEで通知を受け取り、タップすると該当イベントの詳細ページが開く

**Verification:**
- [ ] 実機での動作確認（手動）

**Dependencies:** Task 9

**Files likely touched:** なし（確認のみ）

**Estimated scope:** XS

---

## Checkpoint: 通知ループ（Task 8-10 完了後）
- [ ] 収集→DB反映→5件選定→LINE Push→タップでWeb遷移が一気通貫で動く
- [ ] 人間によるレビュー（実機のLINEで確認）

---

## Task 11: 設定画面（リマインドのタイミング）

**Description:** `reminder_settings` テーブルを操作するUIを作る。「何日前に再通知するか」を
数値で設定・保存できるようにする。

**Acceptance criteria:**
- [ ] 現在の設定値（日数）が表示される
- [ ] 値を変更して保存できる
- [ ] 保存後、即座に新しい設定値が反映される（再デプロイ不要）

**Verification:**
- [ ] 設定値を変更し、Supabaseダッシュボード上の値が更新されていることを確認する

**Dependencies:** Task 3

**Files likely touched:**
- `web/app/settings/page.tsx`, `web/app/api/settings/route.ts`

**Estimated scope:** S

---

## Task 12: リマインドチェックロジック

**Description:** `events` テーブルの `registration_opens_at` / `deadline_at` と、
`reminder_settings` の設定値を突き合わせ、対象イベントを再度LINE通知するロジックを実装する。
同一リマインドを重複送信しない。

**Acceptance criteria:**
- [ ] 設定された日数前に該当するイベントを検出できる
- [ ] `notifications` テーブルに type=reminder のレコードが記録され、同一イベント・
      同一リマインドタイミングでの重複送信を防ぐ
- [ ] Task 8のPush送信ロジックを再利用する

**Verification:**
- [ ] `registration_opens_at` が「設定日数後」のテストイベントを作成し、
      リマインドチェックを実行するとLINEに通知が届く

**Dependencies:** Task 8, Task 11

**Files likely touched:**
- `web/app/api/reminders/route.ts`

**Estimated scope:** M

---

## Task 13: リマインドチェックの自動実行

**Description:** Task 12のリマインドチェックロジックを、Vercel Cronで毎日自動実行する。

**Acceptance criteria:**
- [ ] 毎日決まった時刻にリマインドチェックが自動実行される
- [ ] 対象イベントがない日は何も送信されない

**Verification:**
- [ ] Vercelのcron実行ログでリマインドチェックが正常終了していることを確認する

**Dependencies:** Task 12

**Files likely touched:**
- `web/vercel.json`

**Estimated scope:** XS

---

## Checkpoint: リマインド（Task 11-13 完了後）
- [ ] 設定を変更すると、その日数前に対象イベントの再通知が届く
- [ ] 人間によるレビュー

---

## Task 14: X API連携

**Description:** ユーザーが従量課金アカウントを用意した後、収集ルーチン（`daily-routine.md`）に
X API（公式・従量課金）での検索ステップを追加する。

**Acceptance criteria:**
- [ ] X APIでの検索結果が、既存の重複除去・confidence判定ロジックに正しく統合される
- [ ] 想定コスト試算（月2〜3万円、[feasibility調査](../docs/research/data-source-feasibility.md)参照）
      を大きく超えないよう、検索対象キーワード数に上限を設ける

**Verification:**
- [ ] X由来のイベントが `events` テーブルに `source` 列で識別可能な形で追加される

**Dependencies:** Task 5（ユーザーによるX APIアカウント設定が前提、Task本体とは並行着手可）

**Files likely touched:**
- `prompts/daily-routine.md`

**Estimated scope:** S

---

## Task 15: Instagram Graph API連携

**Description:** ユーザーがBusiness/Creatorアカウントへ切り替えた後、収集ルーチンに
Instagram Graph APIでの検索ステップを追加する。ただし公式APIは他者アカウントの
横断検索に構造的な制約があるため（[feasibility調査](../docs/research/data-source-feasibility.md)参照）、
着手時に対応範囲を再確認する。

**Acceptance criteria:**
- [ ] Instagram Graph APIで取得可能な範囲が明確になっている
- [ ] 取得できない範囲がある場合、Web検索経由の代替収集に切り替える判断がされている

**Verification:**
- [ ] 想定した範囲のInstagram由来イベントが収集できることを確認する

**Dependencies:** Task 5

**Files likely touched:**
- `prompts/daily-routine.md`

**Estimated scope:** S

---

## Task 16: ノイズ判定基準のチューニング

**Description:** MVP運用開始後、実際に収集されたイベントの確実/探索の分類結果を見ながら、
判定ロジックを調整する。

**Acceptance criteria:**
- [ ] 数日分の運用結果をレビューし、誤分類（探索なのに確実、逆も）の傾向を洗い出している
- [ ] 判定基準を `web/lib/gemini-prompt.ts`（`buildExtractionPrompt`）に反映し、改善が確認できる

**Verification:**
- [ ] チューニング後の数日間で、誤分類の体感が減っている（定性確認）

**Dependencies:** Task 5, Task 6（一定期間の運用実績が必要）

**Files likely touched:**
- `web/lib/gemini-prompt.ts`

**Estimated scope:** S

---

## Checkpoint: MVP完成（Task 14-16 完了後）
- [ ] 全情報源（X/Instagram/YouTube/公式サイト/ブログ）が有効
- [ ] [event-collector-spec.md](../docs/spec/event-collector-spec.md) の Success Criteria を
      すべて満たす
- [ ] 人間によるレビュー、実運用開始

---

## Phase 5: 使い勝手・品質改善（バックログ、2026-08-09追加）

ユーザーが実際に使ってみたフィードバックから追加。優先順位・着手順は未確定
（次回の会話で確認する）。

### Task 17: イベント一覧のカテゴリ分け表示

**Description:** `/events` が全件フラットな一覧で、どのキーワード（バイオハザード／
エヴァンゲリオン等）についての情報か一見して分かりにくいとの指摘。
登録キーワードごとにグループ化して表示する。

**課題**: `events.matched_keyword` は「実際に一致した語」（directならキーワード自体、
expandedなら関連語。例: "MAPPA"）であり、**どの登録キーワードのために収集したか**とは
別概念。カテゴリ分けには「収集対象の登録キーワード」を別途保持する必要がある
（例: `events` テーブルに `keyword_id` または `source_keyword` 列を追加し、
`collectEventsForKeyword` 呼び出し元でセットする）。

**Acceptance criteria:**
- [ ] `events` テーブルに収集対象キーワードを識別する列を追加する
- [ ] `/api/cron/collect` が新規イベント作成時にその列をセットする
- [ ] `/events` が登録キーワードごとにグループ化して表示される

**Dependencies:** Task 7, Task 5

**Estimated scope:** M

---

### Task 18: 類似・重複イベントのグルーピング

**Description:** 同一イベントの開催地違い（例: ALL OF EVANGELION 名古屋会場/大阪会場）や
公開地域違い（全米公開/日本公開）が、別々の行として大量に並び見通しが悪いとの指摘。
これらはtitleが異なるため現在の重複除去（Task 5で修正済み、title完全一致）では
1件にまとまらない。

**方針候補（要ユーザー確認）**:
- (a) UI側で「同じ日付・同じ登録キーワードのイベント群」をアコーディオンでまとめて表示する
- (b) タイトルの類似度（会場名・地域名を除いた部分の一致）でグルーピングする
- (c) 抽出フェーズのプロンプトに「同一イベントの複数会場・複数地域はまとめて1件にする」
  指示を追加する（Gemini側での統合）

**Acceptance criteria:** 方針確定後に記述する

**Dependencies:** Task 7, Task 5

**Estimated scope:** M〜L（方針による）

---

### Task 19: Web画面のデザイン改善

**Description:** 現状はテキストとリンクのみでデザイン性がなく、公開できる品質ではない
との指摘。`/keywords`・`/events`・`/events/[id]` に最低限のビジュアルデザイン
（レイアウト・配色・タイポグラフィ・カード表示等）を適用する。

**Acceptance criteria:** スコープ確定後に記述する（フルデザインシステムを入れるか、
最低限見られる状態にするかで規模が大きく変わるため要相談）

**Dependencies:** Task 7, Task 4, Task 11（設定画面）

**Estimated scope:** M〜L（スコープによる）
