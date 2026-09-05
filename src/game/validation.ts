import { createDeck } from './deck';
import { legalCards, winningPlay } from './rules';
import { scoreRound } from './scoring';
import { MAX_ROUNDS, nextPlayerId } from './state';
import {
  PLAYER_IDS,
  type Card,
  type GameState,
  type PlayedCard,
  type PlayerId,
} from './types';

const CANONICAL_CARD_IDS = new Set(createDeck().map((card) => card.id));

interface TrickReplay {
  readonly completedWins: Record<PlayerId, number>;
  readonly currentWinnerId: PlayerId | null;
  readonly nextPlayerId: PlayerId;
}

/** Validates cross-field game semantics after a caller has validated the complete data structure. */
export function isSemanticallyValidGameState(state: GameState): boolean {
  return hasValidCardPartition(state) && hasValidScoreTimeline(state) && hasValidPhaseState(state);
}

function hasValidCardPartition(state: GameState): boolean {
  const playedCards = allPlayedCards(state);
  const locatedCards = [
    ...state.drawPile,
    ...(state.revealedUpCard === null ? [] : [state.revealedUpCard]),
    ...PLAYER_IDS.flatMap((playerId) => state.hands[playerId]),
    ...playedCards.map((play) => play.card),
  ];

  if (state.phase === 'round-setup') {
    return locatedCards.length === 0;
  }

  const uniqueIds = new Set(locatedCards.map((card) => card.id));
  if (
    locatedCards.length !== CANONICAL_CARD_IDS.size ||
    uniqueIds.size !== CANONICAL_CARD_IDS.size ||
    !locatedCards.every((card) => CANONICAL_CARD_IDS.has(card.id))
  ) {
    return false;
  }

  const expectedUpCards = state.round < MAX_ROUNDS ? 1 : 0;
  const expectedDrawCards = CANONICAL_CARD_IDS.size - state.round * PLAYER_IDS.length - expectedUpCards;

  if (
    (state.revealedUpCard === null ? 0 : 1) !== expectedUpCards ||
    state.drawPile.length !== expectedDrawCards
  ) {
    return false;
  }

  return PLAYER_IDS.every((playerId) => {
    const playedByPlayer = playedCards.filter((play) => play.playerId === playerId).length;
    return state.hands[playerId].length + playedByPlayer === state.round;
  });
}

function hasValidScoreTimeline(state: GameState): boolean {
  const expectedRows = state.phase === 'round-result' ? state.round : state.round - 1;
  if (state.roundScores.length !== expectedRows) {
    return false;
  }

  const cumulative: Record<PlayerId, number> = { human: 0, ember: 0, rowan: 0, mira: 0 };

  for (const [index, record] of state.roundScores.entries()) {
    const expectedRound = index + 1;
    if (
      record.round !== expectedRound ||
      record.players.length !== PLAYER_IDS.length ||
      record.players.reduce((total, player) => total + player.tricks, 0) !== expectedRound
    ) {
      return false;
    }

    for (const [seat, playerId] of PLAYER_IDS.entries()) {
      const player = record.players[seat];
      if (
        player?.playerId !== playerId ||
        player.delta !== scoreRound(player.bid, player.tricks)
      ) {
        return false;
      }

      cumulative[playerId] += player.delta;
      if (player.cumulative !== cumulative[playerId]) {
        return false;
      }
    }
  }

  if (!PLAYER_IDS.every((playerId) => state.scores[playerId] === cumulative[playerId])) {
    return false;
  }

  if (state.phase !== 'round-result') {
    return true;
  }

  const currentRecord = state.roundScores.at(-1);
  return (
    currentRecord !== undefined &&
    currentRecord.trump === state.trump &&
    PLAYER_IDS.every((playerId, seat) => {
      const player = currentRecord.players[seat];
      const bid = state.bids.find((record) => record.playerId === playerId)?.bid;
      return (
        player?.playerId === playerId &&
        bid !== undefined &&
        player.bid === bid &&
        player.tricks === state.tricksWon[playerId]
      );
    })
  );
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

    case 'playing': {
      const replay = replayTricks(state);

      return (
        state.bids.length === PLAYER_IDS.length &&
        hasBidsInOrder(state) &&
        state.currentTrick.length < PLAYER_IDS.length &&
        state.completedTricks.length < state.round &&
        replay !== null &&
        replay.currentWinnerId === null &&
        state.activePlayerId === replay.nextPlayerId &&
        hasMatchingTricksWon(state, replay.completedWins) &&
        hasResolvedTrump(state)
      );
    }

    case 'trick-result': {
      const replay = replayTricks(state);

      if (
        state.bids.length !== PLAYER_IDS.length ||
        !hasBidsInOrder(state) ||
        state.currentTrick.length !== PLAYER_IDS.length ||
        state.completedTricks.length >= state.round ||
        replay === null ||
        replay.currentWinnerId === null ||
        state.activePlayerId !== replay.currentWinnerId ||
        !hasResolvedTrump(state)
      ) {
        return false;
      }

      return hasMatchingTricksWon(state, {
        ...replay.completedWins,
        [replay.currentWinnerId]: replay.completedWins[replay.currentWinnerId] + 1,
      });
    }

    case 'round-result': {
      const replay = replayTricks(state);

      return (
        state.bids.length === PLAYER_IDS.length &&
        hasBidsInOrder(state) &&
        state.activePlayerId === null &&
        state.currentTrick.length === 0 &&
        state.completedTricks.length === state.round &&
        hasEmptyHands(state) &&
        replay !== null &&
        hasMatchingTricksWon(state, replay.completedWins) &&
        hasResolvedTrump(state)
      );
    }

    case 'match-result':
      return false;
  }
}

