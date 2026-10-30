create table if not exists jobs (
  id serial primary key,
  user_id text not null,
  title text not null,
  description text not null,
  category text not null,
  raion text not null,
  locality text not null,
  payment_mdl integer not null,
  duration_minutes integer not null,
  people_needed integer not null,
  contact_phone text,
  poster_name text not null default '',
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create index if not exists jobs_status_created_idx on jobs (status, created_at desc);
create index if not exists jobs_raion_idx on jobs (raion);
create index if not exists jobs_category_idx on jobs (category);
create index if not exists jobs_user_id_idx on jobs (user_id);

create table if not exists applications (
  id serial primary key,
  job_id integer not null references jobs (id) on delete cascade,
  user_id text not null,
  applicant_name text not null default '',
  message text not null default '',
  contact_phone text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique (job_id, user_id)
);

create index if not exists applications_job_id_idx on applications (job_id);
create index if not exists applications_user_id_idx on applications (user_id);
