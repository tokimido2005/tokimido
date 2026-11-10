-- Fix: the old notification prompt saved the chosen raion only in
-- profiles.notify_raion, which the alert system no longer reads. Give those
-- users a real alert (same as migration 0021 did for earlier users).
insert into job_alerts (user_id, raions, categories, via_push)
select p.user_id,
       array[p.notify_raion],
       case when coalesce(p.notify_category, '') = '' then '{}'::text[] else array[p.notify_category] end,
       coalesce(p.notify_push, true)
from profiles p
where coalesce(p.notify_raion, '') <> ''
on conflict (user_id) do nothing;
