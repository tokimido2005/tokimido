alter table jobs add column if not exists kind text not null default 'rapid';
alter table jobs add column if not exists company text not null default '';
alter table jobs add column if not exists contract_type text not null default '';
alter table jobs add column if not exists schedule text not null default '';
alter table jobs add column if not exists salary_period text not null default 'spot';
create index if not exists jobs_kind_status_idx on jobs (kind, status, created_at desc);
