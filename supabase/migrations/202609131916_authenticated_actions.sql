begin;

create table public.wizard_actions (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.wizard_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  expected_revision bigint not null check (expected_revision >= 1),
  action jsonb not null check (jsonb_typeof(action) = 'object'),
  created_at timestamptz not null default now()
);

create index wizard_actions_room_revision_idx on public.wizard_actions (room_id, expected_revision);
create index wizard_actions_user_id_idx on public.wizard_actions (user_id);
alter table public.wizard_actions enable row level security;

create policy wizard_actions_host_select
on public.wizard_actions for select to authenticated
using ((select private.is_wizard_room_host(room_id)));

revoke all on public.wizard_actions from anon, authenticated;
grant select on public.wizard_actions to authenticated;

create or replace function public.submit_wizard_action(
  p_room_id uuid,
  p_expected_revision bigint,
  p_action jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_seat_id text;
  v_action_type text := p_action ->> 'type';
  v_action_id bigint;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  select member.seat_id into v_seat_id
  from public.wizard_room_members member
  join public.wizard_rooms room on room.id = member.room_id
  where member.room_id = p_room_id
    and member.user_id = v_user_id
    and room.status = 'playing'
    and room.revision = p_expected_revision;
  if not found then raise exception 'Room changed or membership is invalid'; end if;
  if v_action_type not in ('CHOOSE_TRUMP', 'PLACE_BID', 'PLAY_CARD', 'ACKNOWLEDGE_ROUND') then
    raise exception 'Invalid player action';
  end if;
  if v_action_type <> 'ACKNOWLEDGE_ROUND' and p_action ->> 'playerId' <> v_seat_id then
    raise exception 'Action does not belong to this seat';
  end if;
  insert into public.wizard_actions (room_id, user_id, expected_revision, action)
  values (p_room_id, v_user_id, p_expected_revision, p_action)
  returning id into v_action_id;
  return v_action_id;
end;
$$;

revoke all on function public.submit_wizard_action(uuid, bigint, jsonb) from public, anon;
grant execute on function public.submit_wizard_action(uuid, bigint, jsonb) to authenticated;

alter function public.commit_wizard_game_state(uuid, bigint, text, jsonb, jsonb)
  rename to commit_wizard_game_state_without_action_cleanup;

create or replace function public.commit_wizard_game_state(
  p_room_id uuid,
  p_expected_revision bigint,
  p_status text,
  p_game_state jsonb,
  p_player_states jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next_revision bigint;
begin
  v_next_revision := public.commit_wizard_game_state_without_action_cleanup(
    p_room_id, p_expected_revision, p_status, p_game_state, p_player_states
  );
  delete from public.wizard_actions action
  where action.room_id = p_room_id and action.expected_revision <= p_expected_revision;
  return v_next_revision;
end;
$$;

revoke all on function public.commit_wizard_game_state_without_action_cleanup(uuid, bigint, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.commit_wizard_game_state(uuid, bigint, text, jsonb, jsonb) from public, anon;
grant execute on function public.commit_wizard_game_state(uuid, bigint, text, jsonb, jsonb) to authenticated;

alter publication supabase_realtime add table public.wizard_actions;

commit;
