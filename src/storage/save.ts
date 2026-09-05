import { createDeck } from '../game/deck';
import { winningPlay } from '../game/rules';
import { scoreRound } from '../game/scoring';
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
const MIN_MATCH_SCORE = -1_200;
const MAX_MATCH_SCORE = 1_500;
const MIN_ROUND_DELTA = -150;
const MAX_ROUND_DELTA = 170;
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
  if (state.phase === 'match-result') {
    return clearGame(storage);
  }

  try {
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

  return isGameStateV1(value) ? value : null;
}

function isGameStateV1(value: Record<string, unknown>): value is Record<string, unknown> & GameState {
  if (
    !hasExactKeys(value, ROOT_KEYS) ||
    value.schemaVersion !== 1 ||
    !isNonemptyString(value.matchId) ||
    value.difficulty !== 'easy' ||
    !isPlayers(value.players) ||
    !isPhase(value.phase) ||
    !isIntegerInRange(value.round, 1, 15) ||
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
    !isPlayerIntegers(value.scores, MIN_MATCH_SCORE, MAX_MATCH_SCORE) ||
    !isRoundScores(value.roundScores, value.round) ||
    !isEvents(value.events)
  ) {
    return false;
  }

  const state = value as unknown as GameState;
  return hasValidCardPartition(state) && hasValidPhaseState(state);
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
  if (!Array.isArray(value) || value.length > PLAYER_IDS.length) {
    return false;
  }

  const bidders = new Set<PlayerId>();

  return value.every((bid) => {
    if (
      !isRecord(bid) ||
      !hasExactKeys(bid, ['playerId', 'bid']) ||
      !isPlayerId(bid.playerId) ||
      !isIntegerInRange(bid.bid, 0, round) ||
      bidders.has(bid.playerId)
    ) {
      return false;
    }

    bidders.add(bid.playerId);
    return true;
  });
}

function isPlayedCards(value: unknown, minimum: number, maximum: number): value is PlayedCard[] {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
    return false;
  }

  const players = new Set<PlayerId>();

  return value.every((play) => {
    if (
      !isRecord(play) ||
      !hasExactKeys(play, ['playerId', 'card']) ||
      !isPlayerId(play.playerId) ||
      !isCanonicalCard(play.card) ||
      players.has(play.playerId)
    ) {
      return false;
    }

    players.add(play.playerId);
    return true;
  });
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
        isPlayerId(trick.winnerId) &&
        trick.plays.some(
          (play) => isRecord(play) && isPlayerId(play.playerId) && play.playerId === trick.winnerId,
        ),
    )
  );
}

function isPlayerIntegers(value: unknown, minimum = Number.MIN_SAFE_INTEGER, maximum = Number.MAX_SAFE_INTEGER): boolean {
  return isPlayerRecord(value, (item) => isIntegerInRange(item, minimum, maximum));
}

function isRoundScores(value: unknown, currentRound: number): boolean {
  if (!Array.isArray(value) || value.length > 15) {
    return false;
  }

  const rounds = new Set<number>();

  return value.every((record) => {
    if (
      !isRecord(record) ||
      !hasExactKeys(record, ['round', 'trump', 'players']) ||
      !isIntegerInRange(record.round, 1, currentRound) ||
      !(record.trump === null || isSuit(record.trump)) ||
      !Array.isArray(record.players) ||
      record.players.length !== PLAYER_IDS.length ||
      rounds.has(record.round)
    ) {
      return false;
    }

    rounds.add(record.round);

    return record.players.every((score, index) => {
      if (!isRecord(score) || !hasExactKeys(score, ['playerId', 'bid', 'tricks', 'delta', 'cumulative'])) {
        return false;
      }

      return (
        score.playerId === PLAYER_IDS[index] &&
        isIntegerInRange(score.bid, 0, record.round as number) &&
        isIntegerInRange(score.tricks, 0, record.round as number) &&
        isIntegerInRange(score.delta, MIN_ROUND_DELTA, MAX_ROUND_DELTA) &&
        isIntegerInRange(score.cumulative, MIN_MATCH_SCORE, MAX_MATCH_SCORE)
      );
    });
  });
}

