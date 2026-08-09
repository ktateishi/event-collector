# Spec: event_collector

作成日: 2026-08-07
前提: [event-collector.md](../intent/event-collector.md)（確定意図）、
[data-source-feasibility.md](../research/data-source-feasibility.md)（実現可能性調査）

## アーキテクチャ変更（2026-08-07 追記）

当初案（Gitリポジトリ上のJSONで状態管理、Webは二次的な詳細画面）から変更。
[event-collector.md](../intent/event-collector.md)の追記の通り、
**LINEに届かない収集済み情報も含めた全件を閲覧できるWeb画面**が新たに必要になった。

これに伴い:
- 状態保存は Gitコミットされる JSONファイル → **永続データベース**（本番運用のWebサーバーが読み書き）に変更
- 実行基盤に **常時稼働のWebサーバー**が追加される（従来のクラウドエージェントルーチンは
  「収集バッチ」の役割のみを担い、Webサーバー・DBとは別プロセスになる）
- LINE通知は、日次ルーチンが直接LINE APIを叩くのではなく、**Webサーバーが仲介**する形に変更。
  ルーチンが新規イベントをDBに書き込む → Webサーバーがそれを検知し、当日分の5件を選定して
  LINE Push送信 → 通知にはWeb画面へのリンクを含める
