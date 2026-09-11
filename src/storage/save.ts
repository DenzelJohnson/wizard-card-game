import { createDeck } from '../game/deck';
import { EVENT_LIMIT, MAX_ROUNDS } from '../game/state';
import {
  PLAYERS,
  PLAYER_IDS,
  SUITS,
  type Card,
  type GamePhase,
  type GameState,
  type PlayedCard,
  type PlayerId,
} from '../game/types';
import { isSemanticallyValidGameState } from '../game/validation';

export const SAVE_KEY = 'wizard-card-game/save-v1';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type LoadResult =
  | { readonly ok: true; readonly state: GameState }
  | { readonly ok: false; readonly reason: 'missing' | 'invalid' | 'unavailable' };

export type WriteResult = { readonly ok: true } | { readonly ok: false; readonly reason: 'unavailable' };

const PHASES: readonly GamePhase[] = [
  'round-setup',
  'choose-trump',
  'bidding',
  'playing',
  'trick-result',
  'round-result',
  'match-result',
];
const CANONICAL_CARDS = new Map(createDeck().map((card) => [card.id, card]));
const ROOT_KEYS = [
  'schemaVersion',
  'matchId',
  'difficulty',
  'players',
  'phase',
  'round',
  'dealerId',
  'activePlayerId',
  'rng',
  'drawPile',
  'hands',
  'trump',
  'revealedUpCard',
  'bids',
  'currentTrick',
  'completedTricks',
  'tricksWon',
  'scores',
  'roundScores',
  'events',
] as const;

export function loadGame(storage: StorageLike): LoadResult {
  let serialized: string | null;

  try {
    serialized = storage.getItem(SAVE_KEY);
  } catch {
    return { ok: false, reason: 'unavailable' };
  }

  if (serialized === null) {
    return { ok: false, reason: 'missing' };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(serialized);
  } catch {
    discardInvalidSave(storage);
    return { ok: false, reason: 'invalid' };
  }

  const state = readVersionedState(parsed);

  if (state === null || state.phase === 'match-result') {
    discardInvalidSave(storage);
    return { ok: false, reason: 'invalid' };
  }

  return { ok: true, state };
}

