import { legalActions } from '../game/state';
import { winningPlay } from '../game/rules';
import {
  SUITS,
  type Card,
  type GameAction,
  type GameState,
  type RngState,
  type Suit,
} from '../game/types';

const COMPUTER_IDS = new Set(['ember', 'rowan', 'mira']);
const SUIT_TIE_BREAK: readonly Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];

export function chooseMediumAction(
  state: GameState,
): { readonly action: GameAction; readonly rng: RngState } | null {
  const playerId = state.activePlayerId;
  if (
    playerId === null ||
    !COMPUTER_IDS.has(playerId) ||
    !['choose-trump', 'bidding', 'playing'].includes(state.phase)
  ) {
    return null;
  }

  const choices = legalActions(state);
  if (choices.length === 0) {
    return null;
  }

  let action: GameAction | undefined;
  if (state.phase === 'choose-trump') {
    const suit = strongestSuit(state.hands[playerId]);
    action = choices.find(
      (choice) => choice.type === 'CHOOSE_TRUMP' && choice.suit === suit,
    );
  } else if (state.phase === 'bidding') {
    const estimate = estimateBid(state.hands[playerId], state.trump, state.round);
    action = choices
      .filter(
        (choice): choice is Extract<GameAction, { type: 'PLACE_BID' }> =>
          choice.type === 'PLACE_BID',
      )
      .sort(
        (left, right) =>
          Math.abs(left.bid - estimate) - Math.abs(right.bid - estimate) || left.bid - right.bid,
      )[0];
  } else {
    action = choosePlay(state, choices);
  }

  return action === undefined ? null : { action, rng: state.rng };
}

function strongestSuit(hand: readonly Card[]): Suit {
  return [...SUIT_TIE_BREAK].sort(
    (left, right) => suitScore(hand, right) - suitScore(hand, left),
  )[0] as Suit;
}

function suitScore(hand: readonly Card[], suit: Suit): number {
  return hand.reduce((score, card) => {
    if (card.kind !== 'suited' || card.suit !== suit) {
      return score;
    }
    return score + 0.35 + Math.max(0, card.rank - 8) * 0.18;
  }, 0);
}

function estimateBid(hand: readonly Card[], trump: Suit | null, round: number): number {
  const suitLengths = new Map<Suit, number>(SUITS.map((suit) => [suit, 0]));
  for (const card of hand) {
    if (card.kind === 'suited') {
      suitLengths.set(card.suit, (suitLengths.get(card.suit) ?? 0) + 1);
    }
  }

  const strength = hand.reduce((total, card) => {
    if (card.kind === 'wizard') {
      return total + 1;
    }
    if (card.kind === 'jester') {
      return total;
    }
    if (card.suit === trump) {
      if (card.rank === 14) return total + 1;
      if (card.rank === 13) return total + 0.85;
      if (card.rank >= 11) return total + 0.65;
      if (card.rank >= 9) return total + 0.38;
      return total + 0.12;
    }
    if (card.rank === 14) return total + 0.75;
    if (card.rank === 13 && (suitLengths.get(card.suit) ?? 0) <= 2) return total + 0.45;
    if (card.rank === 12 && (suitLengths.get(card.suit) ?? 0) === 1) return total + 0.2;
    return total;
  }, 0);

  return Math.max(0, Math.min(round, Math.round(strength)));
}

function choosePlay(state: GameState, choices: readonly GameAction[]): GameAction | undefined {
  const playerId = state.activePlayerId;
  if (playerId === null) {
    return undefined;
  }
  const legal = choices
    .filter(
      (choice): choice is Extract<GameAction, { type: 'PLAY_CARD' }> =>
        choice.type === 'PLAY_CARD',
    )
    .map((action) => ({
      action,
      card: state.hands[playerId].find((candidate) => candidate.id === action.cardId),
    }))
    .filter(
      (
        candidate,
      ): candidate is { action: Extract<GameAction, { type: 'PLAY_CARD' }>; card: Card } =>
        candidate.card !== undefined,
    );

  const bid = state.bids.find((record) => record.playerId === playerId)?.bid ?? 0;
  const needsTrick = state.tricksWon[playerId] < bid;
  if (state.currentTrick.length === 0) {
    return [...legal].sort((left, right) =>
      needsTrick
        ? cardStrength(right.card, state.trump) - cardStrength(left.card, state.trump) ||
          left.card.id.localeCompare(right.card.id)
        : cardStrength(left.card, state.trump) - cardStrength(right.card, state.trump) ||
          left.card.id.localeCompare(right.card.id),
    )[0]?.action;
  }

  const candidates = legal.map((candidate) => ({
    ...candidate,
    wins: winningPlay(
      [...state.currentTrick, { playerId, card: candidate.card }],
      state.trump,
    ).playerId === playerId,
  }));
  const preferred = candidates.filter((candidate) => candidate.wins === needsTrick);
  const pool = preferred.length > 0 ? preferred : candidates;

  return [...pool].sort((left, right) => {
    if (needsTrick) {
      return (
        cardStrength(left.card, state.trump) - cardStrength(right.card, state.trump) ||
        left.card.id.localeCompare(right.card.id)
      );
    }
    if (!left.wins && !right.wins) {
      return (
        cardStrength(right.card, state.trump) - cardStrength(left.card, state.trump) ||
        left.card.id.localeCompare(right.card.id)
      );
    }
    return (
      cardStrength(left.card, state.trump) - cardStrength(right.card, state.trump) ||
      left.card.id.localeCompare(right.card.id)
    );
  })[0]?.action;
}

function cardStrength(card: Card, trump: Suit | null): number {
  if (card.kind === 'wizard') return 100;
  if (card.kind === 'jester') return 0;
  return card.rank + (card.suit === trump ? 30 : 0);
}
