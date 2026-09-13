begin;

-- PostgreSQL exposes jsonb_object_keys but has no built-in jsonb_object_length.
-- Keep the action validator readable with a private, non-callable helper.
create or replace function private.jsonb_object_length(p_value jsonb)
returns bigint
language sql
immutable
strict
set search_path = ''
as $$
  select count(*) from pg_catalog.jsonb_object_keys(p_value);
$$;

revoke all on function private.jsonb_object_length(jsonb) from public, anon, authenticated;
alter function public.submit_wizard_action(uuid, bigint, jsonb)
  set search_path = 'private';

commit;
