# SPEC: 不要イベントの除外機構

参照: [event-collector.md](docs/intent/event-collector.md)（プロジェクト全体の確定意図）、
[event-collector-spec.md](docs/spec/event-collector-spec.md)（全体仕様）、
[tasks/todo.md](tasks/todo.md)（タスク一覧。本機能は完了後にここへ追記する）

このファイルは event_collector プロジェクトへの追加機能1件分のミニスペックであり、
プロジェクト全体のスペックを置き換えるものではない。

## 1. Objective（目的）

**背景**: 現在の収集結果には「フィギュア・ポスター等のグッズ発売情報」が多く混ざっており、
ユーザー（本人・個人利用）にとってはノイズになっている。実データ113件中29件（約26%）が
`category: "collab"`（コラボ商品・グッズ・カフェ等の複合カテゴリ）に分類されている。

**目的**: 2段構えのノイズ除外機構を作る。
1. **自動除外**: `category: "collab"` に分類されたイベントは収集時点で除外（非表示）にする
2. **手動除外**: Web画面から任意のイベントを「不要」として個別にフラグ付けできるようにし、
   かつそのフラグ内容を今後の自動収集（Gemini抽出プロンプト）にフィードバックして、
   似たような不要イベントを将来的にも減らしていく

**対象ユーザー**: 本人のみ（既存プロジェクトと同じ、個人利用）

**非目的（今回やらないこと）**:
- 機械学習によるスコアリング・分類器の学習は行わない（Geminiプロンプトへの実例フィードバックで代替）
- 除外したイベントの完全削除は行わない（データは残し、表示・通知からのみ除外する）
- `category` の分類粒度自体の見直し（collabをさらに細分化する等）は今回は行わない
  （ユーザーが「collabカテゴリ全体を除外」を明示的に選択したため）

## 2. 決定事項（ユーザーとの確認済み）

| 論点 | 決定 |
|---|---|
| 自動除外の範囲 | `category = "collab"` のイベント全体（コラボ商品・グッズ・カフェ・ポップアップ含む） |
| 手動フラグの挙動 | 一覧・LINE通知から非表示にするが、DBの行は削除しない（後から確認・復元できる） |
| 手動フラグの学習 | この1件のみを非表示にするだけでなく、フラグ内容を今後の収集にも反映する（下記4.4） |
| 既存データへの適用 | 遡及適用する。デプロイ後、既存の`category = "collab"`（29件、2026-08-13時点）を一括で除外状態にする |

## 3. Commands

このプロジェクト固有のコマンドに変更はない。

```bash
cd web
npm test        # vitest run
npm run build   # next build（型チェック含む）
```

一括除外の遡及適用は、他の一回限りのデータ操作（Task 12のテストイベント作成・削除等）と
同様、スクラッチスクリプトで一度だけ本番Supabaseに対して実行する（マイグレーションSQLとは
別。マイグレーションはスキーマ変更のみを扱う既存方針を踏襲）。

## 4. Project Structure（追加・変更するファイル）

### 4.1 スキーマ変更

`supabase/migrations/0004_event_exclusion.sql`（新規）

```sql
-- 不要イベントの除外機構（ユーザー要望、2026-08-13）
--
-- excluded_at: nullなら表示対象、値が入っていれば非表示（自動判定 or 手動フラグ）
-- excluded_reason: 'category' (自動: category=collabによる除外) | 'manual' (手動フラグ)
alter table events add column if not exists excluded_at timestamptz;
alter table events add column if not exists excluded_reason text;

-- 手動フラグの学習用: ユーザーが「不要」と判断した実例を蓄積し、
-- 収集プロンプトへの負例として使う。events行が後で物理削除されても
-- （Task 20の猶予期間付き削除）この学習データは残る
create table if not exists excluded_examples (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_keyword text,
  created_at timestamptz not null default now()
);
```

### 4.2 収集パイプライン（自動除外・学習の反映）

- `web/lib/ingest.ts`: `category === "collab"` の候補は、挿入時に
  `excluded_at = now()`, `excluded_reason = "category"` を設定して保存する
  （破棄はしない。データは残し、表示のみ除外する）
- `web/lib/gemini-prompt.ts`（`buildExtractionPrompt`）: 直近の`excluded_examples`
  （例: 直近10件）をプロンプトに負例として埋め込み、「以下のような商品発売系の情報は
  抽出しないでください」という指示を追加する
- `web/lib/excluded-examples.ts`（新規）: `excluded_examples`のCRUD
  （`listRecentExcludedExamples`, `addExcludedExample`）

### 4.3 表示・通知からの除外

- `web/lib/events.ts`: `listEvents`が返す一覧から`excluded_at is not null`を
  デフォルトで除外するフィルタを追加（`filterUpcoming`と同様、一覧画面・LINE通知選定
  （`selectEventsToNotify`）双方に効くよう、events取得層で一元化する）

### 4.4 手動フラグUI

- `web/app/api/events/[id]/exclude/route.ts`（新規）: `POST`で該当イベントに
  `excluded_at = now()`, `excluded_reason = "manual"` を設定し、
  `excluded_examples`にもタイトルを追加する
- `web/components/EventRow.tsx` および `web/app/events/[id]/page.tsx`:
  「不要」ボタンを追加（確認ダイアログ等は不要、即時実行でよい。誤操作時は
  DBの行が残っているため後から手動で戻せる）

### 4.5 遡及適用（一回限りのスクリプト実行）

実装・デプロイ後、本番Supabaseに対して以下相当の一回限りの更新を実行する
（既存の`category = "collab"`かつ`excluded_at is null`の行に適用）。

```sql
update events
set excluded_at = now(), excluded_reason = 'category'
where category = 'collab' and excluded_at is null;
```

## 5. Code Style

既存プロジェクトの規約をそのまま踏襲する（新規ルールなし）。
- テスト駆動（RED→GREEN）。ロジックは`lib/`に置きテストを書く。ルートは薄いラッパーに留める
- コメントは「なぜ」を書く（既存コードのスタイルに準拠）
- Tailwindデザインシステム（Task 19確立分）に合わせたUI

## 6. Testing Strategy

- `lib/excluded-examples.ts`: Supabaseモックによるユニットテスト（既存`lib/notifications.ts`等と同様のパターン）
- `lib/ingest.ts`: `category === "collab"`挿入時に`excluded_at`/`excluded_reason`が
  正しく設定されるテストケースを追加
- `lib/events.ts`: `listEvents`が除外済みイベントを除くテストケースを追加
- `lib/gemini-prompt.ts`: `buildExtractionPrompt`に負例が正しく埋め込まれるテスト
- UI（「不要」ボタン）はブラウザでの動作確認（Task 19以降の既存パターンに準拠）
- 遡及適用スクリプトは実行前に対象件数をドライラン確認してから適用する

## 7. Boundaries（境界）

**常にやってよいこと**:
- 除外は非表示のみ。物理削除は行わない
- テスト駆動で実装し、`npm run build`・`vitest run`を都度確認する

**必ず確認を取ること**:
- 遡及適用（既存29件への一括適用）を実行する前に、対象件数を提示して確認を取る
- 本番へのデプロイ（push）前後の手順は既存プロジェクトの慣習（CI/CD経由）に従う

**絶対にやらないこと**:
- `events`テーブルの行を物理削除する形での「除外」実装
- ユーザー確認なしに一括更新SQLを本番に対して実行する
- `category`分類ロジック自体（movie/exhibition/game/concert/collab/other）の再設計
  （今回のスコープ外）
