begin;

create or replace function public.leave_wizard_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_host_user_id uuid;
  v_status text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  select room.host_user_id, room.status into v_host_user_id, v_status
  from public.wizard_rooms room where room.id = p_room_id for update;
  if not found then return; end if;

  if v_host_user_id = v_user_id then
    delete from public.wizard_rooms room where room.id = p_room_id;
    return;
  end if;

  if v_status <> 'lobby' then raise exception 'An active game cannot be left'; end if;
  delete from public.wizard_room_members member
  where member.room_id = p_room_id and member.user_id = v_user_id;
end;
$$;

revoke all on function public.leave_wizard_room(uuid) from public, anon;
grant execute on function public.leave_wizard_room(uuid) to authenticated;

commit;
