import { createDeck } from './deck';
import { PLAYER_IDS, type Card, type GameState, type PlayerId } from './types';

const CANONICAL_CARD_IDS = new Set(createDeck().map(({ id }) => id));
const CARD_COUNT = CANONICAL_CARD_IDS.size;
const PLAYER_COUNT = PLAYER_IDS.length;
const MAX_ROUNDS = CARD_COUNT / PLAYER_COUNT;

export function assertEssentialGameState(state: GameState, enabled: boolean): void {
  if (!enabled) {
    return;
  }

  assertActivePlayer(state);
  assertBids(state);
  assertTrickTotals(state);
  assertCardOwnership(state);
}

function assertActivePlayer(state: GameState): void {
  const hasActivePlayer =
    state.activePlayerId !== null &&
    (PLAYER_IDS as readonly string[]).includes(state.activePlayerId);
  const phaseNeedsActivePlayer =
    state.phase === 'choose-trump' ||
    state.phase === 'bidding' ||
    state.phase === 'playing' ||
    state.phase === 'trick-result';

  invariant(
    phaseNeedsActivePlayer ? hasActivePlayer : state.activePlayerId === null,
    'active player does not match the current phase',
  );
}

function assertBids(state: GameState): void {
  const bidderIds = new Set<string>();

  for (const record of state.bids) {
    invariant(
      (PLAYER_IDS as readonly string[]).includes(record.playerId),
      'bid belongs to an unknown player',
    );
    invariant(
      Number.isInteger(record.bid) && record.bid >= 0 && record.bid <= state.round,
      'bid is outside the current round range',
    );
    invariant(!bidderIds.has(record.playerId), 'bid player appears more than once');
    bidderIds.add(record.playerId);
  }

  invariant(state.bids.length <= PLAYER_COUNT, 'bid count exceeds the player count');
}

function assertTrickTotals(state: GameState): void {
  const expectedWins: Record<PlayerId, number> = {
    human: 0,
    ember: 0,
    rowan: 0,
    mira: 0,
  };

  for (const trick of state.completedTricks) {
    invariant(trick.plays.length === PLAYER_COUNT, 'trick total has an incomplete completed trick');
    invariant(
      (PLAYER_IDS as readonly string[]).includes(trick.winnerId),
      'trick total has an unknown winner',
    );
    expectedWins[trick.winnerId] += 1;
  }

  invariant(state.currentTrick.length <= PLAYER_COUNT, 'trick total exceeds four current plays');

  if (state.phase === 'trick-result') {
    invariant(state.currentTrick.length === PLAYER_COUNT, 'trick total is unresolved');
    expectedWins[state.activePlayerId as PlayerId] += 1;
  }

  for (const playerId of PLAYER_IDS) {
    invariant(
      state.tricksWon[playerId] === expectedWins[playerId],
      'trick total does not match completed trick records',
    );
  }
}

function assertCardOwnership(state: GameState): void {
  invariant(
    Number.isInteger(state.round) && state.round >= 1 && state.round <= MAX_ROUNDS,
    'card count uses an invalid round',
  );

  const playedCards = [
    ...state.completedTricks.flatMap(({ plays }) => plays.map(({ card }) => card)),
    ...state.currentTrick.map(({ card }) => card),
  ];
  const locatedCards = [
    ...state.drawPile,
    ...(state.revealedUpCard === null ? [] : [state.revealedUpCard]),
    ...PLAYER_IDS.flatMap((playerId) => state.hands[playerId]),
    ...playedCards,
  ];

  if (state.phase === 'round-setup') {
    invariant(locatedCards.length === 0, 'card count is not empty during round setup');
    return;
  }

  const cardIds = locatedCards.map(({ id }) => id);
  invariant(
    locatedCards.length === CARD_COUNT &&
      new Set(cardIds).size === CARD_COUNT &&
      cardIds.every((id) => CANONICAL_CARD_IDS.has(id)),
    'card ownership must contain 60 unique canonical cards',
  );

  const expectedUpCardCount = state.round < MAX_ROUNDS ? 1 : 0;
  invariant(
    (state.revealedUpCard === null ? 0 : 1) === expectedUpCardCount,
    'card count has an invalid revealed card',
  );
  invariant(
    state.drawPile.length === CARD_COUNT - state.round * PLAYER_COUNT - expectedUpCardCount,
    'card count has an invalid draw pile',
  );

  for (const playerId of PLAYER_IDS) {
    const cardsPlayed = cardsPlayedBy(state, playerId);
    invariant(
      state.hands[playerId].length + cardsPlayed.length === state.round,
      `card count is invalid for ${playerId}`,
    );
  }
}

function cardsPlayedBy(state: GameState, playerId: PlayerId): Card[] {
  return [
    ...state.completedTricks.flatMap(({ plays }) =>
      plays.filter((play) => play.playerId === playerId).map(({ card }) => card),
    ),
    ...state.currentTrick
      .filter((play) => play.playerId === playerId)
      .map(({ card }) => card),
  ];
}

function invariant(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Game state invariant failed: ${message}.`);
  }
}
