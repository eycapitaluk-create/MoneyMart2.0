-- campaign_entries_server_writes_only
-- Applied in production after explicit approval.
-- anon / authenticated / PUBLIC lose write privileges.
-- SELECT stays, owner RLS stays, service_role keeps server writes.
-- Do not delete existing rows.

revoke insert, update, delete, truncate, references, trigger
  on table public.campaign_entries
  from public, anon, authenticated;

grant select on table public.campaign_entries to anon, authenticated;
