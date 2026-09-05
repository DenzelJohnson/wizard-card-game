import { afterEach, describe, expect, it, vi } from 'vitest';

import { assertEssentialGameState } from './invariants';
import { createMatch, legalActions, reduceGame } from './state';
import { PLAYER_IDS, type GameState, type PlayerId } from './types';

function dealtRound(round = 2): GameState {
  const dealt = reduceGame({ ...createMatch(42), round }, { type: 'DEAL_ROUND' });

  return dealt.phase === 'choose-trump'
    ? reduceGame(dealt, {
        type: 'CHOOSE_TRUMP',
        playerId: dealt.dealerId,
        suit: 'hearts',
      })
    : dealt;
}

function finishBidding(state: GameState): GameState {
  let next = state;

  while (next.phase === 'bidding') {
    next = reduceGame(next, legalActions(next)[0]);
  }

  return next;
}

describe('development game-state invariants', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('asserts a duplicate canonical card after an otherwise accepted transition', () => {
    const state = dealtRound();
    const duplicate = state.hands.human[0];
    const corrupted: GameState = {
      ...state,
      hands: {
        ...state.hands,
        ember: [duplicate, ...state.hands.ember.slice(1)],
      },
    };
    vi.stubEnv('DEV', true);
    vi.stubEnv('MODE', 'development');

    expect(() =>
      reduceGame(corrupted, {
        type: 'PLACE_BID',
        playerId: corrupted.activePlayerId as PlayerId,
        bid: 0,
      }),
    ).toThrow(/card ownership/i);
  });

  it('keeps returning the same object for an illegal action even when input is corrupt', () => {
    const state = dealtRound();
    const corrupted = {
      ...state,
      activePlayerId: 'not-a-player',
    } as unknown as GameState;
    vi.stubEnv('DEV', true);
    vi.stubEnv('MODE', 'development');

    expect(reduceGame(corrupted, { type: 'DEAL_ROUND' })).toBe(corrupted);
  });

  it('checks card counts, active players, bid ranges, and trick totals', () => {
    const bidding = dealtRound();
    const playing = finishBidding(bidding);
    const corruptStates: readonly [GameState, RegExp][] = [
      [
        { ...bidding, drawPile: bidding.drawPile.slice(1) },
        /card ownership|card count/i,
      ],
      [
        { ...bidding, activePlayerId: 'not-a-player' } as unknown as GameState,
        /active player/i,
      ],
      [
        {
          ...bidding,
          bids: [{ playerId: PLAYER_IDS[0], bid: bidding.round + 1 }],
        },
        /bid/i,
      ],
      [
        {
          ...playing,
          tricksWon: { ...playing.tricksWon, human: 1 },
        },
        /trick total/i,
      ],
    ];

    for (const [state, message] of corruptStates) {
      expect(() => assertEssentialGameState(state, true)).toThrow(message);
    }
  });

  it('bypasses development assertions when explicitly disabled for production', () => {
    const state = dealtRound();
    const duplicate = state.hands.human[0];
    const corrupted: GameState = {
      ...state,
      hands: {
        ...state.hands,
        ember: [duplicate, ...state.hands.ember.slice(1)],
      },
    };
    vi.stubEnv('DEV', false);
    vi.stubEnv('MODE', 'production');

    expect(() => assertEssentialGameState(corrupted, false)).not.toThrow();
    expect(
      reduceGame(corrupted, {
        type: 'PLACE_BID',
        playerId: corrupted.activePlayerId as PlayerId,
        bid: 0,
      }),
    ).not.toBe(corrupted);
  });
});
