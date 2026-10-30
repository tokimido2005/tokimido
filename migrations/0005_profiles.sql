create table if not exists profiles (
  user_id text primary key,
  first_name text not null default '',
  last_name text not null default '',
  phone text not null default '',
  accepted_rules_at timestamptz not null default now()
);

create index if not exists profiles_phone_idx on profiles (phone);
