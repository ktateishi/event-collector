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

## 方針転換（2026-08-08）: ローカル実行への切り替え

クラウドエージェントルーチン（RemoteTrigger）はegress制限で動作しないと判明したため、
**ユーザーの指示によりローカル環境での実行に切り替えた**。RemoteTriggerのルーチンは
無効化（`enabled: false`）した（API上削除はできないため）。

### 新しい実行方式

- `scripts/run-daily-routine.sh` が `web/.env.local` から環境変数を読み込み、
  ローカルの Claude Code CLI（`claude -p`、`--dangerously-skip-permissions`）で
  `prompts/daily-routine.md` の手順を実行する
- スケジューリングはmacOSの `launchd`（毎日07:00 JST）を使う想定
  （まだ未インストール。ユーザーの明示的な許可を得てから常駐設定する）
- 秘密情報（`$APP_URL` / `$INTERNAL_INGEST_TOKEN`）はプロンプト本文に埋め込まず、
  **シェルの環境変数として渡す**。これによりTask 1で懸念していた
  「秘密情報をルーチン設定に埋め込まざるを得ない」問題がローカル実行では解消された
  （クラウド実行特有の制約だった）

### つまずいた点: `claude -p` が指示を実行せず確認を求めてきた

最初の実装では、プロンプトをそのまま渡すと(1)雑談モードのように「何をしましょうか」と
質問してくる、(2)強い命令口調（「確認せず今すぐ実行しろ」）で書き直すと、今度は
プロンプトインジェクションのパターンに酷似していると判断され、正当な自動化かどうか
本人に確認を求めてくる、という2つの失敗モードがあった。

**解決策**: (1)実行はリポジトリのルートディレクトリで行い、`tasks/plan.md` 等の
実在するファイルを参照可能にして正当性を自己検証できるようにする、(2)指示文は
「これは正規の定期実行タスクである」という文脈を与えるに留め、過度に強制的な
命令口調は避ける。この組み合わせで、キーワード0件時の早期終了・キーワードありでの
収集からdry-run・実書き込みまで、期待通りに動作することを確認した（2026-08-08）。

## 再度の方針転換（2026-08-08）: ローカル実行も廃止し、Vercel Cron + Vertex AIへ

ローカル実行（`claude -p` + launchd）は動作したが、**Macがスリープ・電源オフの間は
収集が止まる**という新たな制約が判明した。ユーザーはこれを許容できないと判断し、
「AIエージェントの自律実行」という設計そのものをやめる方針に転換した。

### 新方式

収集ロジックを、自律的にツールを使うAIエージェントではなく、
**Vercelの通常のサーバーレス関数（Cron Job）から呼ばれる単発のAPI呼び出し**に置き換える。

- キーワード拡張・Web検索・構造化抽出を、**GCP Vertex AI（Gemini + Google検索
  グラウンディング）への1回のAPI呼び出し**で行う（Gemini 3以降は構造化出力と
  検索グラウンディングを同一リクエストで併用できる）
- これはVercelのサーバーレス関数から発火するため、**Macの起動状態に一切依存しない**
- 秘密情報（GCPサービスアカウントキー）はVercelの環境変数として保持し、
  クラウドエージェントの実行環境問題（egress制限・秘密情報の埋め込み問題）を
  そもそも回避する

### 廃止したもの

- `scripts/run-daily-routine.sh`（ローカル実行スクリプト）
- RemoteTriggerのルーチン（既に無効化済み）
- ラッコキーワードAPI・Brave Search API・AWS Bedrock構成の検討
  （コスト試算の結果、Vertex AI 1本構成が圧倒的に安価だったため不採用。
  月5,000回まで無料のGoogle検索グラウンディングと、少量のトークン課金のみで
  月5ドル未満に収まる試算）
