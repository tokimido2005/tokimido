create table if not exists monetization_settings (
  id integer primary key default 1,
  mode text not null default 'free',
  monthly_price_mdl integer not null default 49,
  free_job_limit integer not null default 2,
  free_apply_limit integer not null default 5,
  updated_at timestamptz not null default now(),
  updated_by text not null default ''
);

insert into monetization_settings (id, mode, monthly_price_mdl, free_job_limit, free_apply_limit)
values (1, 'free', 49, 2, 5)
on conflict (id) do nothing;

create table if not exists subscriptions (
  id serial primary key,
  user_id text not null,
  status text not null default 'active',
  source text not null default 'self',
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists subscriptions_user_idx on subscriptions (user_id, expires_at desc);
create index if not exists subscriptions_active_idx on subscriptions (status, expires_at)
  where status = 'active';

create table if not exists monetization_log (
  id serial primary key,
  admin_id text not null,
  from_mode text not null default '',
  to_mode text not null,
  monthly_price_mdl integer not null,
  free_job_limit integer not null,
  free_apply_limit integer not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists monetization_log_created_idx on monetization_log (created_at desc);
