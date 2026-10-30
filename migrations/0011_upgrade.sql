alter table profiles add column if not exists phone_verified_at timestamptz;
alter table profiles add column if not exists bio text not null default '';
alter table profiles add column if not exists notify_email boolean not null default true;
alter table profiles add column if not exists notify_category text not null default '';
alter table profiles add column if not exists invite_code text;
alter table profiles add column if not exists invited_by text;

create unique index if not exists profiles_invite_code_uidx
  on profiles (invite_code)
  where invite_code is not null;

create table if not exists phone_verifications (
  user_id text primary key,
  phone text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists user_warnings (
  id serial primary key,
  user_id text not null,
  admin_id text not null,
  reason text not null,
  created_at timestamptz not null default now()
);
create index if not exists user_warnings_user_idx on user_warnings (user_id, created_at desc);

create table if not exists job_reminders (
  id serial primary key,
  user_id text not null,
  job_id integer not null references jobs (id) on delete cascade,
  remind_at timestamptz not null,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, job_id)
);
create index if not exists job_reminders_due_idx on job_reminders (remind_at)
  where sent_at is null;

create table if not exists invites (
  code text primary key,
  inviter_id text not null,
  used_by text,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
