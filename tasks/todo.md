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

## Task 5: 収集ルーチン v1（daily-routine.md）— **完了（2026-08-08）**

**Description:** クラウドエージェントルーチンに渡すプロンプトを作成する。Supabaseから
登録キーワードを読み、AIでキーワードを拡張し、Web検索とYouTube公式APIでイベント情報を探索する
（X/Instagramは Phase 4 で追加するため、v1では対象外）。「登録キーワード直接一致=確実、
AI拡張語経由=探索」という単純ルールで confidence を仮判定し、重複を除去してSupabaseに書き込む。

→ プロンプト本体に加え、それが依存する **`/api/ingest` エンドポイント**（重複除去・
バリデーション・dry-runの実処理）も本タスクで実装した（plan.md想定外の追加スコープ。
ルーチンが実際に呼び出す先が存在しないとプロンプトだけでは動作しないため）。

**Acceptance criteria:**
- [x] `prompts/daily-routine.md` に、目的・入力・手順・出力形式・制約が明記されている
- [x] キーワード拡張（声優名・制作会社・コラボ相手・シリーズ名等）のロジックが具体例つきで
      記述されている
- [x] 既存の `events` テーブルと照合し、同一イベントを再度書き込まない重複除去ロジックがある
      （`lib/ingest.ts`、テスト済み）
- [x] dry-runモード（DB書き込みをスキップしてログのみ出力）がある

**Verification:**
- [x] `npx vitest run` で `ingestEvents` の重複除去・バリデーション・dry-runをテスト済み（6件）
- [x] 実際のSupabaseに対し、curlで認証チェック→dry-run→書き込み→重複skipの一連の流れを確認
      （テストデータは確認後に削除済み）
- [ ] RemoteTriggerでの実ルーチン実行による確認は **Task 6で実施**

**Dependencies:** Task 1, Task 2, Task 4（テスト用キーワードの登録に使うため）

**Files likely touched:**
- `prompts/daily-routine.md`
- `web/lib/ingest.ts`, `web/lib/ingest.test.ts`, `web/app/api/ingest/route.ts`（追加スコープ）

**Estimated scope:** M

---

## Task 6: RemoteTriggerでルーチンをcron登録

**Description:** Task 5のプロンプトを使い、毎日07:00（JST）に実行されるルーチンを
`RemoteTrigger` で登録する。

**Acceptance criteria:**
- [ ] cron式が `0 22 * * *`（UTC、07:00 JST相当）で登録されている
- [ ] `RemoteTrigger action=run` による手動実行で正常終了する

**Verification:**
- [ ] `RemoteTrigger action=list` で登録内容を確認する
- [ ] 手動実行のログを確認し、エラーがないことを確認する

**Dependencies:** Task 5

**Files likely touched:** なし（RemoteTrigger設定のみ）

**Estimated scope:** XS

---

## Task 7: 全件閲覧画面（イベント一覧・詳細ページ）

**Description:** Supabaseの `events` テーブルを参照し、収集した全イベントの一覧画面と、
イベントごとの詳細ページを作る。LINE通知からのリンク先としても使う。

**Acceptance criteria:**
- [ ] イベント一覧が新しい順（またはイベント日順）に表示される
- [ ] 各イベントに confidence（確実/探索）が視覚的に区別できる
- [ ] イベント詳細ページ（`/events/[id]`）が個別URLでアクセスできる
- [ ] LINEに通知されなかったイベントも一覧に表示される

**Verification:**
- [ ] Task 5で収集したテストイベントが一覧・詳細の両方で正しく表示される

**Dependencies:** Task 3, Task 5（表示するデータが必要）

**Files likely touched:**
- `web/app/events/page.tsx`, `web/app/events/[id]/page.tsx`

**Estimated scope:** S

---

## Checkpoint: コアループ（Task 4-7 完了後）
- [ ] キーワードを1件登録し、ルーチンを手動実行すると、関連イベントがWeb画面に表示される
- [ ] 過去に収集済みのイベントが重複して増えない
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
`daily-routine.md` の判定ロジックを調整する。

**Acceptance criteria:**
- [ ] 数日分の運用結果をレビューし、誤分類（探索なのに確実、逆も）の傾向を洗い出している
- [ ] 判定基準を `daily-routine.md` に反映し、改善が確認できる

**Verification:**
- [ ] チューニング後の数日間で、誤分類の体感が減っている（定性確認）

**Dependencies:** Task 5, Task 6（一定期間の運用実績が必要）

**Files likely touched:**
- `prompts/daily-routine.md`

**Estimated scope:** S

---

## Checkpoint: MVP完成（Task 14-16 完了後）
- [ ] 全情報源（X/Instagram/YouTube/公式サイト/ブログ）が有効
- [ ] [event-collector-spec.md](../docs/spec/event-collector-spec.md) の Success Criteria を
      すべて満たす
- [ ] 人間によるレビュー、実運用開始
