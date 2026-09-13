import { PLAYERS, PLAYER_IDS, type GameAction, type GameState, type PlayerId } from '../game/types';

export interface RoomMember {
  readonly room_id: string;
  readonly user_id: string;
  readonly seat_id: PlayerId;
  readonly display_name: string;
  readonly joined_at: string;
}

export type SeatPosition = 'bottom' | 'left' | 'top' | 'right';

const POSITION_ORDER: readonly SeatPosition[] = ['bottom', 'left', 'top', 'right'];

export function botSeatsForHumanCount(humanSeatCount: number): PlayerId[] {
  const boundedCount = Math.max(2, Math.min(4, Math.trunc(humanSeatCount)));
  return PLAYER_IDS.slice(boundedCount);
}

export function normalizeRoomCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

export function seatPositionsFor(localPlayerId: PlayerId): Readonly<Record<PlayerId, SeatPosition>> {
  const offset = PLAYER_IDS.indexOf(localPlayerId);
  return Object.fromEntries(
    PLAYER_IDS.map((playerId, index) => [
      playerId,
      POSITION_ORDER[(index - offset + PLAYER_IDS.length) % PLAYER_IDS.length],
    ]),
  ) as Readonly<Record<PlayerId, SeatPosition>>;
}

export function actionBelongsToSeat(action: GameAction, seatId: PlayerId): boolean {
  switch (action.type) {
    case 'CHOOSE_TRUMP':
    case 'PLACE_BID':
    case 'PLAY_CARD':
      return action.playerId === seatId;
    case 'DEAL_ROUND':
    case 'ACKNOWLEDGE_TRICK':
    case 'ACKNOWLEDGE_ROUND':
      return true;
  }
}

export function redactStateForSeat(
  state: GameState,
  seatId: PlayerId,
  members: readonly RoomMember[],
): GameState {
  const namedState = stateWithRoomMembers(state, members);

  return {
    ...namedState,
    matchId: `online-${members[0]?.room_id ?? 'room'}`,
    rng: { value: 0 },
    drawPile: [],
    hands: {
      human: seatId === 'human' ? state.hands.human : [],
      ember: seatId === 'ember' ? state.hands.ember : [],
      rowan: seatId === 'rowan' ? state.hands.rowan : [],
      mira: seatId === 'mira' ? state.hands.mira : [],
    },
  };
}

export function stateWithRoomMembers(
  state: GameState,
  members: readonly RoomMember[],
): GameState {
  const names = new Map(members.map((member) => [member.seat_id, member.display_name]));

  return {
    ...state,
    players: PLAYERS.map((player) => ({
      ...player,
      name: names.get(player.id) ?? player.name,
      isHuman: names.has(player.id),
    })),
  };
}

export function playerStatePayloads(
  state: GameState,
  members: readonly RoomMember[],
): Readonly<Record<string, GameState>> {
  return Object.fromEntries(
    members.map((member) => [
      member.user_id,
      redactStateForSeat(state, member.seat_id, members),
    ]),
  );
}