function isEvents(value: unknown): boolean {
  return Array.isArray(value) && value.length <= 24 && value.every((event) => typeof event === 'string');
}

function hasValidCardPartition(state: GameState): boolean {
  const playedCards = [
    ...state.currentTrick,
    ...state.completedTricks.flatMap((trick) => trick.plays),
  ];
  const locatedCards = [
    ...state.drawPile,
    ...(state.revealedUpCard === null ? [] : [state.revealedUpCard]),
    ...PLAYER_IDS.flatMap((playerId) => state.hands[playerId]),
    ...playedCards.map((play) => play.card),
  ];

  if (state.phase === 'round-setup') {
    return locatedCards.length === 0;
  }

  if (locatedCards.length !== CANONICAL_CARDS.size || new Set(locatedCards.map((card) => card.id)).size !== CANONICAL_CARDS.size) {
    return false;
  }

  if (!locatedCards.every((card) => CANONICAL_CARDS.has(card.id))) {
    return false;
  }

  const expectedUpCards = state.round < 15 ? 1 : 0;
  const expectedDrawCards = CANONICAL_CARDS.size - state.round * PLAYER_IDS.length - expectedUpCards;

  if ((state.revealedUpCard === null ? 0 : 1) !== expectedUpCards || state.drawPile.length !== expectedDrawCards) {
    return false;
  }

  return PLAYER_IDS.every((playerId) => {
    const playedByPlayer = playedCards.filter((play) => play.playerId === playerId).length;
    return state.hands[playerId].length + playedByPlayer === state.round;
  });
}

function hasValidPhaseState(state: GameState): boolean {
  switch (state.phase) {
    case 'round-setup':
      return (
        state.activePlayerId === null &&
        state.trump === null &&
        state.revealedUpCard === null &&
        state.drawPile.length === 0 &&
        state.bids.length === 0 &&
        state.currentTrick.length === 0 &&
        state.completedTricks.length === 0 &&
        hasEmptyHands(state) &&
        hasZeroTricksWon(state)
      );

    case 'choose-trump':
      return (
        state.activePlayerId === state.dealerId &&
        state.revealedUpCard?.kind === 'wizard' &&
        state.trump === null &&
        state.bids.length === 0 &&
        state.currentTrick.length === 0 &&
        state.completedTricks.length === 0 &&
        hasFullHands(state) &&
        hasZeroTricksWon(state)
      );

    case 'bidding':
      return (
        state.bids.length < PLAYER_IDS.length &&
        hasBidsInOrder(state) &&
        state.activePlayerId === playerAfter(state.dealerId, state.bids.length + 1) &&
        state.currentTrick.length === 0 &&
        state.completedTricks.length === 0 &&
        hasFullHands(state) &&
        hasZeroTricksWon(state) &&
        hasResolvedTrump(state)
      );

    case 'playing':
      return (
        state.bids.length === PLAYER_IDS.length &&
        hasBidsInOrder(state) &&
        state.currentTrick.length < PLAYER_IDS.length &&
        state.completedTricks.length < state.round &&
        hasValidTrickOrderAndWinners(state) &&
        state.activePlayerId === expectedCurrentPlayer(state) &&
        hasMatchingTricksWon(state, false) &&
        hasResolvedTrump(state)
      );

    case 'trick-result': {
      const currentWinner = winnerId(state.currentTrick, state.trump);

      return (
        state.bids.length === PLAYER_IDS.length &&
        hasBidsInOrder(state) &&
        state.currentTrick.length === PLAYER_IDS.length &&
        state.completedTricks.length < state.round &&
        hasValidTrickOrderAndWinners(state) &&
        currentWinner !== null &&
        state.activePlayerId === currentWinner &&
        hasMatchingTricksWon(state, true) &&
        hasResolvedTrump(state)
      );
    }

    case 'round-result':
      return (
        state.bids.length === PLAYER_IDS.length &&
        hasBidsInOrder(state) &&
        state.activePlayerId === null &&
        state.currentTrick.length === 0 &&
        state.completedTricks.length === state.round &&
        hasEmptyHands(state) &&
        hasValidTrickOrderAndWinners(state) &&
        hasMatchingTricksWon(state, false) &&
        hasCurrentRoundScore(state) &&
        hasResolvedTrump(state)
      );

    case 'match-result':
      return false;
  }
}

