begin;

-- These helpers live outside the exposed API schema, but the authenticated
-- database role still needs EXECUTE so PostgreSQL can evaluate policies that
-- call them for the current user.
grant usage on schema private to authenticated;
grant execute on function private.is_wizard_room_member(uuid) to authenticated;
grant execute on function private.is_wizard_room_host(uuid) to authenticated;
grant execute on function private.is_wizard_room_topic_member(text) to authenticated;

commit;
