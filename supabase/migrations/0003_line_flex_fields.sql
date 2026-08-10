-- LINE Flex Messageカルーセル対応（ユーザー要望、2026-08-10）
--
-- category: カード背景画像のフォールバック（カテゴリアイコン）に使う固定分類。
--   固定値のみ（movie/exhibition/game/concert/collab/other）。Gemini抽出時に判定する
-- summary: カードに表示する1行要約。Gemini抽出時に生成する
-- image_url: 収集済みページのog:imageから抽出した実際のイベント画像（あれば最優先で使う）
--
-- いずれも既存イベントはNULLのままになる（Task 16のノイズ判定同様、後から埋まる想定）。
-- 表示・送信ロジック側でNULL許容のフォールバックを持つため、埋め戻しのバッチ処理は不要。

-- category/matched_via/confidence等と同様、固定値の妥当性チェックは
-- アプリケーション層（lib/ingest.ts）で行い、DB制約は設けない（既存の方針を踏襲）
alter table events add column if not exists category text;
alter table events add column if not exists summary text;
alter table events add column if not exists image_url text;
