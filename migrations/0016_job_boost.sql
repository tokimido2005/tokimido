alter table jobs add column if not exists boost_tier text not null default '';
alter table jobs add column if not exists boost_until timestamptz;

create index if not exists jobs_boost_idx on jobs (boost_until desc);

create table if not exists job_boosts (
  id serial primary key,
  job_id integer not null references jobs (id) on delete cascade,
  user_id text not null,
  tier text not null,
  price_mdl integer not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists job_boosts_job_idx on job_boosts (job_id, created_at desc);
