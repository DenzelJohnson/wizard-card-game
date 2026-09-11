import { describe, expect, it } from 'vitest';

import { createRng } from '../game/deck';
import { createMatch, legalActions } from '../game/state';
import type { Card, GameState, PlayerId, Rank } from '../game/types';
import { chooseMediumAction } from './medium';

const card = (suit: 'clubs' | 'diamonds' | 'hearts' | 'spades', rank: Rank): Card => ({
  id: `${suit}-${rank}`,
  kind: 'suited',
  suit,
  rank,
});
const wizard: Card = { id: 'wizard-1', kind: 'wizard' };
const jester: Card = { id: 'jester-1', kind: 'jester' };

function decisionState(
  phase: 'choose-trump' | 'bidding' | 'playing',
  hand: readonly Card[],
  overrides: Partial<GameState> = {},
): GameState {
  return {
    ...createMatch(42, 'medium'),
    phase,
    round: hand.length,
    dealerId: 'ember',
    activePlayerId: 'ember',
    hands: { human: [], ember: hand, rowan: [], mira: [] },
    trump: 'spades',
    revealedUpCard: card('spades', 2),
    rng: createRng(99),
    ...overrides,
  };
}

describe('chooseMediumAction', () => {
  it('chooses the strongest suit for a Wizard reveal', () => {
    const state = decisionState('choose-trump', [
      card('spades', 14),
      card('spades', 12),
      card('hearts', 13),
      card('clubs', 5),
    ], { trump: null, revealedUpCard: wizard });

    expect(chooseMediumAction(state)?.action).toEqual({
      type: 'CHOOSE_TRUMP',
      playerId: 'ember',
      suit: 'spades',
    });
  });

  it('estimates a legal bid from Wizards, trump control, and high side cards', () => {
    const state = decisionState('bidding', [
      wizard,
      card('spades', 14),
      card('spades', 13),
      card('hearts', 14),
      jester,
    ]);

    expect(chooseMediumAction(state)?.action).toEqual({
      type: 'PLACE_BID',
      playerId: 'ember',
      bid: 4,
    });
  });

  it('uses the cheapest card that currently wins when still chasing its bid', () => {
    const state = decisionState('playing', [card('hearts', 11), card('hearts', 14)], {
      trump: 'spades',
      bids: [{ playerId: 'ember', bid: 1 }],
      tricksWon: { human: 0, ember: 0, rowan: 0, mira: 0 },
      currentTrick: [{ playerId: 'human', card: card('hearts', 10) }],
    });

    expect(chooseMediumAction(state)?.action).toEqual({
      type: 'PLAY_CARD',
      playerId: 'ember',
      cardId: 'hearts-11',
    });
  });

  it('protects a made bid by playing a Jester instead of taking the trick', () => {
    const state = decisionState('playing', [jester, card('hearts', 14)], {
      bids: [{ playerId: 'ember', bid: 0 }],
      currentTrick: [{ playerId: 'human', card: card('hearts', 2) }],
    });

    expect(chooseMediumAction(state)?.action).toEqual({
      type: 'PLAY_CARD',
      playerId: 'ember',
      cardId: 'jester-1',
    });
  });

  it('always returns one engine-legal action and leaves RNG unchanged', () => {
    const states = [
      decisionState('choose-trump', [card('clubs', 9)], { trump: null, revealedUpCard: wizard }),
      decisionState('bidding', [card('clubs', 9)]),
      decisionState('playing', [card('clubs', 9)], {
        bids: [{ playerId: 'ember', bid: 0 }],
      }),
    ];

    for (const state of states) {
      const result = chooseMediumAction(state);
      expect(result).not.toBeNull();
      expect(legalActions(state)).toContainEqual(result?.action);
      expect(result?.rng).toBe(state.rng);
      expect(chooseMediumAction(state)).toEqual(result);
    }
  });

  it.each<[PlayerId | null]>([['human'], [null]])('does not act for %s', (activePlayerId) => {
    const state = decisionState('bidding', [card('clubs', 9)], { activePlayerId });
    expect(chooseMediumAction(state)).toBeNull();
  });
});
