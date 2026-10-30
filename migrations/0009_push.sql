alter table profiles add column if not exists fcm_token text;
alter table profiles add column if not exists notify_raion text not null default '';
alter table profiles add column if not exists notify_push boolean not null default true;

create table if not exists push_devices (
  id serial primary key,
  user_id text not null,
  token text not null,
  endpoint text not null default '',
  p256dh text not null default '',
  auth text not null default '',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (user_id, token)
);

create index if not exists push_devices_user_idx on push_devices (user_id);
create index if not exists push_devices_token_idx on push_devices (token);

create table if not exists push_vapid (
  id integer primary key default 1,
  public_key text not null,
  private_key text not null
);

alter table jobs add column if not exists expire_notified boolean not null default false;
