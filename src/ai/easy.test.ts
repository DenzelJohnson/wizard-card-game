import { describe, expect, it } from 'vitest';
import { chooseEasyAction } from './easy';
import { createRng, nextRandom } from '../game/deck';
import { createMatch, legalActions, reduceGame } from '../game/state';
import { type Card, type GameState, type PlayerId, type Rank, type Suit } from '../game/types';

const COMPUTER_IDS = ['ember', 'rowan', 'mira'] as const;

function computerBiddingState(): GameState {
  for (let seed = 1; seed <= 10_000; seed += 1) {
    const dealt = reduceGame(createMatch(seed), { type: 'DEAL_ROUND' });
    const state =
      dealt.phase === 'choose-trump'
        ? reduceGame(dealt, legalActions(dealt)[0])
        : dealt;

    if (state.phase === 'bidding' && state.activePlayerId !== 'human') {
      return state;
    }
  }

  throw new Error('Could not find a deterministic computer bidding fixture.');
}

function wizardTrumpState(playerId: PlayerId): GameState {
  for (let seed = 1; seed <= 10_000; seed += 1) {
    const state = reduceGame(createMatch(seed), { type: 'DEAL_ROUND' });

    if (state.phase === 'choose-trump' && state.activePlayerId === playerId) {
      return state;
    }
  }

  throw new Error(`Could not find a deterministic Wizard trump fixture for ${playerId}.`);
}

const suited = (id: string, suit: Suit, rank: Rank): Card => ({ id, kind: 'suited', suit, rank });

function restrictedComputerPlayState(): GameState {
  const heart = suited('fixture-heart-2', 'hearts', 2);
  const spade = suited('fixture-spade-14', 'spades', 14);

  return {
    ...computerBiddingState(),
    phase: 'playing',
    activePlayerId: 'ember',
    hands: { human: [], ember: [heart, spade], rowan: [], mira: [] },
    currentTrick: [{ playerId: 'mira', card: suited('fixture-heart-10', 'hearts', 10) }],
  };
}

describe('chooseEasyAction', () => {
  it('selects an engine legal bid for the active computer player', () => {
    const state = computerBiddingState();
    const result = chooseEasyAction(state);

    expect(result).not.toBeNull();
    expect(COMPUTER_IDS).toContain(state.activePlayerId);
    expect(result?.action).toBeDefined();
    expect(legalActions(state)).toContainEqual(result?.action);
    expect(result?.action).toMatchObject({ type: 'PLACE_BID', playerId: state.activePlayerId });
  });

  it('selects one of the four engine legal trump choices for a computer dealer', () => {
    const state = wizardTrumpState('ember');
    const result = chooseEasyAction(state);

    expect(result).not.toBeNull();
    expect(legalActions(state)).toHaveLength(4);
    expect(legalActions(state)).toContainEqual(result?.action);
    expect(result?.action).toMatchObject({ type: 'CHOOSE_TRUMP', playerId: 'ember' });
  });

  it('selects only the follow-suit card allowed by the engine for a computer play', () => {
    const state = restrictedComputerPlayState();
    const result = chooseEasyAction(state);

    expect(legalActions(state)).toEqual([{ type: 'PLAY_CARD', playerId: 'ember', cardId: 'fixture-heart-2' }]);
    expect(result?.action).toEqual(legalActions(state)[0]);
  });

  it('is deterministic for the same state', () => {
    const state = computerBiddingState();

    expect(chooseEasyAction(state)).toEqual(chooseEasyAction(state));
  });

  it('advances RNG once without mutating the input state', () => {
    const state = computerBiddingState();
    const snapshot = structuredClone(state);
    const expected = nextRandom(state.rng);
    const result = chooseEasyAction(state);

    expect(result?.rng).toEqual(expected.state);
    expect(result?.rng).not.toEqual(state.rng);
    expect(state).toEqual(snapshot);
  });

  it('returns null on every human decision turn without consuming RNG', () => {
    const bidding = { ...computerBiddingState(), activePlayerId: 'human' as const };
    const playing = { ...restrictedComputerPlayState(), activePlayerId: 'human' as const };
    const trump = wizardTrumpState('human');

    for (const state of [bidding, playing, trump]) {
      const snapshot = structuredClone(state);

      expect(chooseEasyAction(state)).toBeNull();
      expect(state).toEqual(snapshot);
    }
  });

  it('returns null for all system/result phases and a computer turn with no legal choices', () => {
    const base = computerBiddingState();
    const emptyComputerPlay = {
      ...base,
      phase: 'playing' as const,
      activePlayerId: 'ember' as const,
      hands: { human: [], ember: [], rowan: [], mira: [] },
      currentTrick: [],
    };
    const states: GameState[] = [
      { ...base, phase: 'round-setup', activePlayerId: null },
      { ...base, phase: 'trick-result', activePlayerId: 'ember' },
      { ...base, phase: 'round-result', activePlayerId: null },
      { ...base, phase: 'match-result', activePlayerId: null },
      emptyComputerPlay,
    ];

    for (const state of states) {
      const snapshot = structuredClone(state);

      expect(chooseEasyAction(state)).toBeNull();
      expect(state).toEqual(snapshot);
    }
  });

  it('can reach every legal choice for a two-choice computer bidding state', () => {
    const state = computerBiddingState();
    const choices = legalActions(state);
    const selected = new Set<string>();

    for (let seed = 1; seed <= 512; seed += 1) {
      const result = chooseEasyAction({ ...state, rng: createRng(seed) });

      expect(result).not.toBeNull();
      selected.add(JSON.stringify(result?.action));
    }

    expect(choices).toHaveLength(2);
    expect(selected).toEqual(new Set(choices.map((action) => JSON.stringify(action))));
  });
});
