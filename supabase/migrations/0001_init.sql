-- event_collector 初期スキーマ（tasks/todo.md Task 2）
--
-- 設計方針: RLSは全テーブルで有効化し、ポリシーは一切追加しない（=default deny）。
-- Next.jsアプリはブラウザからSupabaseへ直接アクセスせず、必ずサーバー側の
-- APIルート経由でservice_roleキー（RLSをバイパスする）を使ってアクセスする。
-- これにより、anon/publicキーが仮に外部に漏れても読み書き一切できない。
-- 詳細: docs/research/secrets-handling.md

create table if not exists keywords (
  id uuid primary key default gen_random_uuid(),
  keyword text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source text not null,                  -- 取得元（例: 'x.com/kimetsu_off', 公式サイトURL等）
  url text,                               -- 元投稿・元ページへのリンク
  matched_keyword text not null,          -- どの登録キーワードに紐づいたか
  matched_via text not null
    check (matched_via in ('direct', 'expanded')),  -- direct=登録キーワード直接一致, expanded=AI拡張語経由
  confidence text not null
    check (confidence in ('confirmed', 'exploratory')),  -- confirmed=確実枠, exploratory=探索枠
  event_date date,                        -- イベント自体の開催日（不明な場合はnull許容）
  registration_opens_at timestamptz,      -- 受付開始日時
  deadline_at timestamptz,                -- 締切日時
  created_at timestamptz not null default now()
);

create index if not exists events_created_at_idx on events (created_at desc);
create index if not exists events_matched_keyword_idx on events (matched_keyword);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  type text not null check (type in ('daily', 'reminder')),
  sent_at timestamptz not null default now(),
  -- MVP simplification: イベントごとにdaily/reminderは1回ずつしか送らない前提。
  -- 複数段階のリマインド（3日前+当日等）が必要になったらTask 12で見直す。
  unique (event_id, type)
);

create table if not exists reminder_settings (
  id uuid primary key default gen_random_uuid(),
  days_before integer not null default 3,
  created_at timestamptz not null default now()
  -- MVP: 単一行運用。アプリ側は常に最新の1行（created_at最大）を読む。
);

alter table keywords enable row level security;
alter table events enable row level security;
alter table notifications enable row level security;
alter table reminder_settings enable row level security;
-- ポリシーは意図的に追加しない（default deny）。サーバー側はservice_roleキーでアクセスする。
