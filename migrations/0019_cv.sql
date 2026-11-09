-- CV builder, uploaded CV files and richer applications for "angajare" jobs.
create table if not exists cvs (
  user_id text primary key,
  data jsonb not null default '{}'::jsonb,
  photo text,
  updated_at timestamptz not null default now()
);

create table if not exists cv_files (
  id serial primary key,
  user_id text not null,
  name text not null default '',
  mime text not null default '',
  size integer not null default 0,
  data bytea not null,
  created_at timestamptz not null default now()
);
create index if not exists cv_files_user_idx on cv_files (user_id, created_at desc);

alter table applications add column if not exists cv_kind text not null default '';
alter table applications add column if not exists cv_snapshot jsonb;
alter table applications add column if not exists cv_photo text;
alter table applications add column if not exists cv_file_id integer;
alter table applications add column if not exists email text not null default '';
alter table applications add column if not exists viewed_at timestamptz;
alter table applications add column if not exists interview_at timestamptz;
alter table applications add column if not exists interview_note text not null default '';
alter table applications add column if not exists employer_note text not null default '';

-- Structured "angajare" listing: responsibilities, requirements, offer, etc.
alter table jobs add column if not exists details jsonb not null default '{}'::jsonb;
