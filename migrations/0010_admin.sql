alter table profiles add column if not exists role text not null default 'user';
alter table profiles add column if not exists banned_at timestamptz;
alter table profiles add column if not exists banned_until timestamptz;
alter table profiles add column if not exists ban_reason text not null default '';

alter table jobs add column if not exists hidden boolean not null default false;

create index if not exists profiles_role_idx on profiles (role);
create index if not exists jobs_hidden_idx on jobs (hidden) where hidden = true;

create table if not exists admin_actions (
  id serial primary key,
  admin_id text not null,
  action text not null,
  target_type text not null default '',
  target_id text not null default '',
  details text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists admin_actions_created_idx on admin_actions (created_at desc);

create table if not exists admin_messages (
  id serial primary key,
  admin_id text not null,
  user_id text not null,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists admin_messages_user_idx on admin_messages (user_id, created_at desc);
