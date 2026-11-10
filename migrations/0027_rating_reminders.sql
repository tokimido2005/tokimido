-- Review reminders sent by push/Telegram: stage 1 when a review becomes
-- possible, stage 2 one day later if it is still missing.
create table if not exists rating_reminders (
  job_id integer not null,
  from_user_id text not null,
  to_user_id text not null,
  stage integer not null default 1,
  sent_at timestamptz not null default now(),
  primary key (job_id, from_user_id, to_user_id)
);
