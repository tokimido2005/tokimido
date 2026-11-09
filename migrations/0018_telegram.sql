-- Phone verification through the Telegram bot (free alternative to SMS).

-- One-time links: site → t.me/<bot>?start=<token> → contact shared in the bot.
create table if not exists telegram_verify_tokens (
  token text primary key,
  user_id text not null,
  purpose text not null default 'verify',
  target_phone text not null default '',
  status text not null default 'pending',
  chat_id bigint,
  tg_user_id bigint,
  tg_phone text not null default '',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists telegram_verify_tokens_user_idx on telegram_verify_tokens (user_id, created_at desc);
create index if not exists telegram_verify_tokens_chat_idx on telegram_verify_tokens (chat_id, created_at desc);

-- Site account ↔ Telegram chat, kept after a successful verification
-- (stage 2 will use it for password resets and notifications).
create table if not exists telegram_links (
  user_id text primary key,
  chat_id bigint not null unique,
  tg_user_id bigint not null,
  username text not null default '',
  phone text not null default '',
  linked_at timestamptz not null default now()
);
