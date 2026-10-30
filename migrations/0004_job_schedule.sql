alter table jobs add column if not exists starts_at timestamptz;

update jobs
set starts_at = created_at + interval '2 days'
where starts_at is null;

create index if not exists jobs_starts_at_idx on jobs (starts_at);
