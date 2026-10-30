-- Optional exact pin on a job. Public APIs never select these columns.
alter table jobs add column if not exists geo_lat double precision;
alter table jobs add column if not exists geo_lng double precision;
