-- "Alertele mele": several raions / categories, Telegram + browser, 5 per day + evening digest.
create table if not exists job_alerts (
  user_id text primary key,
  raions text[] not null default '{}',
  categories text[] not null default '{}',
  kinds text[] not null default '{rapid,oficial}',
  via_push boolean not null default true,
  via_telegram boolean not null default true,
  paused boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists alert_log (
  id serial primary key,
  user_id text not null,
  job_id integer,
  channel text not null default '',
  sent_at timestamptz not null default now()
);
create index if not exists alert_log_user_idx on alert_log (user_id, sent_at desc);

create table if not exists alert_queue (
  user_id text not null,
  job_id integer not null,
  created_at timestamptz not null default now(),
  primary key (user_id, job_id)
);

-- Carry over the old single raion / category settings.
alter table profiles add column if not exists notify_raion text;
alter table profiles add column if not exists notify_category text not null default '';
alter table profiles add column if not exists notify_push boolean not null default true;
insert into job_alerts (user_id, raions, categories, via_push)
select p.user_id,
       array[p.notify_raion],
       case when coalesce(p.notify_category, '') = '' then '{}'::text[] else array[p.notify_category] end,
       coalesce(p.notify_push, true)
from profiles p
where coalesce(p.notify_raion, '') <> ''
on conflict (user_id) do nothing;
