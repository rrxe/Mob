-- Green Valley schema. Run once in Supabase -> SQL Editor.
-- Farm state is stored in rl_players.data (jsonb); gem changes use rl_ledger; GRAM requests use rl_withdrawals.
-- The server talks to these tables with the service-role key only (RLS enabled, no public policies).

create table if not exists rl_players (
  tid text primary key,
  kname text not null,
  region int,
  power numeric default 0,
  data jsonb not null,
  updated_at timestamptz default now()
);
create unique index if not exists rl_players_kname_uq on rl_players (lower(kname));
create index if not exists rl_players_power_idx on rl_players (power desc);

create table if not exists rl_alliances (
  id text primary key,
  name text not null,
  data jsonb not null,
  updated_at timestamptz default now()
);

create table if not exists rl_settings (
  key text primary key,
  value jsonb not null
);

create table if not exists rl_ledger (
  id bigserial primary key,
  tid text not null,
  delta bigint not null,
  kind text not null,
  ref text,
  created_at timestamptz default now()
);
create index if not exists rl_ledger_tid_idx on rl_ledger (tid, created_at desc);

create table if not exists rl_withdrawals (
  id uuid primary key default gen_random_uuid(),
  tid text not null,
  gram numeric not null,
  address text not null,
  status text not null default 'pending',   -- pending | paid | rejected
  tx_hash text,
  note text,
  created_at timestamptz default now(),
  reviewed_at timestamptz
);
create index if not exists rl_withdrawals_status_idx on rl_withdrawals (status, created_at desc);
create index if not exists rl_withdrawals_tid_idx on rl_withdrawals (tid, created_at desc);

alter table rl_players enable row level security;
alter table rl_alliances enable row level security;
alter table rl_settings enable row level security;
alter table rl_ledger enable row level security;
alter table rl_withdrawals enable row level security;
