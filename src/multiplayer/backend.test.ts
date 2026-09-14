import { describe, expect, it, vi } from 'vitest';

import { createSupabaseBackend } from './backend';

function fakeClient(rpcResult: unknown = [{ room_id: 'room-1', room_code: 'ABC123', seat_id: 'human' }]) {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signInAnonymously: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
    },
    rpc: vi.fn().mockResolvedValue({ data: rpcResult, error: null }),
  };
}

describe('Supabase online backend', () => {
  it('creates an anonymous identity only when the browser has no session', async () => {
    const client = fakeClient();
    const backend = createSupabaseBackend(client as never);
    await expect(backend.ensureUser()).resolves.toBe('user-1');
    expect(client.auth.signInAnonymously).toHaveBeenCalledOnce();

    client.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'existing-user' } } },
      error: null,
    } as never);
    await expect(backend.ensureUser()).resolves.toBe('existing-user');
    expect(client.auth.signInAnonymously).toHaveBeenCalledOnce();
  });

  it('maps room creation to the secured RPC', async () => {
    const client = fakeClient();
    const backend = createSupabaseBackend(client as never);
    await expect(backend.createRoom({
      displayName: 'Denzel', difficulty: 'medium', humanSeatCount: 3,
    })).resolves.toEqual({ roomId: 'room-1', roomCode: 'ABC123', seatId: 'human' });
    expect(client.rpc).toHaveBeenCalledWith('create_wizard_room', {
      p_display_name: 'Denzel',
      p_difficulty: 'medium',
      p_human_seat_count: 3,
    });
  });

  it('submits a player action with the state revision', async () => {
    const client = fakeClient(77);
    const backend = createSupabaseBackend(client as never);
    await expect(backend.submitAction('room-1', 4, {
      type: 'PLACE_BID', playerId: 'ember', bid: 2,
    })).resolves.toBeUndefined();
    expect(client.rpc).toHaveBeenCalledWith('submit_wizard_action', {
      p_room_id: 'room-1',
      p_expected_revision: 4,
      p_action: { type: 'PLACE_BID', playerId: 'ember', bid: 2 },
    });
  });

  it('asks only whether the current player has locked a bid for this revision', async () => {
    const client = fakeClient(true);
    const backend = createSupabaseBackend(client as never);

    await expect(backend.hasBidLock('room-1', 4)).resolves.toBe(true);
    expect(client.rpc).toHaveBeenCalledWith('has_wizard_bid_lock', {
      p_room_id: 'room-1',
      p_expected_revision: 4,
    });
  });

  it('accepts player-state updates only for the subscribed room and user', () => {
    type Registration = {
      readonly event: string;
      readonly filter: { readonly table?: string; readonly filter?: string };
      readonly callback: (payload: { readonly new: Record<string, unknown> }) => void;
    };
    const registrations: Registration[] = [];
    const channel = {
      on: vi.fn((_event: string, filter: Registration['filter'], callback: Registration['callback']) => {
        registrations.push({ event: _event, filter, callback });
        return channel;
      }),
      subscribe: vi.fn().mockReturnValue(undefined),
    };
    const client = {
      ...fakeClient(),
      channel: vi.fn().mockReturnValue(channel),
      removeChannel: vi.fn().mockResolvedValue(undefined),
    };
    const backend = createSupabaseBackend(client as never);
    const onPlayerState = vi.fn();

    backend.subscribe('room-1', 'user-1', false, {
      onRoomChanged: vi.fn(),
      onMembersChanged: vi.fn(),
      onPlayerState,
      onAction: vi.fn(),
      onConnection: vi.fn(),
    });

    const registration = registrations.find(({ filter }) => filter.table === 'wizard_player_states');
    expect(registration?.filter.filter).toBe('room_id=eq.room-1');
    registration?.callback({
      new: { room_id: 'room-2', user_id: 'user-1', game_state: { phase: 'playing' }, revision: 7 },
    });
    registration?.callback({
      new: { room_id: 'room-1', user_id: 'another-user', game_state: { phase: 'playing' }, revision: 7 },
    });
    expect(onPlayerState).not.toHaveBeenCalled();

    const state = { phase: 'bidding' };
    registration?.callback({
      new: { room_id: 'room-1', user_id: 'user-1', game_state: state, revision: 8 },
    });
    expect(onPlayerState).toHaveBeenCalledWith(state, 8);
  });

  it('listens for inserted and replaced host action rows', () => {
    const registrations: Array<{ event: string; table?: string }> = [];
    const channel = {
      on: vi.fn((_binding: string, filter: { event?: string; table?: string }) => {
        registrations.push({ event: filter.event ?? '', table: filter.table });
        return channel;
      }),
      subscribe: vi.fn().mockReturnValue(undefined),
    };
    const client = {
      ...fakeClient(),
      channel: vi.fn().mockReturnValue(channel),
      removeChannel: vi.fn().mockResolvedValue(undefined),
    };
    const onlineBackend = createSupabaseBackend(client as never);

    onlineBackend.subscribe('room-1', 'host', true, {
      onRoomChanged: vi.fn(), onMembersChanged: vi.fn(), onPlayerState: vi.fn(),
      onAction: vi.fn(), onConnection: vi.fn(),
    });

    expect(registrations).toContainEqual({ event: '*', table: 'wizard_actions' });
  });
});
