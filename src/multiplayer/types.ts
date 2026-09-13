import type { Difficulty, GameAction, GameState, PlayerId } from '../game/types';
import type { RoomMember } from './model';

export type RoomStatus = 'lobby' | 'playing' | 'finished';

export interface WizardRoom {
  readonly id: string;
  readonly room_code: string;
  readonly host_user_id: string;
  readonly status: RoomStatus;
  readonly difficulty: Difficulty;
  readonly human_seat_count: number;
  readonly revision: number;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface JoinedRoom {
  readonly roomId: string;
  readonly roomCode: string;
  readonly seatId: PlayerId;
}

export interface CreateRoomInput {
  readonly displayName: string;
  readonly difficulty: Difficulty;
  readonly humanSeatCount: number;
}

export interface JoinRoomInput {
  readonly displayName: string;
  readonly roomCode: string;
}

export interface OnlineGameController {
  readonly status: 'closed' | 'entry' | 'lobby' | 'game';
  readonly loading: boolean;
  readonly error: string | null;
  readonly room: WizardRoom | null;
  readonly members: readonly RoomMember[];
  readonly userId: string | null;
  readonly localPlayerId: PlayerId | null;
  readonly state: GameState | null;
  readonly legalActions: readonly GameAction[];
  open(): void;
  leave(): void;
  createRoom(input: CreateRoomInput): void;
  joinRoom(input: JoinRoomInput): void;
  startGame(): void;
  dispatch(action: GameAction): void;
  acknowledgeRound(): void;
}
