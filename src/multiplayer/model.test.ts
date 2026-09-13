import { describe, expect, it } from 'vitest';

import { createMatch } from '../game/state';
import type { GameAction } from '../game/types';
import {
  actionBelongsToSeat,
  botSeatsForHumanCount,
  normalizeRoomCode,
  playerStatePayloads,
  redactStateForSeat,
  seatPositionsFor,
  type RoomMember,
} from './model';

const members: readonly RoomMember[] = [
  { room_id: 'room-1', user_id: 'user-host', seat_id: 'human', display_name: 'Denzel', joined_at: 'now' },
  { room_id: 'room-1', user_id: 'user-two', seat_id: 'ember', display_name: 'Alex', joined_at: 'now' },
];

describe('online multiplayer model', () => {
  it('fills only the unused seats with computers', () => {
    expect(botSeatsForHumanCount(2)).toEqual(['rowan', 'mira']);
    expect(botSeatsForHumanCount(3)).toEqual(['mira']);
    expect(botSeatsForHumanCount(4)).toEqual([]);
  });

  it('normalizes room codes for sharing', () => {
    expect(normalizeRoomCode(' ab-12 c ')).toBe('AB12C');
  });

  it('rotates the table so the local player is always at the bottom', () => {
    expect(seatPositionsFor('ember')).toEqual({
      human: 'right',
      ember: 'bottom',
      rowan: 'left',
      mira: 'top',
    });
  });

  it('accepts player actions only from their assigned seat', () => {
    const action: GameAction = { type: 'PLACE_BID', playerId: 'ember', bid: 1 };
    expect(actionBelongsToSeat(action, 'ember')).toBe(true);
    expect(actionBelongsToSeat(action, 'human')).toBe(false);
    expect(actionBelongsToSeat({ type: 'ACKNOWLEDGE_ROUND' }, 'human')).toBe(true);
  });

  it('removes every hidden card except the receiving player hand', () => {
    const state = {
      ...createMatch(42),
      drawPile: [{ id: 'future', kind: 'wizard' as const }],
      hands: {
        human: [{ id: 'human-card', kind: 'wizard' as const }],
        ember: [{ id: 'ember-card', kind: 'jester' as const }],
        rowan: [{ id: 'rowan-card', kind: 'wizard' as const }],
        mira: [{ id: 'mira-card', kind: 'jester' as const }],
      },
    };

    const view = redactStateForSeat(state, 'ember', members);
    expect(view.drawPile).toEqual([]);
    expect(view.matchId).not.toBe(state.matchId);
    expect(view.matchId).not.toContain(state.rng.value.toString(16));
    expect(view.rng).toEqual({ value: 0 });
    expect(view.hands.ember).toEqual(state.hands.ember);
    expect(view.hands.human).toEqual([]);
    expect(view.hands.rowan).toEqual([]);
    expect(view.players.find(({ id }) => id === 'human')?.name).toBe('Denzel');
    expect(view.players.find(({ id }) => id === 'ember')?.name).toBe('Alex');
  });

  it('builds one private redacted state per room member', () => {
    const state = createMatch(42);
    const payloads = playerStatePayloads(state, members);
    expect(Object.keys(payloads)).toEqual(['user-host', 'user-two']);
    expect(payloads['user-two']?.hands.human).toEqual([]);
  });
});
