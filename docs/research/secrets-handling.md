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

- [x] 内部トークンを使い、実際にVercel経由でSupabaseへのテスト書き込みが成功することを確認
      （Task 4・Task 5でcurl検証済み）
- [x] 秘密情報がリポジトリやログに平文で残っていないことを確認

## 重大な追加発見（2026-08-08、Task 6）: クラウドエージェント実行環境のegress制限

Task 6でRemoteTriggerルーチンを実際にcron登録・手動実行したところ、
**ルーチンの実行環境（`environment_id: env_016D6G3pQ4LtcdinHbmWrvhq`、"test"環境）から
`web-three-eta-ruwyukkmq1.vercel.app` への外部通信がegressポリシーにより
ブロックされている**ことが判明した（CONNECTトンネルで403）。WebFetch・Bash経由のcurl
どちらでも同様にブロックされ、`/api/keywords` にすら到達できず、収集は0件だった。

これは秘密情報の受け渡し方式（本ドキュメント上部）とは別の、**より基礎的な制約**である。
トークンをどう安全に渡すか以前に、そもそもルーチンの実行環境から自分のVercelアプリに
到達できない可能性がある。

### 想定される原因

共有／デフォルトの実行環境には、悪用防止のためデフォルトで厳しいegressポリシー
（許可リストに載っていないホストへの通信を拒否）が設定されていると考えられる。

### 対応の選択肢（ユーザー判断が必要）

1. **環境のegress許可リストに `web-three-eta-ruwyukkmq1.vercel.app` を追加する。**
   ただしこの設定はRemoteTrigger APIのcreate/updateボディには存在せず、
   claude.aiのWeb UI（環境管理画面）側の設定と思われる。Claude Code側から
   直接操作するツールがないため、**ユーザー本人がclaude.aiのUIで確認・設定する必要がある**
2. **MCPコネクタ経由でアクセスする**（Supabase公式MCPコネクタ等が存在すれば）。
   MCP接続はルーチンに自動付与されている `Claude_Code_Remote` 接続と同様、
   generic egressとは別経路である可能性があり、許可リストの制約を受けない可能性がある。
   要調査
3. **別のenvironment_idを使う**（もしegress制限のより緩い環境が用意されていれば）。
   現時点で "test" 以外の環境の有無は未確認

いずれもユーザー側の追加調査・設定が必要なため、Task 6は
「ルーチンの登録・cron設定・プロンプトの内容」までは完了とし、
「実際にVercelへ到達して収集が行われる」ことの確認はブロックされている状態とする。
