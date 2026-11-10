-- Telegram chats that receive admin alerts (new reports). Separate from
-- telegram_links: the owner's personal account may already use the same chat.
create table if not exists admin_alert_chats (
  chat_id bigint primary key,
  created_at timestamptz not null default now()
);

create index if not exists reports_target_idx on reports (target_type, target_id, status);
