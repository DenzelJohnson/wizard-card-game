export const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'] as const;

export type Suit = (typeof SUITS)[number];
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export type Card =
  | { id: string; kind: 'suited'; suit: Suit; rank: Rank }
  | { id: string; kind: 'wizard' }
  | { id: string; kind: 'jester' };

export interface RngState {
  readonly value: number;
}

export const PLAYER_IDS = Object.freeze(['human', 'ember', 'rowan', 'mira'] as const);

export type PlayerId = (typeof PLAYER_IDS)[number];

export interface PlayerMetadata {
  readonly id: PlayerId;
  readonly name: string;
  readonly isHuman: boolean;
}

export const PLAYERS: readonly PlayerMetadata[] = Object.freeze([
  Object.freeze({ id: 'human', name: 'You', isHuman: true }),
  Object.freeze({ id: 'ember', name: 'Ember', isHuman: false }),
  Object.freeze({ id: 'rowan', name: 'Rowan', isHuman: false }),
  Object.freeze({ id: 'mira', name: 'Mira', isHuman: false }),
]);

export type GamePhase =
  | 'round-setup'
  | 'choose-trump'
  | 'bidding'
  | 'playing'
  | 'trick-result'
  | 'round-result'
  | 'match-result';

export type GameAction =
  | { readonly type: 'DEAL_ROUND' }
  | { readonly type: 'CHOOSE_TRUMP'; readonly playerId: PlayerId; readonly suit: Suit }
  | { readonly type: 'PLACE_BID'; readonly playerId: PlayerId; readonly bid: number }
  | { readonly type: 'PLAY_CARD'; readonly playerId: PlayerId; readonly cardId: string }
  | { readonly type: 'ACKNOWLEDGE_TRICK' }
  | { readonly type: 'ACKNOWLEDGE_ROUND' };

export type PlayerValues<T> = Readonly<Record<PlayerId, T>>;

export interface BidRecord {
  readonly playerId: PlayerId;
  readonly bid: number;
}

export interface PlayedCard {
  readonly playerId: PlayerId;
  readonly card: Card;
}

export interface CompletedTrick {
  readonly plays: readonly PlayedCard[];
  readonly winnerId: PlayerId;
}

export interface RoundPlayerScore {
  readonly playerId: PlayerId;
  readonly bid: number;
  readonly tricks: number;
  readonly delta: number;
  readonly cumulative: number;
}

export interface RoundScoreRecord {
  readonly round: number;
  readonly trump: Suit | null;
  readonly players: readonly RoundPlayerScore[];
}

export interface GameState {
  readonly schemaVersion: 1;
  readonly matchId: string;
  readonly difficulty: 'easy';
  readonly players: readonly PlayerMetadata[];
  readonly phase: GamePhase;
  readonly round: number;
  readonly dealerId: PlayerId;
  readonly activePlayerId: PlayerId | null;
  readonly rng: RngState;
  readonly drawPile: readonly Card[];
  readonly hands: PlayerValues<readonly Card[]>;
  readonly trump: Suit | null;
  readonly revealedUpCard: Card | null;
  readonly bids: readonly BidRecord[];
  readonly currentTrick: readonly PlayedCard[];
  readonly completedTricks: readonly CompletedTrick[];
  readonly tricksWon: PlayerValues<number>;
  readonly scores: PlayerValues<number>;
  readonly roundScores: readonly RoundScoreRecord[];
  readonly events: readonly string[];
}
