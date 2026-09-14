import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createMatch, legalActions, reduceGame } from '../game/state';
import type { OnlineBackend } from '../multiplayer/backend';
import type { RoomMember } from '../multiplayer/model';
import type { WizardRoom } from '../multiplayer/types';
import { useOnlineGame } from './useOnlineGame';

const room: WizardRoom = {
  id: 'room-1', room_code: 'ABC123', host_user_id: 'host', status: 'lobby',
  difficulty: 'easy', human_seat_count: 2, revision: 0,
  created_at: 'now', updated_at: 'now',
};
const members: RoomMember[] = [
  { room_id: 'room-1', user_id: 'host', seat_id: 'human', display_name: 'Denzel', joined_at: 'now' },
  { room_id: 'room-1', user_id: 'guest', seat_id: 'ember', display_name: 'Alex', joined_at: 'now' },
];

function backend(overrides: Partial<OnlineBackend> = {}): OnlineBackend {
  return {
    ensureUser: vi.fn().mockResolvedValue('host'),
    createRoom: vi.fn().mockResolvedValue({ roomId: 'room-1', roomCode: 'ABC123', seatId: 'human' }),
    joinRoom: vi.fn().mockResolvedValue({ roomId: 'room-1', roomCode: 'ABC123', seatId: 'ember' }),
    leaveRoom: vi.fn().mockResolvedValue(undefined),
    loadRoom: vi.fn().mockResolvedValue(room),
    loadMembers: vi.fn().mockResolvedValue(members),
    loadHostState: vi.fn().mockResolvedValue(null),
    loadPlayerState: vi.fn().mockResolvedValue(null),
    loadPendingActions: vi.fn().mockResolvedValue([]),
    hasBidLock: vi.fn().mockResolvedValue(false),
    commitState: vi.fn().mockResolvedValue(1),
    submitAction: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockReturnValue(() => undefined),
    ...overrides,
  };
}