export function saveGame(storage: StorageLike, state: GameState): WriteResult {
  try {
    if (state.phase === 'match-result') {
      return clearGame(storage);
    }

    storage.setItem(SAVE_KEY, JSON.stringify(state));
    return { ok: true };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

export function clearGame(storage: StorageLike): WriteResult {
  try {
    storage.removeItem(SAVE_KEY);
    return { ok: true };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

function discardInvalidSave(storage: StorageLike): void {
  try {
    storage.removeItem(SAVE_KEY);
  } catch {
    // Cleanup is best-effort. The invalid load result remains safe for callers.
  }
}

function readVersionedState(value: unknown): GameState | null {
  if (!isRecord(value) || value.schemaVersion !== 1) {
    return null;
  }

  if (!isStructurallyValidGameStateV1(value)) {
    return null;
  }

  return isSemanticallyValidGameState(value) ? value : null;
}

function isStructurallyValidGameStateV1(
  value: Record<string, unknown>,
): value is Record<string, unknown> & GameState {
  if (
    !hasExactKeys(value, ROOT_KEYS) ||
    value.schemaVersion !== 1 ||
    !isNonemptyString(value.matchId) ||
    (value.difficulty !== 'easy' && value.difficulty !== 'medium') ||
    !isPlayers(value.players) ||
    !isPhase(value.phase) ||
    !isIntegerInRange(value.round, 1, MAX_ROUNDS) ||
    !isPlayerId(value.dealerId) ||
    !(value.activePlayerId === null || isPlayerId(value.activePlayerId)) ||
    !isRng(value.rng) ||
    !isCardArray(value.drawPile) ||
    !isHands(value.hands) ||
    !(value.trump === null || isSuit(value.trump)) ||
    !(value.revealedUpCard === null || isCanonicalCard(value.revealedUpCard)) ||
    !isBids(value.bids, value.round) ||
    !isPlayedCards(value.currentTrick, 0, PLAYER_IDS.length) ||
    !isCompletedTricks(value.completedTricks, value.round) ||
    !isPlayerIntegers(value.tricksWon, 0, value.round) ||
    !isPlayerIntegers(value.scores) ||
    !isRoundScores(value.roundScores, value.round) ||
    !isEvents(value.events)
  ) {
    return false;
  }

  return true;
}

function isPlayers(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length === PLAYERS.length &&
    value.every((player, index) => {
      const expected = PLAYERS[index];
      return (
        isRecord(player) &&
        hasExactKeys(player, ['id', 'name', 'isHuman']) &&
        player.id === expected.id &&
        player.name === expected.name &&
        player.isHuman === expected.isHuman
      );
    })
  );
}

function isRng(value: unknown): boolean {
  return isRecord(value) && hasExactKeys(value, ['value']) && isIntegerInRange(value.value, 0, 0xffff_ffff);
}

function isHands(value: unknown): boolean {
  return isPlayerRecord(value, isCardArray);
}

function isBids(value: unknown, round: number): boolean {
  return (
    Array.isArray(value) &&
    value.length <= PLAYER_IDS.length &&
    value.every(
      (bid) =>
        isRecord(bid) &&
        hasExactKeys(bid, ['playerId', 'bid']) &&
        isPlayerId(bid.playerId) &&
        isIntegerInRange(bid.bid, 0, round),
    )
  );
}

function isPlayedCards(value: unknown, minimum: number, maximum: number): value is PlayedCard[] {
  return (
    Array.isArray(value) &&
    value.length >= minimum &&
    value.length <= maximum &&
    value.every(
      (play) =>
        isRecord(play) &&
        hasExactKeys(play, ['playerId', 'card']) &&
        isPlayerId(play.playerId) &&
        isCanonicalCard(play.card),
    )
  );
}

function isCompletedTricks(value: unknown, round: number): boolean {
  return (
    Array.isArray(value) &&
    value.length <= round &&
    value.every(
      (trick) =>
        isRecord(trick) &&
        hasExactKeys(trick, ['plays', 'winnerId']) &&
        isPlayedCards(trick.plays, PLAYER_IDS.length, PLAYER_IDS.length) &&
        isPlayerId(trick.winnerId),
    )
  );
}

function isPlayerIntegers(value: unknown, minimum = Number.MIN_SAFE_INTEGER, maximum = Number.MAX_SAFE_INTEGER): boolean {
  return isPlayerRecord(value, (item) => isIntegerInRange(item, minimum, maximum));
}

function isRoundScores(value: unknown, currentRound: number): boolean {
  if (!Array.isArray(value) || value.length > MAX_ROUNDS) {
    return false;
  }

  return value.every((record) => {
    if (
      !isRecord(record) ||
      !hasExactKeys(record, ['round', 'trump', 'players']) ||
      !isIntegerInRange(record.round, 1, currentRound) ||
      !(record.trump === null || isSuit(record.trump)) ||
      !Array.isArray(record.players) ||
      record.players.length !== PLAYER_IDS.length
    ) {
      return false;
    }

    return record.players.every((score, index) => {
      if (!isRecord(score) || !hasExactKeys(score, ['playerId', 'bid', 'tricks', 'delta', 'cumulative'])) {
        return false;
      }

      return (
        score.playerId === PLAYER_IDS[index] &&
        isIntegerInRange(score.bid, 0, record.round as number) &&
        isIntegerInRange(score.tricks, 0, record.round as number) &&
        Number.isSafeInteger(score.delta) &&
        Number.isSafeInteger(score.cumulative)
      );
    });
  });
}

function isEvents(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length <= EVENT_LIMIT &&
    value.every((event) => typeof event === 'string')
  );
}

function isCardArray(value: unknown): value is Card[] {
  return Array.isArray(value) && value.every(isCanonicalCard);
}

function isCanonicalCard(value: unknown): value is Card {
  if (!isRecord(value) || typeof value.id !== 'string') {
    return false;
  }

  const expected = CANONICAL_CARDS.get(value.id);

  if (expected === undefined || value.kind !== expected.kind) {
    return false;
  }

  if (expected.kind === 'suited') {
    return (
      hasExactKeys(value, ['id', 'kind', 'suit', 'rank']) &&
      value.suit === expected.suit &&
      value.rank === expected.rank
    );
  }

  return hasExactKeys(value, ['id', 'kind']);
}

function isPlayerRecord(value: unknown, validate: (item: unknown) => boolean): boolean {
  return (
    isRecord(value) &&
    hasExactKeys(value, PLAYER_IDS) &&
    PLAYER_IDS.every((playerId) => validate(value[playerId]))
  );
}

function isPhase(value: unknown): value is GamePhase {
  return typeof value === 'string' && (PHASES as readonly string[]).includes(value);
}

function isSuit(value: unknown): boolean {
  return typeof value === 'string' && (SUITS as readonly string[]).includes(value);
}

function isPlayerId(value: unknown): value is PlayerId {
  return typeof value === 'string' && (PLAYER_IDS as readonly string[]).includes(value);
}

function isNonemptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isIntegerInRange(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isSafeInteger(value) && (value as number) >= minimum && (value as number) <= maximum;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expectedKeys.length && expectedKeys.every((key) => Object.hasOwn(value, key));
}
