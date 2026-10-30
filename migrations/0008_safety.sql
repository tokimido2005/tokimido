alter table jobs add column if not exists views_count integer not null default 0;

create unique index if not exists profiles_phone_unique
  on profiles (phone)
  where phone <> '';

create table if not exists blocks (
  blocker_id text not null,
  blocked_id text not null,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

create index if not exists blocks_blocked_idx on blocks (blocked_id);

create table if not exists support_messages (
  id serial primary key,
  user_id text,
  name text not null,
  email text not null,
  message text not null,
  created_at timestamptz not null default now()
);
