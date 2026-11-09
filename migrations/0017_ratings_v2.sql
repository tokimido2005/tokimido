-- Ratings v2: quick tags, "the job didn't happen", snooze/reminders, blind reveal.

alter table ratings add column if not exists tags text[] not null default '{}';

-- When the poster marked the job completed (rating window is measured from it).
alter table jobs add column if not exists completed_at timestamptz;

-- "Jobul nu a avut loc" instead of stars. Counts as answered for the prompt.
create table if not exists rating_skips (
  id serial primary key,
  job_id integer not null references jobs (id) on delete cascade,
  from_user_id text not null,
  to_user_id text not null,
  reason text not null default 'no_show',
  created_at timestamptz not null default now(),
  unique (job_id, from_user_id, to_user_id)
);
create index if not exists rating_skips_to_user_idx on rating_skips (to_user_id);

-- Per-person prompt state: "Mai târziu" snooze and reminder bookkeeping.
create table if not exists rating_prompts (
  user_id text not null,
  job_id integer not null references jobs (id) on delete cascade,
  to_user_id text not null,
  snoozed_until timestamptz,
  reminders_sent integer not null default 0,
  last_reminded_at timestamptz,
  primary key (user_id, job_id, to_user_id)
);
