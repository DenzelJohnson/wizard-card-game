begin;

-- Let a member replace an action rejected by the host-side game engine. Realtime
-- publishes both INSERT and UPDATE events, so the corrected action is delivered.
create or replace function public.submit_wizard_action(
  p_room_id uuid,
  p_expected_revision bigint,
  p_action jsonb
)
returns bigint
language plpgsql
security definer
set search_path = 'private'
as $$
declare
  v_user_id uuid := auth.uid();
  v_seat_id text;
  v_action_type text;
  v_phase text;
  v_active_player_id text;
  v_round integer;
  v_action_id bigint;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_action is null or jsonb_typeof(p_action) <> 'object' or pg_column_size(p_action) > 512 then
    raise exception 'Invalid player action';
  end if;

  v_action_type := p_action ->> 'type';
  if v_action_type is null or v_action_type not in ('CHOOSE_TRUMP', 'PLACE_BID', 'PLAY_CARD', 'ACKNOWLEDGE_ROUND') then
    raise exception 'Invalid player action';
  end if;

  select member.seat_id,
         state.game_state ->> 'phase',
         state.game_state ->> 'activePlayerId',
         (state.game_state ->> 'round')::integer
    into v_seat_id, v_phase, v_active_player_id, v_round
  from public.wizard_room_members member
  join public.wizard_rooms room on room.id = member.room_id
  join public.wizard_game_states state on state.room_id = room.id and state.revision = room.revision
  where member.room_id = p_room_id
    and member.user_id = v_user_id
    and room.status = 'playing'
    and room.revision = p_expected_revision;
  if not found then raise exception 'Room changed or membership is invalid'; end if;

  if v_action_type = 'ACKNOWLEDGE_ROUND' then
    if v_phase <> 'round-result' or jsonb_object_length(p_action) <> 1 then
      raise exception 'Invalid player action';
    end if;
  elsif p_action ->> 'playerId' is distinct from v_seat_id or v_active_player_id is distinct from v_seat_id then
    raise exception 'Action does not belong to the active seat';
  elsif v_action_type = 'CHOOSE_TRUMP' then
    if v_phase <> 'choose-trump'
      or jsonb_object_length(p_action) <> 3
      or not (p_action ?& array['type', 'playerId', 'suit'])
      or p_action ->> 'suit' is null
      or p_action ->> 'suit' not in ('clubs', 'diamonds', 'hearts', 'spades') then
      raise exception 'Invalid player action';
    end if;
  elsif v_action_type = 'PLACE_BID' then
    if v_phase <> 'bidding'
      or jsonb_object_length(p_action) <> 3
      or not (p_action ?& array['type', 'playerId', 'bid'])
      or jsonb_typeof(p_action -> 'bid') <> 'number'
      or p_action ->> 'bid' is null
      or not ((p_action ->> 'bid') ~ '^[0-9]+$')
      or (p_action ->> 'bid')::integer not between 0 and v_round then
      raise exception 'Invalid player action';
    end if;
  elsif v_action_type = 'PLAY_CARD' then
    if v_phase <> 'playing'
      or jsonb_object_length(p_action) <> 3
      or not (p_action ?& array['type', 'playerId', 'cardId'])
      or jsonb_typeof(p_action -> 'cardId') <> 'string'
      or p_action ->> 'cardId' is null
      or not ((p_action ->> 'cardId') ~ '^(clubs|diamonds|hearts|spades)-(2|3|4|5|6|7|8|9|10|11|12|13|14)$|^(wizard|jester)-[1-4]$') then
      raise exception 'Invalid player action';
    end if;
  end if;

  insert into public.wizard_actions (room_id, user_id, expected_revision, action)
  values (p_room_id, v_user_id, p_expected_revision, p_action)
  on conflict (room_id, user_id, expected_revision)
  do update set action = excluded.action, created_at = now()
  returning id into v_action_id;
  return v_action_id;
end;
$$;

revoke all on function public.submit_wizard_action(uuid, bigint, jsonb) from public, anon;
grant execute on function public.submit_wizard_action(uuid, bigint, jsonb) to authenticated;

commit;