function replayTricks(state: GameState): TrickReplay | null {
  const hands = reconstructRoundHands(state);
  const completedWins: Record<PlayerId, number> = { human: 0, ember: 0, rowan: 0, mira: 0 };
  let leaderId = nextPlayerId(state.dealerId);

  for (const trick of state.completedTricks) {
    const result = replayTrick(trick.plays, leaderId, hands, state.trump);
    if (result === null || result.winnerId === null || result.winnerId !== trick.winnerId) {
      return null;
    }

    completedWins[result.winnerId] += 1;
    leaderId = result.winnerId;
  }

  const current = replayTrick(state.currentTrick, leaderId, hands, state.trump);
  if (current === null) {
    return null;
  }

  if (!PLAYER_IDS.every((playerId) => sameCardIds(hands[playerId], state.hands[playerId]))) {
    return null;
  }

  return {
    completedWins,
    currentWinnerId: current.winnerId,
    nextPlayerId: current.nextPlayerId,
  };
}

function replayTrick(
  plays: readonly PlayedCard[],
  leaderId: PlayerId,
  hands: Record<PlayerId, Card[]>,
  trump: GameState['trump'],
): { readonly winnerId: PlayerId | null; readonly nextPlayerId: PlayerId } | null {
  const priorPlays: PlayedCard[] = [];
  let expectedPlayerId = leaderId;

  for (const play of plays) {
    if (play.playerId !== expectedPlayerId) {
      return null;
    }

    const hand = hands[play.playerId];
    const cardIndex = hand.findIndex((card) => card.id === play.card.id);
    if (
      cardIndex < 0 ||
      !legalCards(hand, priorPlays).some((card) => card.id === play.card.id)
    ) {
      return null;
    }

    hand.splice(cardIndex, 1);
    priorPlays.push(play);
    expectedPlayerId = nextPlayerId(play.playerId);
  }

  if (plays.length < PLAYER_IDS.length) {
    return { winnerId: null, nextPlayerId: expectedPlayerId };
  }

  const winnerId = winningPlay(plays, trump).playerId;
  return isPlayerId(winnerId) ? { winnerId, nextPlayerId: expectedPlayerId } : null;
}

function reconstructRoundHands(state: GameState): Record<PlayerId, Card[]> {
  const hands: Record<PlayerId, Card[]> = {
    human: [...state.hands.human],
    ember: [...state.hands.ember],
    rowan: [...state.hands.rowan],
    mira: [...state.hands.mira],
  };

  for (const play of allPlayedCards(state)) {
    hands[play.playerId].push(play.card);
  }

  return hands;
}

function allPlayedCards(state: GameState): PlayedCard[] {
  return [
    ...state.completedTricks.flatMap((trick) => trick.plays),
    ...state.currentTrick,
  ];
}

function sameCardIds(left: readonly Card[], right: readonly Card[]): boolean {
  return (
    left.length === right.length &&
    left.every((card) => right.some((candidate) => candidate.id === card.id))
  );
}

function hasBidsInOrder(state: GameState): boolean {
  return state.bids.every(
    (bid, index) => bid.playerId === playerAfter(state.dealerId, index + 1),
  );
}

function hasMatchingTricksWon(
  state: GameState,
  expected: Readonly<Record<PlayerId, number>>,
): boolean {
  return PLAYER_IDS.every((playerId) => state.tricksWon[playerId] === expected[playerId]);
}

function hasResolvedTrump(state: GameState): boolean {
  if (state.round === MAX_ROUNDS) {
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
  let result = playerId;

  for (let count = 0; count < offset; count += 1) {
    result = nextPlayerId(result);
  }

  return result;
}

function isPlayerId(value: string): value is PlayerId {
  return (PLAYER_IDS as readonly string[]).includes(value);
}
