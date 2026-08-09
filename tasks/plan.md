# Implementation Plan: event_collector

参照: [event-collector.md](../docs/intent/event-collector.md)（確定意図）、
[event-collector-spec.md](../docs/spec/event-collector-spec.md)（仕様）、
[data-source-feasibility.md](../docs/research/data-source-feasibility.md)（実現可能性調査）

## Overview

登録キーワード（＋AI拡張語）をもとに X / Instagram / YouTube / 公式サイト / 個人ブログを
毎日横断探索し、日付のあるイベント情報を収集する。毎朝07:00（JST）に新着5件
（確実3件＋探索2件）をLINEで通知し、収集した全件はWeb画面（Vercel + Next.js）で
いつでも閲覧できる。状態はSupabase（Postgres）に集約する。

## Architecture Decisions

- **収集はVercel Cronから起動される単発API呼び出し（GCP Vertex AI: Gemini +
  Google検索グラウンディング）が担う**（2026-08-08、2度の方針転換を経て確定）。
  自前のスクレイパー・NLPロジックは書かず、キーワード拡張・検索・構造化抽出を
  Geminiへの1回の呼び出しに任せる。当初検討したAnthropicクラウドエージェント
  ルーチン(RemoteTrigger)はegress制限で、ローカル実行(`claude -p`+launchd)は
  Macのスリープ依存で、それぞれ不採用になった。自律型AIエージェントという設計自体をやめ、
  Vercelの常時稼働環境で完結する単発API呼び出しに変更したことで両方の問題を回避している。
  詳細は [secrets-handling.md](../docs/research/secrets-handling.md) 参照
- **Webサーバー（Next.js on Vercel）+ Supabase(Postgres) を状態・表示の中心に置く**。
  収集ルーチンはSupabaseの自動生成REST APIに直接書き込み、カスタムAPIを増やさない
- **LINE通知はWebサーバーが仲介**する（ルーチンが直接LINE APIを叩かない）。
  新着5件の選定・重複排除・リンク付与はWebサーバー側のロジックに一本化する
- **ノイズ判定基準は意図的に未確定**。MVPでは「登録キーワード直接一致=確実、
  AI拡張語経由=探索」という単純ルールで仮実装し、運用結果を見てTask 16で調整する
- **X/Instagram/YouTubeは公式APIのみ使用**（非公式スクレイピングは規約違反リスクのため不採用、
  [feasibility調査](../docs/research/data-source-feasibility.md)参照）

## Dependency Graph（概略）

```
Supabase DBスキーマ（keywords/events/notifications/reminder_settings）
    │
    ├── 秘密情報受け渡し方式の確定（クラウドエージェント → Supabase）
    │       │
    │       └── 収集ルーチン v1（DB疎通確認）
    │               │
    │               └── 収集ルーチン v2（実データ収集ロジック）
    │
    ├── Next.js アプリ骨格（Vercel deploy, Supabase接続）
    │       │
    │       ├── キーワード管理画面
    │       ├── 全件閲覧画面（一覧・詳細）
    │       ├── 設定画面（リマインドのタイミング）
    │       │
    │       └── LINE Push送信ロジック（新着5件選定・重複排除）
    │               │
    │               └── リマインドチェックロジック（設定値と締切を突合）
    │
    └── X/Instagram/YouTube 公式API認証情報（ユーザー本人が用意、並行作業可）
```

実装順序は上から下（DBスキーマと秘密情報受け渡しの確定が全ての前提）。
Web側の画面群とルーチン側のロジックは、DBスキーマ確定後は並行して進められる。

## Task List

### Phase 0: 調査・基盤

- [ ] Task 1: 秘密情報の受け渡し方式を確定する
- [ ] Task 2: Supabase プロジェクト作成 + DBスキーマ定義
- [ ] Task 3: Next.js アプリ骨格を Vercel にデプロイし、Supabaseに接続する

### Checkpoint: 基盤
- [ ] クラウドエージェントルーチンからSupabaseへのテスト書き込みが成功する
- [ ] Vercelにデプロイした最小ページがSupabaseのデータを表示できる
- [ ] 人間によるレビュー

### Phase 1: コアループ（キーワード登録 → 収集 → 全件閲覧）