describe('useOnlineGame', () => {
  it('ignores a membership refresh that finishes after leaving the room', async () => {
    let handlers: Parameters<OnlineBackend['subscribe']>[3] | undefined;
    let finishRefresh: ((value: RoomMember[]) => void) | undefined;
    const delayedMembers = new Promise<RoomMember[]>((resolve) => { finishRefresh = resolve; });
    const loadMembers = vi.fn().mockResolvedValueOnce(members).mockReturnValueOnce(delayedMembers);
    const onlineBackend = backend({
      loadMembers,
      subscribe: vi.fn((_roomId, _userId, _isHost, nextHandlers) => {
        handlers = nextHandlers;
        return () => undefined;
      }),
    });
    const { result } = renderHook(() => useOnlineGame({ backend: onlineBackend }));

    act(() => result.current.open());
    act(() => result.current.createRoom({ displayName: 'Denzel', difficulty: 'easy', humanSeatCount: 2 }));
    await waitFor(() => expect(result.current.status).toBe('lobby'));
    act(() => handlers?.onMembersChanged());
    act(() => result.current.leave());
    await act(async () => { finishRefresh?.(members); await delayedMembers; });

    expect(result.current.status).toBe('closed');
    expect(result.current.members).toEqual([]);
  });

  it('reconciles lobby membership after a realtime connection becomes active', async () => {
    let handlers: Parameters<OnlineBackend['subscribe']>[3] | undefined;
    const loadMembers = vi.fn()
      .mockResolvedValueOnce([members[0]])
      .mockResolvedValue(members);
    const onlineBackend = backend({
      loadMembers,
      loadRoom: vi.fn().mockResolvedValueOnce(room).mockResolvedValue({ ...room }),
      subscribe: vi.fn((_roomId, _userId, _isHost, nextHandlers) => {
        handlers = nextHandlers;
        return () => undefined;
      }),
    });
    const { result } = renderHook(() => useOnlineGame({ backend: onlineBackend }));

    act(() => result.current.open());
    act(() => result.current.createRoom({ displayName: 'Denzel', difficulty: 'easy', humanSeatCount: 2 }));
    await waitFor(() => expect(result.current.members).toHaveLength(1));
    expect(handlers).toBeDefined();

    act(() => handlers?.onConnection(true));

    await waitFor(() => expect(result.current.members).toHaveLength(2));
    expect(loadMembers).toHaveBeenCalledTimes(2);
    expect(onlineBackend.subscribe).toHaveBeenCalledTimes(1);
  });

  it('creates a room and commits a private state for every person when the host starts', async () => {
    const onlineBackend = backend();
    const { result } = renderHook(() => useOnlineGame({ backend: onlineBackend, seedFactory: () => 42 }));

    act(() => result.current.open());
    act(() => result.current.createRoom({ displayName: 'Denzel', difficulty: 'easy', humanSeatCount: 2 }));
    await waitFor(() => expect(result.current.status).toBe('lobby'));
    act(() => result.current.startGame());

    await waitFor(() => expect(onlineBackend.commitState).toHaveBeenCalled());
    const firstCommit = vi.mocked(onlineBackend.commitState).mock.calls[0];
    expect(firstCommit?.[0]).toBe('room-1');
    expect(firstCommit?.[1]).toBe(0);
    expect(Object.keys(firstCommit?.[3] ?? {})).toEqual(['host', 'guest']);
    expect(firstCommit?.[3].guest?.hands.human).toEqual([]);
    expect(result.current.localPlayerId).toBe('human');
  });

  it('ignores a host commit that finishes after leaving the room', async () => {
    let finishCommit: ((revision: number) => void) | undefined;
    const delayedCommit = new Promise<number>((resolve) => { finishCommit = resolve; });
    const onlineBackend = backend({ commitState: vi.fn().mockReturnValue(delayedCommit) });
    const { result } = renderHook(() => useOnlineGame({ backend: onlineBackend, seedFactory: () => 42 }));

    act(() => result.current.open());
    act(() => result.current.createRoom({ displayName: 'Denzel', difficulty: 'easy', humanSeatCount: 2 }));
    await waitFor(() => expect(result.current.status).toBe('lobby'));
    act(() => result.current.startGame());
    await waitFor(() => expect(onlineBackend.commitState).toHaveBeenCalledOnce());
    act(() => result.current.leave());
    await act(async () => { finishCommit?.(1); await delayedCommit; });

    expect(result.current.status).toBe('closed');
    expect(result.current.room).toBeNull();
    expect(result.current.state).toBeNull();
  });

  it('ignores a saved guest state that loads after leaving the room', async () => {
    let finishLoad: ((saved: { state: ReturnType<typeof createMatch>; revision: number }) => void) | undefined;
    const delayedLoad = new Promise<{ state: ReturnType<typeof createMatch>; revision: number }>((resolve) => {
      finishLoad = resolve;
    });
    const onlineBackend = backend({
      ensureUser: vi.fn().mockResolvedValue('guest'),
      loadRoom: vi.fn().mockResolvedValue({ ...room, status: 'playing', revision: 3 }),
      loadPlayerState: vi.fn().mockReturnValue(delayedLoad),
    });
    const { result } = renderHook(() => useOnlineGame({ backend: onlineBackend }));

    act(() => result.current.open());
    act(() => result.current.joinRoom({ displayName: 'Alex', roomCode: 'ABC123' }));
    await waitFor(() => expect(onlineBackend.loadPlayerState).toHaveBeenCalledOnce());
    act(() => result.current.leave());
    const saved = { state: createMatch(42), revision: 3 };
    await act(async () => { finishLoad?.(saved); await delayedLoad; });

    expect(result.current.status).toBe('closed');
    expect(result.current.room).toBeNull();
    expect(result.current.state).toBeNull();
  });

  it('submits a guest action for its own seat and current revision', async () => {
    const guestState = {
      ...createMatch(42), phase: 'bidding' as const, activePlayerId: 'ember' as const,
      hands: { human: [], ember: [], rowan: [], mira: [] },
    };
    const onlineBackend = backend({
      ensureUser: vi.fn().mockResolvedValue('guest'),
      loadRoom: vi.fn().mockResolvedValue({ ...room, status: 'playing', revision: 4 }),
      loadPlayerState: vi.fn().mockResolvedValue({ state: guestState, revision: 4 }),
    });
    const { result } = renderHook(() => useOnlineGame({ backend: onlineBackend }));

    act(() => result.current.open());
    act(() => result.current.joinRoom({ displayName: 'Alex', roomCode: 'ABC123' }));
    await waitFor(() => expect(result.current.status).toBe('game'));
    const action = legalActions(guestState).find((candidate) => candidate.type === 'PLACE_BID' && candidate.bid === 1);
    expect(action).toBeDefined();
    act(() => result.current.dispatch(action!));

    await waitFor(() => expect(onlineBackend.submitAction).toHaveBeenCalledWith('room-1', 4, action));
  });

  it('offers every simultaneous bid to an online player even when another seat is engine-active', async () => {
    const guestState = {
      ...createMatch(42), phase: 'bidding' as const, round: 3, activePlayerId: 'human' as const,
      hands: { human: [], ember: [], rowan: [], mira: [] },
    };
    const onlineBackend = backend({
      ensureUser: vi.fn().mockResolvedValue('guest'),
      loadRoom: vi.fn().mockResolvedValue({ ...room, status: 'playing', revision: 4 }),
      loadPlayerState: vi.fn().mockResolvedValue({ state: guestState, revision: 4 }),
    });
    const { result } = renderHook(() => useOnlineGame({ backend: onlineBackend }));

    act(() => result.current.open());
    act(() => result.current.joinRoom({ displayName: 'Alex', roomCode: 'ABC123' }));
    await waitFor(() => expect(result.current.status).toBe('game'));

    expect(result.current.legalActions).toEqual([
      { type: 'PLACE_BID', playerId: 'ember', bid: 0 },
      { type: 'PLACE_BID', playerId: 'ember', bid: 1 },
      { type: 'PLACE_BID', playerId: 'ember', bid: 2 },
      { type: 'PLACE_BID', playerId: 'ember', bid: 3 },
    ]);
  });

  it('locks a submitted online bid before the other players reveal theirs', async () => {
    const guestState = {
      ...createMatch(42), phase: 'bidding' as const, activePlayerId: 'human' as const,
      hands: { human: [], ember: [], rowan: [], mira: [] },
    };
    const submitAction = vi.fn().mockResolvedValue(undefined);
    const onlineBackend = backend({
      ensureUser: vi.fn().mockResolvedValue('guest'),
      loadRoom: vi.fn().mockResolvedValue({ ...room, status: 'playing', revision: 4 }),
      loadPlayerState: vi.fn().mockResolvedValue({ state: guestState, revision: 4 }),
      submitAction,
    });
    const { result } = renderHook(() => useOnlineGame({ backend: onlineBackend }));

    act(() => result.current.open());
    act(() => result.current.joinRoom({ displayName: 'Alex', roomCode: 'ABC123' }));
    await waitFor(() => expect(result.current.status).toBe('game'));
    act(() => result.current.dispatch({ type: 'PLACE_BID', playerId: 'ember', bid: 1 }));

    await waitFor(() => expect(result.current.bidLocked).toBe(true));
    expect(submitAction).toHaveBeenCalledWith('room-1', 4, {
      type: 'PLACE_BID', playerId: 'ember', bid: 1,
    });
    expect(result.current.legalActions).toEqual([]);
  });

  it('keeps a locked guest bid final when no newer state arrives', async () => {
    const guestState = {
      ...createMatch(42), phase: 'bidding' as const, activePlayerId: 'ember' as const,
      hands: { human: [], ember: [], rowan: [], mira: [] },
    };
    const submitAction = vi.fn().mockResolvedValue(undefined);
    const onlineBackend = backend({
      ensureUser: vi.fn().mockResolvedValue('guest'),
      loadRoom: vi.fn().mockResolvedValue({ ...room, status: 'playing', revision: 4 }),
      loadPlayerState: vi.fn().mockResolvedValue({ state: guestState, revision: 4 }),
      submitAction,
    });
    const { result } = renderHook(() => useOnlineGame({
      backend: onlineBackend,
      timings: { reconcileMs: 10 },
    }));

    act(() => result.current.open());
    act(() => result.current.joinRoom({ displayName: 'Alex', roomCode: 'ABC123' }));
    await waitFor(() => expect(result.current.status).toBe('game'));
    const action = legalActions(guestState).find((candidate) => candidate.type === 'PLACE_BID' && candidate.bid === 1)!;
    act(() => result.current.dispatch(action));
    await waitFor(() => expect(submitAction).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 30));
    act(() => result.current.dispatch(action));

    expect(submitAction).toHaveBeenCalledOnce();
    expect(result.current.bidLocked).toBe(true);
  });

  it('asks the backend to close an active room when the host leaves', async () => {
    const leaveRoom = vi.fn().mockResolvedValue(undefined);
    const onlineBackend = backend({ leaveRoom });
    const { result } = renderHook(() => useOnlineGame({ backend: onlineBackend, seedFactory: () => 42 }));

    act(() => result.current.open());
    act(() => result.current.createRoom({ displayName: 'Denzel', difficulty: 'easy', humanSeatCount: 2 }));
    await waitFor(() => expect(result.current.status).toBe('lobby'));
    act(() => result.current.startGame());
    await waitFor(() => expect(result.current.status).toBe('game'));

    act(() => result.current.leave());

    expect(leaveRoom).toHaveBeenCalledWith('room-1');
    expect(result.current.status).toBe('closed');
  });

  it('commits a complete sealed bid batch received by the host subscription', async () => {
    let handlers: Parameters<OnlineBackend['subscribe']>[3] | undefined;
    let revision = 0;
    const commitState = vi.fn().mockImplementation(async () => ++revision);
    const onlineBackend = backend({
      commitState,
      subscribe: vi.fn((_roomId, _userId, _isHost, nextHandlers) => {
        handlers = nextHandlers;
        return () => undefined;
      }),
    });
    const guestFirstSeed = Array.from({ length: 1_000 }, (_, seed) => seed + 1).find((seed) => {
      const dealt = reduceGame(createMatch(seed), { type: 'DEAL_ROUND' });
      return dealt.phase === 'bidding' && dealt.activePlayerId === 'ember';
    });
    expect(guestFirstSeed).toBeDefined();
    const { result } = renderHook(() => useOnlineGame({
      backend: onlineBackend,
      seedFactory: () => guestFirstSeed!,
      timings: { decisionMs: 60_000 },
    }));

    act(() => result.current.open());
    act(() => result.current.createRoom({ displayName: 'Denzel', difficulty: 'easy', humanSeatCount: 2 }));
    await waitFor(() => expect(result.current.status).toBe('lobby'));
    act(() => result.current.startGame());
    await waitFor(() => expect(commitState).toHaveBeenCalledTimes(2));
    const dealt = commitState.mock.calls[1]?.[2];
    expect(dealt.activePlayerId).toBe('ember');

    vi.mocked(onlineBackend.loadPendingActions).mockResolvedValue([
      { action: { type: 'PLACE_BID', playerId: 'human', bid: 1 }, expectedRevision: 2 },
      { action: { type: 'PLACE_BID', playerId: 'ember', bid: 0 }, expectedRevision: 2 },
    ]);
    act(() => handlers?.onAction({ type: 'PLACE_BID', playerId: 'ember', bid: 0 }, 2));

    await waitFor(() => expect(commitState).toHaveBeenCalledTimes(3));
    expect(commitState.mock.calls[2]?.[2].phase).toBe('playing');
    expect(commitState.mock.calls[2]?.[2].bids).toEqual(expect.arrayContaining([
      { playerId: 'human', bid: 1 },
      { playerId: 'ember', bid: 0 },
    ]));
  });

  it('skips malformed queued actions when reconciling a host connection', async () => {
    let handlers: Parameters<OnlineBackend['subscribe']>[3] | undefined;
    let revision = 0;
    const commitState = vi.fn().mockImplementation(async () => ++revision);
    const onlineBackend = backend({
      commitState,
      subscribe: vi.fn((_roomId, _userId, _isHost, nextHandlers) => {
        handlers = nextHandlers;
        return () => undefined;
      }),
    });
    const guestFirstSeed = Array.from({ length: 1_000 }, (_, seed) => seed + 1).find((seed) => {
      const dealt = reduceGame(createMatch(seed), { type: 'DEAL_ROUND' });
      return dealt.phase === 'bidding' && dealt.activePlayerId === 'ember';
    })!;
    const { result } = renderHook(() => useOnlineGame({
      backend: onlineBackend,
      seedFactory: () => guestFirstSeed,
      timings: { decisionMs: 60_000 },
    }));

    act(() => result.current.open());
    act(() => result.current.createRoom({ displayName: 'Denzel', difficulty: 'easy', humanSeatCount: 2 }));
    await waitFor(() => expect(result.current.status).toBe('lobby'));
    act(() => result.current.startGame());
    await waitFor(() => expect(commitState).toHaveBeenCalledTimes(2));
    const dealt = commitState.mock.calls[1]?.[2];
    vi.mocked(onlineBackend.loadRoom).mockResolvedValue({ ...room, status: 'playing', revision: 2 });
    vi.mocked(onlineBackend.loadHostState).mockResolvedValue({ state: dealt, revision: 2 });
    vi.mocked(onlineBackend.loadPendingActions).mockResolvedValue([
      { action: {} as never, expectedRevision: 2 },
      { action: { type: 'PLACE_BID', playerId: 'human', bid: 1 }, expectedRevision: 2 },
      { action: { type: 'PLACE_BID', playerId: 'ember', bid: 0 }, expectedRevision: 2 },
    ]);

    act(() => handlers?.onConnection(true));

    await waitFor(() => expect(commitState).toHaveBeenCalledTimes(3));
    expect(commitState.mock.calls[2]?.[2].phase).toBe('playing');
    expect(commitState.mock.calls[2]?.[2].bids).toContainEqual({ playerId: 'ember', bid: 0 });
  });
});
