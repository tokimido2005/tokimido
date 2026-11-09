-- Age rules: year of birth on the profile, "adults only" (heavy work) on rapid jobs.
alter table profiles add column if not exists birth_year integer;
alter table jobs add column if not exists adults_only boolean not null default false;
-- "Angajare" listings are always 18+.
update jobs set adults_only = true where coalesce(kind, 'rapid') = 'oficial' and adults_only = false;