- [ ] Task 4: キーワード管理画面（追加・削除・一覧）
- [ ] Task 5: 収集ルーチン v1（daily-routine.md）— Web検索・YouTube公式APIのみで収集し、
      重複除去・確実/探索の仮判定をしてSupabaseに書き込む（X/Instagram連携はPhase 4に分離）
- [ ] Task 6: RemoteTriggerでルーチンをcron登録（毎日07:00 JST）し、手動実行で動作確認する
- [ ] Task 7: 全件閲覧画面（イベント一覧・詳細ページ）

### Checkpoint: コアループ
- [ ] キーワードを1件登録し、ルーチンを手動実行すると、関連イベントがWeb画面に表示される
- [ ] 過去に収集済みのイベントが重複して増えない
- [ ] 人間によるレビュー

### Phase 2: LINE通知

- [ ] Task 8: LINE公式アカウント・Messaging APIチャネル作成（ユーザー本人作業）+
      Push送信ロジック実装（当日の新着から5件選定・重複排除・Web詳細へのリンク付与）
- [ ] Task 9: 収集完了後にPush送信ロジックが自動的に起動する仕組みを実装する
      （Vercel Cron、または収集ルーチン完了時のWebhook呼び出し）
- [ ] Task 10: LINE通知をタップするとWeb詳細ページへ遷移することを確認する

### Checkpoint: 通知ループ
- [ ] 収集→DB反映→5件選定→LINE Push→タップでWeb遷移が一気通貫で動く
- [ ] 人間によるレビュー（実機のLINEで確認）

### Phase 3: 設定・リマインド

- [ ] Task 11: 設定画面（リマインドのタイミング＝何日前かを保存・変更できる）
- [ ] Task 12: リマインドチェックロジック（イベントの受付開始・締切日と設定値を突合し、
      該当イベントを再度LINE通知。同一リマインドを重複送信しない）
- [ ] Task 13: リマインドチェックの自動実行（Vercel Cron）

### Checkpoint: リマインド
- [ ] 設定を変更すると、その日数前に対象イベントの再通知が届く
- [ ] 人間によるレビュー

### Phase 4: 有料/公式API統合・チューニング

- [ ] Task 14: X API（有料・従量課金）連携を収集ルーチンに追加
      （ユーザーが従量課金アカウントを用意した後に着手）
- [ ] Task 15: Instagram Graph API連携を収集ルーチンに追加
      （ユーザーがBusiness/Creatorアカウントへ切り替えた後に着手）
- [ ] Task 16: ノイズ判定基準（確実/探索の分類ロジック）を、MVP運用結果を見て調整する

### Checkpoint: MVP完成
- [ ] 全情報源（X/Instagram/YouTube/公式サイト/ブログ）が有効
- [ ] Success Criteria（[event-collector-spec.md](../docs/spec/event-collector-spec.md)）を
      すべて満たす
- [ ] 人間によるレビュー、実運用開始

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| クラウドエージェント実行環境に秘密情報を渡す方法が制限されている | High（設計の前提が崩れる） | Task 1を最優先で調査。渡せない場合、Webサーバー側にWebhook受信エンドポイントを用意し、ルーチンがそちらを叩く方式に切り替える |
| X API従量課金がコスト試算（月2〜3万円）を超過する | Medium | Phase 4で導入し、検索対象キーワード数・頻度を最初は絞って様子を見る |
| Supabase無料プロジェクトが一時停止する（1週間操作なし） | Low | 毎日の収集書き込みがあれば実質発生しない。構築中の空白期間だけ注意 |
| LINE Messaging APIの無料メッセージ数上限を超過する | Low | 1日5件+リマインド数件程度であれば個人利用の無料枠に収まる想定。Task 8で上限を確認する |
| AI判定（確実/探索・重複除去）の精度が低く、ノイズや見落としが出る | Medium | Task 16として明示的にチューニング工程を設けている。当初から精度100%を求めない |
| Instagram公式APIが実は横断検索に使えない（[feasibility調査](../docs/research/data-source-feasibility.md)で判明済み） | Medium | 自分が管理するアカウント経由でのInstagram対応範囲を、Task 15着手時に再確認し、
必要ならInstagramはWeb検索経由の収集のみに縮小する |

## Open Questions

- Task 1（秘密情報の受け渡し方式）の調査結果次第で、Phase 0〜1のタスク構成が変わる可能性がある
- Vercel Cron と 収集ルーチン完了のWebhook、どちらでPush送信をトリガーするかはTask 9着手時に決定する
