-- 不要イベントの除外機構（ユーザー要望、2026-08-13。詳細はSPEC.md参照）
--
-- excluded_at: nullなら表示対象、値が入っていれば非表示（自動判定 or 手動フラグ）。
--   物理削除はしない（後から確認・復元できるようにするため）
-- excluded_reason: 'category'（自動: category=collabによる除外） | 'manual'（手動フラグ）
alter table events add column if not exists excluded_at timestamptz;
alter table events add column if not exists excluded_reason text;

-- 手動フラグの学習用: ユーザーが「不要」と判断した実例を蓄積し、Gemini抽出プロンプトへの
-- 負例として使う。events行が後で物理削除されても（Task 20の猶予期間付き削除）
-- この学習データは残るよう、eventsとは独立したテーブルにする
create table if not exists excluded_examples (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_keyword text,
  created_at timestamptz not null default now()
);
