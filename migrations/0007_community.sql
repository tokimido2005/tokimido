alter table profiles add column if not exists photo_data text;

create table if not exists reports (
  id serial primary key,
  reporter_id text not null,
  target_type text not null check (target_type in ('job', 'user')),
  target_id text not null,
  reason text not null,
  details text not null default '',
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists reports_status_idx on reports (status, created_at desc);
create index if not exists reports_reporter_idx on reports (reporter_id);

create table if not exists favorites (
  user_id text not null,
  job_id integer not null references jobs (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, job_id)
);

create index if not exists favorites_user_id_idx on favorites (user_id);
