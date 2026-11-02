create table if not exists public.player_state (
  user_id text primary key,
  document jsonb not null,
  updated_at timestamptz not null default now()
);
