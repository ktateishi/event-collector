# 秘密情報の受け渡し方式（Task 1 調査結果）

作成日: 2026-08-08
関連: [tasks/todo.md](../../tasks/todo.md) Task 1

## 調査した範囲

`RemoteTrigger`（クラウドエージェントルーチンのAPI）のツールスキーマと、`schedule`
スキルのドキュメントを確認した。

## 分かったこと

**RemoteTriggerには秘密情報・環境変数を渡す専用の仕組みが存在しない。**

- `create`/`update`のbodyは `name` / `cron_expression` / `job_config` / `mcp_connections` のみ。
  `job_config.ccr` は `environment_id`・`session_context`（model, sources, allowed_tools）・
  `events`（実行時に渡すプロンプト本文）で構成されている
- 環境変数・シークレットストア・Vault的な仕組みへの言及はドキュメント上どこにもない
- 唯一「認証情報をプロンプトに直接書かずに済む」経路は **`mcp_connections`**（MCPコネクタ）。
  ただしこれは事前に https://claude.ai/customize/connectors で接続しておいた連携サービス
  （Slack, Datadog等の例示あり）向けの仕組みであり、Supabase・LINE・X・Instagram・YouTubeの
  公式MCPコネクタが存在するかは別途確認が必要

## 採用する方式

**ルーチンには本物のAPIキーを持たせず、自前のVercelサーバーを経由させる。**

```
収集ルーチン（RemoteTrigger）
  └─ 唯一持つ秘密情報: Vercel側の取り込み用エンドポイントへの内部トークン1本のみ
        │  POST /api/ingest  Authorization: Bearer <internal_token>
        ▼
Vercelサーバー（環境変数として安全に保持）
  ├─ SUPABASE_SERVICE_ROLE_KEY
  ├─ LINE_CHANNEL_ACCESS_TOKEN
  ├─ X_API_KEY / X_API_SECRET
  ├─ YOUTUBE_API_KEY
  └─ INSTAGRAM_ACCESS_TOKEN
```

**理由:**
- Vercelの環境変数は標準的な方法で安全に管理でき（ダッシュボード上で設定、
  ビルドログにも出力されない）、実績のある仕組みに乗れる
- ルーチン側が持つ秘密情報を「内部トークン1本」に絞ることで、
  仮にこのトークンが漏れても被害範囲を「自分のingestエンドポイントを叩けるだけ」に限定できる
- 内部トークンは自分で発行するランダム文字列であり、外部ベンダーのアカウントに
  紐づかない。漏れてもすぐ再発行・失効できる

**ルーチン検索用のWeb検索・YouTube Data API呼び出し**については、YouTube Data API
（無料枠）はルーチン側から直接叩いても実害が小さいため、当面はルーチン側に直接
持たせる案も現実的。ただしTask 5着手時に、YouTube呼び出しもVercel経由にまとめるか
再検討する（一貫性を優先するなら全API呼び出しをVercel経由にする）。

## 残るリスクと限界

- **内部トークン自体は、RemoteTriggerのルーチン設定（プロンプト本文）に埋め込む必要がある。**
  これはgitリポジトリにはコミットされないが、`RemoteTrigger action=get` で
  ルーチン設定を閲覧できる人（＝本人のclaude.aiアカウントにアクセスできる人）には見える。
  リポジトリへのコミットよりは狭い露出範囲だが、ゼロではない
- MCPコネクタ経由でSupabase等に接続できれば、この内部トークンすら不要にできる可能性がある。
  Task 2着手時（Supabaseプロジェクト作成後）に、公式MCPコネクタの有無を再確認する価値がある

## 未検証（Supabaseプロジェクト作成後に実施）

Task 1のAcceptance Criteriaのうち、以下は **Supabaseプロジェクトの存在が前提**のため、
Task 2完了後に改めて実施する:

- [ ] 内部トークンを使い、実際にVercel経由でSupabaseへのテスト書き込みが成功することを確認
- [ ] 秘密情報がリポジトリやログに平文で残っていないことを確認
