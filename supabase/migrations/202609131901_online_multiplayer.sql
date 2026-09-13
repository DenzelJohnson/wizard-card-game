create schema if not exists private;

create table public.wizard_rooms (
  id uuid primary key default gen_random_uuid(),
  room_code text not null unique check (room_code ~ '^[A-Z0-9]{6}$'),
  host_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'finished')),
  difficulty text not null check (difficulty in ('easy', 'medium')),
  human_seat_count smallint not null check (human_seat_count between 2 and 4),
  revision bigint not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.wizard_room_members (
  room_id uuid not null references public.wizard_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  seat_id text not null check (seat_id in ('human', 'ember', 'rowan', 'mira')),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 20),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id),
  unique (room_id, seat_id)
);

create table public.wizard_game_states (
  room_id uuid primary key references public.wizard_rooms(id) on delete cascade,
  game_state jsonb not null,
  revision bigint not null check (revision > 0),
  updated_at timestamptz not null default now()
);

create table public.wizard_player_states (
  room_id uuid not null references public.wizard_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  game_state jsonb not null,
  revision bigint not null check (revision > 0),
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index wizard_rooms_host_user_id_idx on public.wizard_rooms (host_user_id);
create index wizard_room_members_user_id_idx on public.wizard_room_members (user_id);
create index wizard_player_states_user_id_idx on public.wizard_player_states (user_id);

alter table public.wizard_rooms enable row level security;
alter table public.wizard_room_members enable row level security;
alter table public.wizard_game_states enable row level security;
alter table public.wizard_player_states enable row level security;

create or replace function private.is_wizard_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.wizard_room_members member
    where member.room_id = p_room_id
      and member.user_id = (select auth.uid())
  );
$$;

create or replace function private.is_wizard_room_host(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.wizard_rooms room
    where room.id = p_room_id
      and room.host_user_id = (select auth.uid())
  );
$$;

