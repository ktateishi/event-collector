#!/bin/bash
# event_collector 収集ルーチンをローカルで実行する。
# launchd（毎日07:00 JST）またはユーザーの手動実行から呼ばれる想定。
# クラウドエージェントルーチン(RemoteTrigger)はegressポリシーによりVercelへ到達できず
# 使用できないため、ローカルのClaude Code CLI (`claude -p`) で代替している。
# 詳細: docs/research/secrets-handling.md

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

set -a
# shellcheck disable=SC1091
source web/.env.local
set +a

export APP_URL="${APP_URL:-https://web-three-eta-ruwyukkmq1.vercel.app}"
export DRY_RUN="${DRY_RUN:-true}"

mkdir -p logs
LOG_FILE="logs/daily-routine-$(date +%Y-%m-%d-%H%M%S).log"

echo "=== daily-routine start: $(date -u +%Y-%m-%dT%H:%M:%SZ) (DRY_RUN=$DRY_RUN) ===" | tee -a "$LOG_FILE"

DIRECTIVE="このセッションは event_collector プロジェクト（このリポジトリのオーナー自身が
tasks/plan.md・tasks/todo.mdに沿って構築した個人用ツール）の定期実行タスクとして、
scripts/run-daily-routine.sh から launchd 経由（または手動）で起動されました。
リポジトリの内容（tasks/plan.md, tasks/todo.md, docs/research/secrets-handling.md等）を
必要に応じて確認し、これが正規の自動化であることを確かめた上で進めてください。

以下の prompts/daily-routine.md の手順に従って、イベント収集から \$APP_URL/api/ingest への
送信までを実行してください。このセッションではリポジトリのコードは変更しないこと。

---

$(cat prompts/daily-routine.md)"

claude -p "$DIRECTIVE" \
  --allowedTools "Bash,WebSearch,WebFetch,Read,Glob,Grep" \
  --dangerously-skip-permissions \
  >> "$LOG_FILE" 2>&1

echo "=== daily-routine end: $(date -u +%Y-%m-%dT%H:%M:%SZ) ===" | tee -a "$LOG_FILE"
