create table if not exists ratings (
  id serial primary key,
  job_id integer not null references jobs (id) on delete cascade,
  from_user_id text not null,
  to_user_id text not null,
  stars integer not null check (stars >= 1 and stars <= 5),
  comment text not null default '',
  created_at timestamptz not null default now(),
  unique (job_id, from_user_id, to_user_id)
);

create index if not exists ratings_to_user_id_idx on ratings (to_user_id);
create index if not exists ratings_from_user_id_idx on ratings (from_user_id);
create index if not exists ratings_job_id_idx on ratings (job_id);
