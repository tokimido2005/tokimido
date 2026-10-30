create table if not exists sms_codes (
  id serial primary key,
  phone text not null,
  user_id text,
  purpose text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  locked_until timestamptz,
  ticket_hash text,
  ticket_expires_at timestamptz,
  ip text not null default '',
  created_at timestamptz not null default now()
);

create unique index if not exists sms_codes_phone_purpose_uidx on sms_codes (phone, purpose);

create table if not exists sms_log (
  id serial primary key,
  phone text not null default '',
  user_id text,
  ip text not null default '',
  purpose text not null default 'verify',
  event text not null,
  detail text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists sms_log_created_idx on sms_log (created_at desc);
create index if not exists sms_log_phone_idx on sms_log (phone, created_at desc);
create index if not exists sms_log_ip_idx on sms_log (ip, created_at desc);
