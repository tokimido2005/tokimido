-- Company pages: one per employer account, verified manually by the admin.
create table if not exists companies (
  id serial primary key,
  owner_id text not null unique,
  slug text not null unique,
  name text not null,
  logo text,
  description text not null default '',
  city text not null default '',
  website text not null default '',
  size text not null default '',
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