function hasBidsInOrder(state: GameState): boolean {
  return state.bids.every(
    (bid, index) => bid.playerId === playerAfter(state.dealerId, index + 1),
  );
}

function hasValidTrickOrderAndWinners(state: GameState): boolean {
  let leaderId = playerAfter(state.dealerId, 1);

  for (const trick of state.completedTricks) {
    if (
      !hasPlayersInOrder(trick.plays, leaderId) ||
      winnerId(trick.plays, state.trump) !== trick.winnerId
    ) {
      return false;
    }

    leaderId = trick.winnerId;
  }

  return hasPlayersInOrder(state.currentTrick, leaderId);
}

function hasPlayersInOrder(plays: readonly PlayedCard[], leaderId: PlayerId): boolean {
  return plays.every((play, index) => play.playerId === playerAfter(leaderId, index));
}

function expectedCurrentPlayer(state: GameState): PlayerId {
  const leaderId = state.completedTricks.at(-1)?.winnerId ?? playerAfter(state.dealerId, 1);
  const lastPlayerId = state.currentTrick.at(-1)?.playerId;
  return lastPlayerId === undefined ? leaderId : playerAfter(lastPlayerId, 1);
}

function hasMatchingTricksWon(state: GameState, includeCurrentTrick: boolean): boolean {
  const expected: Record<PlayerId, number> = { human: 0, ember: 0, rowan: 0, mira: 0 };

  for (const trick of state.completedTricks) {
    expected[trick.winnerId] += 1;
  }

  if (includeCurrentTrick) {
    const currentWinner = winnerId(state.currentTrick, state.trump);
    if (currentWinner === null) {
      return false;
    }
    expected[currentWinner] += 1;
  }

  return PLAYER_IDS.every((playerId) => state.tricksWon[playerId] === expected[playerId]);
}

function winnerId(plays: readonly PlayedCard[], trump: GameState['trump']): PlayerId | null {
  if (plays.length === 0) {
    return null;
  }

  const playerId = winningPlay(plays, trump).playerId;
  return isPlayerId(playerId) ? playerId : null;
}

function hasResolvedTrump(state: GameState): boolean {
  if (state.round === 15) {
    return state.revealedUpCard === null && state.trump === null;
  }

  if (state.revealedUpCard === null) {
    return false;
  }

  if (state.revealedUpCard.kind === 'suited') {
    return state.trump === state.revealedUpCard.suit;
  }

  if (state.revealedUpCard.kind === 'jester') {
    return state.trump === null;
  }

  return state.trump !== null;
}

function hasCurrentRoundScore(state: GameState): boolean {
  const roundScore = state.roundScores.at(-1);

  if (
    roundScore === undefined ||
    roundScore.round !== state.round ||
    roundScore.trump !== state.trump
  ) {
    return false;
  }

  return PLAYER_IDS.every((playerId, index) => {
    const playerScore = roundScore.players[index];
    const bid = state.bids.find((record) => record.playerId === playerId)?.bid;

    return (
      playerScore?.playerId === playerId &&
      bid !== undefined &&
      playerScore.bid === bid &&
      playerScore.tricks === state.tricksWon[playerId] &&
      playerScore.delta === scoreRound(bid, state.tricksWon[playerId]) &&
      playerScore.cumulative === state.scores[playerId]
    );
  });
}

function hasFullHands(state: GameState): boolean {
  return PLAYER_IDS.every((playerId) => state.hands[playerId].length === state.round);
}

function hasEmptyHands(state: GameState): boolean {
  return PLAYER_IDS.every((playerId) => state.hands[playerId].length === 0);
}

function hasZeroTricksWon(state: GameState): boolean {
  return PLAYER_IDS.every((playerId) => state.tricksWon[playerId] === 0);
}

function playerAfter(playerId: PlayerId, offset: number): PlayerId {
  return PLAYER_IDS[(PLAYER_IDS.indexOf(playerId) + offset) % PLAYER_IDS.length];
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
