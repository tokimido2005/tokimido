-- Growth statistics for the admin panel.
alter table applications add column if not exists selected_at timestamptz;

-- Anonymous page views: no IP, no cookie. `visitor` is a hash of IP + browser
-- + day + server secret, so the same person cannot be followed across days.
-- Rows older than 90 days are deleted automatically.
create table if not exists page_views (
  id bigserial primary key,
  day date not null,
  path text not null,
  source text not null default 'direct',
  visitor text not null,
  created_at timestamptz not null default now()
);
create index if not exists page_views_day_idx on page_views (day);

-- What people type in the site search, with the number of results.
create table if not exists site_searches (
  id bigserial primary key,
  day date not null,
  q text not null,
  kind text not null default 'rapid',
  results integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists site_searches_day_idx on site_searches (day);
