-- One-time password-reset links sent by the Telegram bot.
create table if not exists telegram_reset_tokens (
  token_hash text primary key,
  user_id text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists telegram_reset_tokens_user_idx on telegram_reset_tokens (user_id, created_at desc);
