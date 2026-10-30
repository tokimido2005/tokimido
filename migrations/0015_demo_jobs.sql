alter table jobs add column if not exists is_demo boolean not null default false;

create index if not exists jobs_is_demo_idx on jobs (is_demo) where is_demo = true;