- ホスティング先は **Vercel（Webサーバー）+ Supabase（Postgres DB）に決定**（2026-08-07）。
  比較検討は [ホスティング比較](#hosting-comparison-archive) 参照。個人利用規模なら
  両方とも無料枠に収まる想定。収集ルーチンはSupabaseの自動生成REST APIに
  APIキー付きHTTPリクエストで直接書き込む（カスタムAPIルート不要）

## ASSUMPTIONS（要確認）

1. ~~登録方法~~ **解決済み（2026-08-08）**: キーワード登録・リマインド設定はすべて
   **Web画面から行う**。LINEチャット経由の登録は不要と確定した
2. 通知チャネルは LINE Messaging API（Push Message）。日本での普及率とマルチユーザー
   拡張時の相性を理由に確定済み
3. ~~収集はAnthropicクラウドエージェントルーチン~~ **2度の方針転換を経て確定（2026-08-08）**:
   収集（キーワード拡張・Web検索・構造化抽出）は **Vercel Cron + GCP Vertex AI
   （Gemini + Google検索グラウンディング）への単発API呼び出し**で行う。
   経緯: ①クラウドエージェントルーチン(RemoteTrigger)はegress制限で実行環境からVercelへ
   到達できず不可 → ②ローカル実行(`claude -p`+launchd)は動いたがMacのスリープ中は
   動作しないため不採用 → ③自律エージェントをやめ、Vercelの通常のサーバーレス関数から
   単発のAI API呼び出しを行う方式に確定。詳細は
   [secrets-handling.md](../research/secrets-handling.md) 参照
4. 状態永続化は **Supabase（Postgres）** を使用する（2026-08-07 決定。
   当初のGitコミット方式から変更）
5. API利用料は許容する方針が確定済み（[event-collector.md](../intent/event-collector.md)
   Constraint参照）。ただしVertex AI採用によりコストは大幅に下がる見込み
   （月5,000回まで無料のGoogle検索グラウンディング＋少量のトークン課金で月5ドル未満試算）

→ 誤りがあれば訂正してください。

## Objective

登録キーワード（＋AIが自動拡張した関連語）をもとに、X / Instagram / YouTube /
公式サイトNEWS欄 / 個人ブログを毎日横断探索し、日付のあるイベント情報の
見落としをゼロにする。結果は毎朝スマホ（LINE）に5件（確実3件＋探索2件）だけ届け、
受付開始・締切前には再通知する。

**成功の定義:**
- 人から聞いて初めて知るイベントがゼロになる
- 毎朝3分以内に5件を確認し切れる
- 通知が多すぎて無視する習慣がつかない

## Tech Stack

| 要素 | 選択 | 理由 |
|---|---|---|
| 収集トリガー | **Vercel Cron**（`vercel.json`、毎日07:00 JST） | 常時稼働のVercel上で完結し、Macのスリープ等に依存しない |
| 収集ロジック | **GCP Vertex AI（Gemini + Google検索グラウンディング）への単発API呼び出し** | キーワード拡張・Web検索・構造化抽出を1回の呼び出しで実施。自律エージェント（Bash等のツール使用）ではないため、実行環境のegress制限や秘密情報埋め込み問題を回避できる |
| Webサーバー | **Next.js on Vercel**（Hobbyプラン） | 全件閲覧画面 + LINE Push送信の起点。個人・非商用利用ならHobbyプランが無期限無料 |
| データベース | **Supabase（Postgres）**（Freeプラン） | 500MB無料枠。**APIキー付きHTTPで直接書き込めるREST APIが自動生成**される。
無料プロジェクトは1週間操作がないと一時停止するが、毎日の収集書き込みがあるため実質問題にならない見込み |
| 通知 | LINE Messaging API（Push Message、Webサーバー経由） | 個人利用として無料枠内、将来の複数ユーザー対応とも相性が良い。通知にはWeb画面へのリンクを含める |
| データ取得 | Vertex AI経由のGoogle検索グラウンディング（Web・関連語探索）、
YouTube Data API v3（公式・無料枠）。X・Instagramは未着手 | [feasibility調査](../research/data-source-feasibility.md)に基づく |

**明示的に採用しないもの:** 独自スクレイパー、非公式APIラッパー、ネイティブアプリ、
**自律型AIエージェント実行**（クラウド・ローカルとも実行環境上の制約により不採用。
2026-08-08、詳細は[secrets-handling.md](../research/secrets-handling.md)）

## Commands

このプロジェクトは伝統的なビルド／テストコマンドを持たない
（アプリケーションコードではなく、ルーチン用プロンプト＋データファイルが主体のため）。

```
ルーチンの手動実行: RemoteTrigger action=run trigger_id=<id>
ルーチン一覧確認:   RemoteTrigger action=list
JSONスキーマ検証:   npx ajv validate -s schema/history.schema.json -d data/history.json
```

## Project Structure

```
docs/
  intent/                    確定した意図（event-collector.md）
  research/                  実現可能性調査
  spec/                      本仕様書
prompts/
  daily-routine.md            収集ルーチンに渡す実行指示（AI拡張・検索・優先度判断の本体）
web/                          Next.js アプリ（Vercelにデプロイ）
  - 全件閲覧画面（トップ／イベント詳細）
  - キーワード管理画面（追加・削除）
  - 設定画面（リマインドのタイミング等）
  （具体的なページ構成・Supabaseクライアント設定等はPlan phaseで詳細化）
```

登録キーワード・収集済みイベント・通知履歴・締切リマインドは、
すべて **Supabase（Postgres）** に保持する。収集ルーチンはSupabaseの
自動生成REST APIに直接書き込み、Vercel上のWebアプリが同じDBを参照して
全件閲覧画面とLINE通知トリガーを提供する。

## Code Style

このプロジェクトの「コード」の大半は自然言語プロンプトとJSONデータである。

**DBスキーマ（[supabase/migrations/0001_init.sql](../../supabase/migrations/0001_init.sql)、
snake_case、ISO 8601日時）:**
```json
{
  "id": "3fa4b1e2-...(uuid)",
  "title": "鬼滅の刃 ライブイベント",
  "source": "x.com/kimetsu_off",
  "url": "https://x.com/kimetsu_off/status/...",
  "matched_keyword": "鬼滅の刃",
  "matched_via": "expanded",
  "confidence": "confirmed",
  "event_date": "2026-09-15",
  "registration_opens_at": "2026-08-20T10:00:00+09:00",
  "deadline_at": "2026-09-01T23:59:59+09:00",
  "created_at": "2026-08-07T07:00:00+09:00"
}
```

通知履歴（`notifications`）は `events` と分離したテーブルで管理する
（重複送信防止のため、送信済みイベントID×種別の組で一意）。

**プロンプト（`prompts/daily-routine.md`）の構成規約:** 見出しで
「目的」「入力（読むべきファイル）」「手順」「出力形式」「制約」を明確に分ける。
曖昧な指示語（「適切に」「うまく」）を避け、判定基準を数値・具体例で書く。

## Testing Strategy

- **ドライラン**: `prompts/daily-routine.md` に dry-run モードを用意し、
  LINE送信をスキップして収集結果（選定した5件・理由）だけをDBに書き込み確認できるようにする
- **手動実行検証**: `RemoteTrigger action=run` で都度実行し、
  (1) DB上のイベント差分、(2) Web画面での表示、(3) LINE通知の内容、
  (4) 5件の内訳（確実3+探索2）を確認
- **Webサーバー側**: APIルート・DBスキーマに対する通常のユニット/統合テストを用意する
  （フレームワーク・詳細はPlan phaseで決定）
- 収集ルーチン側は自動テストスイートを持たない（実行主体がAIエージェントであり、
  従来型ユニットテストの対象となるロジックがほぼ存在しないため）

## Boundaries

- **Always**: 1日5件のLINE通知上限を守る／DB上の履歴に基づき重複通知しない／
  APIキー・LINEトークン・DB接続情報はリポジトリにコミットしない
- **Ask first**: cronのスケジュール時刻(07:00)変更／情報源の追加／5件の内訳比率（3+2）の変更
  （※ リマインドのタイミングは仕様上ユーザーがWeb設定画面から自由に変更してよい項目であり、
  ここでの確認対象ではない）
- **Never**: テスト目的の実行で実際にLINEへ本番通知を送る（dry-runを使う）／
  秘密情報を平文でリポジトリに含める／確認なしに新しい有料APIを組み込む

**ユーザー本人が行う必要がある手続き（Claudeは代行できない）:**
- LINE公式アカウント・Messaging APIチャネルの作成
- X API の従量課金アカウント設定・支払い情報登録
- Meta Developerアプリ作成・Instagram Business/Creatorアカウントへの切り替え
- Vercel・Supabaseアカウントの作成、プロジェクト作成
- 各種APIキー・トークンの、クラウドエージェント実行環境への安全な受け渡し方法の確立
  （**Open Question参照、未解決**）

## Success Criteria

- [ ] 毎日07:00（JST）に収集ルーチンが実行され、LINEに5件（確実3+探索2）が届く
- [ ] LINEに届かなかった収集済みイベントも、Web画面で全件閲覧できる
- [ ] LINE通知をタップすると、Web画面の該当ページが開く
- [ ] Web画面からキーワードの追加・削除ができる
- [ ] Web画面の設定画面から、リマインドを送るタイミング（何日前か）を変更できる
- [ ] 過去に通知済みのイベントが再度通知されない
- [ ] 設定したタイミングで、受付開始・締切が近いイベントの再通知が届く
- [ ] キーワードを1件追加した翌日以降、そのキーワードに関連するイベントが拾われる
- [ ] AI拡張によって、登録していない関連語（声優名・コラボ相手等）経由のイベントも拾われる

## Open Questions

1. **秘密情報の受け渡し方法（未解決・要調査）**: LINEトークン・X/Instagram/YouTubeの
   APIキー・SupabaseのAPIキーを、クラウドエージェントルーチンの実行環境にどう安全に渡すか。
   `schedule` スキルのドキュメントには環境変数やシークレット管理の記載がなく、
   Plan phaseで追加調査が必要
2. **探索2件のノイズ判定基準（意図的に保留）**: 「関連の可能性あり」をAIがどう判定するか。
   **MVPを動かしてから実際の出力を見て判断する方針**（2026-08-08確定）。
   Plan/Implement phaseでは、まず単純な閾値（例: 登録キーワードに直接一致=確実、
   AI拡張語経由=探索）で仮実装し、運用しながら調整する

## 決定済み事項（2026-08-08）

- **配信時刻**: 毎日朝07:00（JST）固定。平日/休日での変更は行わない
- **リマインドのタイミング**: ハードコードせず、**Web画面の設定画面から本人が変更できる**
  ようにする（例: 「何日前に再通知するか」を数値で設定）。これはWebアプリのスコープに
  「設定画面」が必要になることを意味する（Success Criteria・Project Structureに反映）
- **キーワード登録経路**: LINEチャット経由の登録機能は**不要**。Web画面からの登録のみ

## 解決済みの意思決定（アーカイブ）<a name="hosting-comparison-archive"></a>

**ホスティング先: Vercel + Supabase に決定（2026-08-07）**

| 候補 | 月額目安（個人規模） | セットアップの手間 | 備考 |
|---|---|---|---|
| **Vercel + Supabase（採用）** | ほぼ$0 | 低。SupabaseはAPIキー付きHTTPで直接書き込めるREST APIを自動生成 | Supabase無料プロジェクトは1週間操作がないと一時停止 |
| Railway | 実質$5/月〜 | 低 | Web+DBが同一基盤で完結 |
| Fly.io | $13〜20/月 | 中 | 2024年に無料枠廃止済み |
| AWS（既存アカウントあり） | アカウント作成時期に依存 | 高（IAM/VPC/SG） | 既存アカウントの利点より構築コストの高さが上回ると判断し不採用 |

理由: これまでの意思決定（AIエージェントタスク採用、LINE Bot採用）と同じく
「低構築コスト・低運用コスト」を優先。AWSは既存アカウントがあるものの、
VPC外のクラウドエージェントルーチンから書き込むための追加設定が必要になり、
個人開発の規模には見合わないと判断した。