create or replace function private.is_wizard_room_topic_member(p_topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_topic ~ '^room:[0-9a-f-]{36}$'
      then private.is_wizard_room_member(substring(p_topic from 6)::uuid)
    else false
  end;
$$;

revoke all on function private.is_wizard_room_member(uuid) from public, anon, authenticated;
revoke all on function private.is_wizard_room_host(uuid) from public, anon, authenticated;
revoke all on function private.is_wizard_room_topic_member(text) from public, anon, authenticated;

create policy wizard_rooms_member_select
on public.wizard_rooms for select to authenticated
using ((select private.is_wizard_room_member(id)));

create policy wizard_room_members_member_select
on public.wizard_room_members for select to authenticated
using ((select private.is_wizard_room_member(room_id)));

create policy wizard_game_states_host_select
on public.wizard_game_states for select to authenticated
using ((select private.is_wizard_room_host(room_id)));

create policy wizard_player_states_owner_select
on public.wizard_player_states for select to authenticated
using (user_id = (select auth.uid()) and (select private.is_wizard_room_member(room_id)));

create policy wizard_room_messages_select
on realtime.messages for select to authenticated
using ((select private.is_wizard_room_topic_member(realtime.topic())));

create policy wizard_room_messages_insert
on realtime.messages for insert to authenticated
with check ((select private.is_wizard_room_topic_member(realtime.topic())));

revoke all on public.wizard_rooms from anon, authenticated;
revoke all on public.wizard_room_members from anon, authenticated;
revoke all on public.wizard_game_states from anon, authenticated;
revoke all on public.wizard_player_states from anon, authenticated;
grant select on public.wizard_rooms to authenticated;
grant select on public.wizard_room_members to authenticated;
grant select on public.wizard_game_states to authenticated;
grant select on public.wizard_player_states to authenticated;

create or replace function public.create_wizard_room(
  p_display_name text,
  p_difficulty text,
  p_human_seat_count integer
)
returns table (room_id uuid, room_code text, seat_id text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room_id uuid;
  v_room_code text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if char_length(btrim(p_display_name)) not between 1 and 20 then raise exception 'Display name must be 1 to 20 characters'; end if;
  if p_difficulty not in ('easy', 'medium') then raise exception 'Invalid difficulty'; end if;
  if p_human_seat_count not between 2 and 4 then raise exception 'Human seat count must be 2 to 4'; end if;

  loop
    v_room_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    begin
      insert into public.wizard_rooms (room_code, host_user_id, difficulty, human_seat_count)
      values (v_room_code, v_user_id, p_difficulty, p_human_seat_count)
      returning id into v_room_id;
      exit;
    exception when unique_violation then
      null;
    end;
  end loop;

  insert into public.wizard_room_members (room_id, user_id, seat_id, display_name)
  values (v_room_id, v_user_id, 'human', btrim(p_display_name));

  return query select v_room_id, v_room_code, 'human'::text;
end;
$$;

create or replace function public.join_wizard_room(p_room_code text, p_display_name text)
returns table (room_id uuid, room_code text, seat_id text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room public.wizard_rooms%rowtype;
  v_existing_seat text;
  v_seat text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if char_length(btrim(p_display_name)) not between 1 and 20 then raise exception 'Display name must be 1 to 20 characters'; end if;

  select room.* into v_room
  from public.wizard_rooms room
  where room.room_code = upper(btrim(p_room_code))
  for update;

  if not found then raise exception 'Room not found'; end if;

  select member.seat_id into v_existing_seat
  from public.wizard_room_members member
  where member.room_id = v_room.id and member.user_id = v_user_id;
  if found then return query select v_room.id, v_room.room_code, v_existing_seat; return; end if;

  if v_room.status <> 'lobby' then raise exception 'Game already started'; end if;
  if (select count(*) from public.wizard_room_members member where member.room_id = v_room.id) >= v_room.human_seat_count then
    raise exception 'Room is full';
  end if;

  select candidate.seat into v_seat
  from unnest(array['ember', 'rowan', 'mira']) with ordinality as candidate(seat, position)
  where not exists (
    select 1 from public.wizard_room_members member
    where member.room_id = v_room.id and member.seat_id = candidate.seat
  )
  order by candidate.position
  limit 1;

  if v_seat is null then raise exception 'Room is full'; end if;
  insert into public.wizard_room_members (room_id, user_id, seat_id, display_name)
  values (v_room.id, v_user_id, v_seat, btrim(p_display_name));
  return query select v_room.id, v_room.room_code, v_seat;
end;
$$;

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
  if v_status <> 'lobby' then raise exception 'An active game cannot be left'; end if;
  if v_host_user_id = v_user_id then
    delete from public.wizard_rooms room where room.id = p_room_id;
  else
    delete from public.wizard_room_members member
    where member.room_id = p_room_id and member.user_id = v_user_id;
  end if;
end;
$$;

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
  v_user_id uuid := auth.uid();
  v_next_revision bigint;
  v_member record;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_status not in ('playing', 'finished') then raise exception 'Invalid game status'; end if;
  if p_game_state is null or jsonb_typeof(p_game_state) <> 'object' then raise exception 'Invalid game state'; end if;
  if p_player_states is null or jsonb_typeof(p_player_states) <> 'object' then raise exception 'Invalid player states'; end if;

  update public.wizard_rooms room
  set status = p_status, revision = room.revision + 1, updated_at = now()
  where room.id = p_room_id
    and room.host_user_id = v_user_id
    and room.revision = p_expected_revision
    and (
      room.status = 'playing'
      or (
        room.status = 'lobby'
        and (select count(*) from public.wizard_room_members member where member.room_id = room.id) = room.human_seat_count
      )
    )
  returning room.revision into v_next_revision;

  if v_next_revision is null then raise exception 'Room changed or is not ready'; end if;

  insert into public.wizard_game_states (room_id, game_state, revision, updated_at)
  values (p_room_id, p_game_state, v_next_revision, now())
  on conflict (room_id) do update
  set game_state = excluded.game_state, revision = excluded.revision, updated_at = excluded.updated_at;

  for v_member in
    select member.user_id from public.wizard_room_members member where member.room_id = p_room_id
  loop
    if not (p_player_states ? v_member.user_id::text) then raise exception 'Missing player state'; end if;
    insert into public.wizard_player_states (room_id, user_id, game_state, revision, updated_at)
    values (p_room_id, v_member.user_id, p_player_states -> v_member.user_id::text, v_next_revision, now())
    on conflict (room_id, user_id) do update
    set game_state = excluded.game_state, revision = excluded.revision, updated_at = excluded.updated_at;
  end loop;

  return v_next_revision;
end;
$$;

revoke all on function public.create_wizard_room(text, text, integer) from public, anon;
revoke all on function public.join_wizard_room(text, text) from public, anon;
revoke all on function public.leave_wizard_room(uuid) from public, anon;
revoke all on function public.commit_wizard_game_state(uuid, bigint, text, jsonb, jsonb) from public, anon;
grant execute on function public.create_wizard_room(text, text, integer) to authenticated;
grant execute on function public.join_wizard_room(text, text) to authenticated;
grant execute on function public.leave_wizard_room(uuid) to authenticated;
grant execute on function public.commit_wizard_game_state(uuid, bigint, text, jsonb, jsonb) to authenticated;

alter publication supabase_realtime add table public.wizard_rooms;
alter publication supabase_realtime add table public.wizard_room_members;
alter publication supabase_realtime add table public.wizard_player_states;
