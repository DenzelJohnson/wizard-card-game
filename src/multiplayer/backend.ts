import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

import type { GameAction, GameState } from '../game/types';
import type { RoomMember } from './model';
import { supabase } from './supabase';
import type { CreateRoomInput, JoinedRoom, JoinRoomInput, WizardRoom } from './types';

interface SubscriptionHandlers {
  readonly onRoomChanged: () => void;
  readonly onMembersChanged: () => void;
  readonly onPlayerState: (state: GameState, revision: number) => void;
  readonly onAction: (action: GameAction, expectedRevision: number) => void;
  readonly onConnection: (connected: boolean) => void;
}

export interface OnlineBackend {
  ensureUser(): Promise<string>;
  createRoom(input: CreateRoomInput): Promise<JoinedRoom>;
  joinRoom(input: JoinRoomInput): Promise<JoinedRoom>;
  leaveRoom(roomId: string): Promise<void>;
  loadRoom(roomId: string): Promise<WizardRoom>;
  loadMembers(roomId: string): Promise<RoomMember[]>;
  loadHostState(roomId: string): Promise<{ readonly state: GameState; readonly revision: number } | null>;
  loadPlayerState(roomId: string, userId: string): Promise<{ readonly state: GameState; readonly revision: number } | null>;
  loadPendingActions(roomId: string, revision: number): Promise<Array<{ readonly action: GameAction; readonly expectedRevision: number }>>;
  commitState(roomId: string, expectedRevision: number, state: GameState, playerStates: Readonly<Record<string, GameState>>): Promise<number>;
  submitAction(roomId: string, expectedRevision: number, action: GameAction): Promise<void>;
  subscribe(roomId: string, userId: string, isHost: boolean, handlers: SubscriptionHandlers): () => void;
}

export function createSupabaseBackend(client: SupabaseClient = supabase): OnlineBackend {
  const ensureUser = async (): Promise<string> => {
    const current = await client.auth.getSession();
    if (current.error !== null) throw current.error;
    if (current.data.session?.user.id !== undefined) return current.data.session.user.id;
    const created = await client.auth.signInAnonymously();
    if (created.error !== null) throw created.error;
    if (created.data.user?.id === undefined) throw new Error('Could not create a player identity.');
    return created.data.user.id;
  };

  const roomRpc = async (name: 'create_wizard_room' | 'join_wizard_room', args: Record<string, unknown>): Promise<JoinedRoom> => {
    await ensureUser();
    const result = await client.rpc(name, args);
    if (result.error !== null) throw result.error;
    const row = Array.isArray(result.data) ? result.data[0] : null;
    if (!isJoinedRoomRow(row)) throw new Error('Supabase returned an invalid room.');
    return { roomId: row.room_id, roomCode: row.room_code, seatId: row.seat_id };
  };

  return {
    ensureUser,
    createRoom: (input) => roomRpc('create_wizard_room', {
      p_display_name: input.displayName,
      p_difficulty: input.difficulty,
      p_human_seat_count: input.humanSeatCount,
    }),
    joinRoom: (input) => roomRpc('join_wizard_room', {
      p_room_code: input.roomCode,
      p_display_name: input.displayName,
    }),
    async leaveRoom(roomId) {
      const result = await client.rpc('leave_wizard_room', { p_room_id: roomId });
      if (result.error !== null) throw result.error;
    },
    async loadRoom(roomId) {
      const result = await client.from('wizard_rooms').select('*').eq('id', roomId).single();
      if (result.error !== null) throw result.error;
      return result.data as WizardRoom;
    },
    async loadMembers(roomId) {
      const result = await client.from('wizard_room_members').select('*').eq('room_id', roomId).order('joined_at');
      if (result.error !== null) throw result.error;
      return result.data as RoomMember[];
    },
    async loadHostState(roomId) {
      const result = await client.from('wizard_game_states').select('game_state,revision').eq('room_id', roomId).maybeSingle();
      if (result.error !== null) throw result.error;
      return result.data === null ? null : { state: result.data.game_state as GameState, revision: Number(result.data.revision) };
    },
    async loadPlayerState(roomId, userId) {
      const result = await client.from('wizard_player_states').select('game_state,revision').eq('room_id', roomId).eq('user_id', userId).maybeSingle();
      if (result.error !== null) throw result.error;
      return result.data === null ? null : { state: result.data.game_state as GameState, revision: Number(result.data.revision) };
    },
    async loadPendingActions(roomId, revision) {
      const result = await client.from('wizard_actions').select('action,expected_revision').eq('room_id', roomId).eq('expected_revision', revision).order('id');
      if (result.error !== null) throw result.error;
      return (result.data ?? []).map((row) => ({ action: row.action as GameAction, expectedRevision: Number(row.expected_revision) }));
    },
    async commitState(roomId, expectedRevision, state, playerStates) {
      const result = await client.rpc('commit_wizard_game_state', {
        p_room_id: roomId,
        p_expected_revision: expectedRevision,
        p_status: state.phase === 'match-result' ? 'finished' : 'playing',
        p_game_state: state,
        p_player_states: playerStates,
      });
      if (result.error !== null) throw result.error;
      const revision = Number(result.data);
      if (!Number.isSafeInteger(revision)) throw new Error('Supabase returned an invalid game revision.');
      return revision;
    },
    async submitAction(roomId, expectedRevision, action) {
      const result = await client.rpc('submit_wizard_action', {
        p_room_id: roomId,
        p_expected_revision: expectedRevision,
        p_action: action,
      });
      if (result.error !== null) throw result.error;
    },
    subscribe(roomId, userId, isHost, handlers) {
      const channel = client.channel(`room:${roomId}`, { config: { private: true } });
      channel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'wizard_rooms', filter: `id=eq.${roomId}` }, handlers.onRoomChanged)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'wizard_room_members', filter: `room_id=eq.${roomId}` }, handlers.onMembersChanged)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'wizard_player_states', filter: `room_id=eq.${roomId}` }, (payload) => {
          const row = payload.new as { room_id?: string; user_id?: string; game_state?: GameState; revision?: number };
          if (
            row.room_id === roomId && row.user_id === userId &&
            row.game_state !== undefined && row.revision !== undefined
          ) {
            handlers.onPlayerState(row.game_state, Number(row.revision));
          }
        });
      if (isHost) {
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'wizard_actions', filter: `room_id=eq.${roomId}` }, (payload) => {
          const row = payload.new as { action?: GameAction; expected_revision?: number };
          if (row.action !== undefined && row.expected_revision !== undefined) handlers.onAction(row.action, Number(row.expected_revision));
        });
      }
      channel.subscribe((status) => handlers.onConnection(status === 'SUBSCRIBED'));
      return () => { void removeChannel(client, channel); };
    },
  };
}

async function removeChannel(client: SupabaseClient, channel: RealtimeChannel): Promise<void> {
  await client.removeChannel(channel);
}

function isJoinedRoomRow(value: unknown): value is { room_id: string; room_code: string; seat_id: JoinedRoom['seatId'] } {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return typeof row.room_id === 'string' && typeof row.room_code === 'string' &&
    ['human', 'ember', 'rowan', 'mira'].includes(String(row.seat_id));
}

export function multiplayerErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message :
    typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : '';
  if (/room not found/i.test(message)) return 'That room code was not found.';
  if (/room is full/i.test(message)) return 'That room is already full.';
  if (/already started/i.test(message)) return 'That game has already started.';
  if (/rate limit/i.test(message)) return 'Too many connection attempts. Please wait a moment.';
  return 'The online table could not be reached. Please try again.';
}
