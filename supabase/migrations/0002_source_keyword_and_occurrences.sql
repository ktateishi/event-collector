-- Task 17 / Task 18（tasks/todo.md）
--
-- Task 17: どの登録キーワードのために収集したかを保持する。
--   既存の matched_keyword は「実際に一致した語」（expandedの場合は "MAPPA" のような
--   関連語が入る）であり、カテゴリ分けには使えないため別列を追加する。
--   外部キーではなく文字列にすることで、キーワード削除後もイベントが意味を保てる。
--
-- Task 18: 同一イベントの複数会場・複数地域を1行にまとめ、各回の情報を保持する。
--   例: [{"label":"東京会場","event_date":"2026-09-16","url":"..."}, ...]

alter table events add column if not exists source_keyword text;
alter table events add column if not exists occurrences jsonb not null default '[]'::jsonb;

create index if not exists events_source_keyword_idx on events (source_keyword);
