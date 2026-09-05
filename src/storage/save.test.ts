import { describe, expect, it } from 'vitest';

import { createMatch, legalActions, reduceGame } from '../game/state';
import type { GameState } from '../game/types';
import { SAVE_KEY, clearGame, loadGame, saveGame, type StorageLike } from './save';

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>();
  readonly removedKeys: string[] = [];
  throwOnGet = false;
  throwOnSet = false;
  throwOnRemove = false;

  constructor(value?: string) {
    if (value !== undefined) {
      this.values.set(SAVE_KEY, value);
    }
  }

  getItem(key: string): string | null {
    if (this.throwOnGet) {
      throw new Error('storage read blocked');
    }

    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.throwOnSet) {
      throw new Error('storage write blocked');
    }

    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.removedKeys.push(key);
    if (this.throwOnRemove) {
      throw new Error('storage removal blocked');
    }

    this.values.delete(key);
  }
}

function dealtState(round = 3): GameState {
  return reduceGame({ ...createMatch(42), round }, { type: 'DEAL_ROUND' });
}

function dealtInPhase(phase: 'choose-trump' | 'bidding'): GameState {
  for (let seed = 1; seed <= 10_000; seed += 1) {
    const state = reduceGame(createMatch(seed), { type: 'DEAL_ROUND' });

    if (state.phase === phase) {
      return state;
    }
  }

  throw new Error(`No deterministic ${phase} fixture found.`);
}

function phaseFixtures(): GameState[] {
  const chooseTrump = dealtInPhase('choose-trump');
  let bidding = reduceGame(chooseTrump, {
    type: 'CHOOSE_TRUMP',
    playerId: chooseTrump.dealerId,
    suit: 'clubs',
  });
  let playing = bidding;

  while (playing.phase === 'bidding') {
    const action = legalActions(playing)[0];
    playing = reduceGame(playing, action);
  }

  let trickResult = playing;

  while (trickResult.phase === 'playing') {
    const action = legalActions(trickResult)[0];
    trickResult = reduceGame(trickResult, action);
  }

  const roundResult = reduceGame(trickResult, { type: 'ACKNOWLEDGE_TRICK' });
  bidding = dealtInPhase('bidding');

  return [createMatch(42), chooseTrump, bidding, playing, trickResult, roundResult];
}

function serialized(state: GameState = dealtState()): Record<string, unknown> {
  return JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
}

function stateWithBidCount(count: number): GameState {
  let state = dealtInPhase('bidding');

  while (state.phase === 'bidding' && state.bids.length < count) {
    state = reduceGame(state, legalActions(state)[0]);
  }

  return state;
}

function stateWithCurrentTrickLength(length: number): GameState {
  let state = phaseFixtures().find(({ phase }) => phase === 'playing');

  if (state === undefined) {
    throw new Error('No playing fixture found.');
  }

  while (state.phase === 'playing' && state.currentTrick.length < length) {
    state = reduceGame(state, legalActions(state)[0]);
  }

  return state;
}

function reachableState(predicate: (state: GameState) => boolean): GameState {
  let state = createMatch(20_260_905);

  for (let transition = 0; transition <= 800; transition += 1) {
    if (predicate(state)) {
      return state;
    }

    const action = legalActions(state)[0];
    if (action === undefined) {
      break;
    }
    state = reduceGame(state, action);
  }

  throw new Error('No matching reachable state found.');
}

function expectInvalidMutation(state: GameState, mutate: (value: Record<string, unknown>) => void): void {
  const value = serialized(state);
  mutate(value);
  const storage = new MemoryStorage(JSON.stringify(value));

  expect(loadGame(storage)).toEqual({ ok: false, reason: 'invalid' });
  expect(storage.removedKeys).toEqual([SAVE_KEY]);
}

describe('browser save boundary', () => {
  it.each([
    ['a fresh round-setup state', createMatch(42)],
    ['an in-round state', dealtState()],
  ])('round-trips %s with exact state and RNG equality', (_label, state) => {
    const storage = new MemoryStorage();

    expect(saveGame(storage, state)).toEqual({ ok: true });
    expect(loadGame(storage)).toEqual({ ok: true, state });
  });

  it('accepts reducer-produced states from every resumable phase', () => {
    const phases = phaseFixtures();

    expect(phases.map(({ phase }) => phase)).toEqual([
      'round-setup',
      'choose-trump',
      'bidding',
      'playing',
      'trick-result',
      'round-result',
    ]);

    for (const state of phases) {
      const storage = new MemoryStorage();
      expect(saveGame(storage, state)).toEqual({ ok: true });
      expect(loadGame(storage)).toEqual({ ok: true, state });
    }
  });

  it('round-trips every reachable resumable state in a complete match', () => {
    let state = createMatch(20_260_905);
    let transitions = 0;

    while (state.phase !== 'match-result') {
      const storage = new MemoryStorage();
      expect(saveGame(storage, state)).toEqual({ ok: true });
      expect(loadGame(storage)).toEqual({ ok: true, state });

      const action = legalActions(state)[0];
      if (action === undefined) {
        throw new Error(`No legal action at round ${state.round} in ${state.phase}.`);
      }

      state = reduceGame(state, action);
      transitions += 1;
      expect(transitions).toBeLessThanOrEqual(800);
    }

    expect(state.roundScores).toHaveLength(15);
  });

  it('rejects round setup with action state left populated', () => {
    expectInvalidMutation(createMatch(42), (value) => {
      value.bids = [{ playerId: 'human', bid: 0 }];
    });
  });

  it('rejects choose-trump when the dealer is not active', () => {
    expectInvalidMutation(dealtInPhase('choose-trump'), (value) => {
      value.activePlayerId = null;
    });
  });

  it('rejects bidding with no active player', () => {
    expectInvalidMutation(dealtInPhase('bidding'), (value) => {
      value.activePlayerId = null;
    });
  });

  it('rejects bids outside clockwise order from the dealer', () => {
    expectInvalidMutation(stateWithBidCount(2), (value) => {
      (value.bids as unknown[]).reverse();
    });
  });

  it('rejects playing before all four players have bid', () => {
    const playing = phaseFixtures().find(({ phase }) => phase === 'playing');
    if (playing === undefined) {
      throw new Error('No playing fixture found.');
    }

    expectInvalidMutation(playing, (value) => {
      value.bids = [];
    });
  });

  it('rejects a current trick whose players are out of turn order', () => {
    expectInvalidMutation(stateWithCurrentTrickLength(2), (value) => {
      (value.currentTrick as unknown[]).reverse();
    });
  });

  it('rejects trick-result with an empty visible trick even when all cards remain located', () => {
    const trickResult = phaseFixtures().find(({ phase }) => phase === 'trick-result');
    if (trickResult === undefined) {
      throw new Error('No trick-result fixture found.');
    }

    expectInvalidMutation(trickResult, (value) => {
      const hands = value.hands as Record<string, unknown[]>;
      const currentTrick = value.currentTrick as Array<Record<string, unknown>>;

      for (const play of currentTrick) {
        hands[play.playerId as string].push(play.card);
      }
      value.currentTrick = [];
    });
  });

  it('rejects trick-result when tricks won omits the visible current winner', () => {
    const trickResult = phaseFixtures().find(({ phase }) => phase === 'trick-result');
    if (trickResult === undefined) {
      throw new Error('No trick-result fixture found.');
    }

    expectInvalidMutation(trickResult, (value) => {
      value.tricksWon = { human: 0, ember: 0, rowan: 0, mira: 0 };
    });
  });

  it('rejects playing when tricks won disagrees with completed-trick winners', () => {
    const playing = reachableState(
      (state) => state.phase === 'playing' && state.completedTricks.length === 1,
    );

    expectInvalidMutation(playing, (value) => {
      value.tricksWon = { human: 0, ember: 0, rowan: 0, mira: 0 };
    });
  });

  it('rejects round-result without a score row for the current round', () => {
    const roundResult = phaseFixtures().find(({ phase }) => phase === 'round-result');
    if (roundResult === undefined) {
      throw new Error('No round-result fixture found.');
    }

    expectInvalidMutation(roundResult, (value) => {
      value.roundScores = [];
    });
  });

  it('rejects a current round score with mismatched trump or scoring delta', () => {
    const roundResult = phaseFixtures().find(({ phase }) => phase === 'round-result');
    if (roundResult === undefined) {
      throw new Error('No round-result fixture found.');
    }

    expectInvalidMutation(roundResult, (value) => {
      const rows = value.roundScores as Array<Record<string, unknown>>;
      rows.at(-1)!.trump = null;
    });

    expectInvalidMutation(roundResult, (value) => {
      const rows = value.roundScores as Array<Record<string, unknown>>;
      const players = rows.at(-1)!.players as Array<Record<string, unknown>>;
      players[0].delta = 10;
    });
  });

  it('returns missing when no record exists', () => {
    expect(loadGame(new MemoryStorage())).toEqual({ ok: false, reason: 'missing' });
  });

  it('removes invalid JSON and reports it as invalid', () => {
    const storage = new MemoryStorage('{broken');

    expect(loadGame(storage)).toEqual({ ok: false, reason: 'invalid' });
    expect(storage.removedKeys).toEqual([SAVE_KEY]);
    expect(storage.values.has(SAVE_KEY)).toBe(false);
  });

  it('removes records with an unknown schema version', () => {
    const value = serialized();
    value.schemaVersion = 2;
    const storage = new MemoryStorage(JSON.stringify(value));

    expect(loadGame(storage)).toEqual({ ok: false, reason: 'invalid' });
    expect(storage.removedKeys).toEqual([SAVE_KEY]);
  });

  it.each([
    ['null', 'null'],
    ['a primitive', '12'],
    ['an array', '[]'],
  ])('rejects and removes %s payloads', (_label, value) => {
    const storage = new MemoryStorage(value);

    expect(loadGame(storage)).toEqual({ ok: false, reason: 'invalid' });
    expect(storage.removedKeys).toEqual([SAVE_KEY]);
  });

  it.each([
    [
      'a missing field',
      (value: Record<string, unknown>) => {
        delete value.events;
      },
    ],
    [
      'a missing player key',
      (value: Record<string, unknown>) => {
        delete (value.hands as Record<string, unknown>).mira;
      },
    ],
    [
      'an invalid phase',
      (value: Record<string, unknown>) => {
        value.phase = 'paused';
      },
    ],
    [
      'an invalid player ID',
      (value: Record<string, unknown>) => {
        value.dealerId = 'stranger';
      },
    ],
    [
      'a bad RNG state',
      (value: Record<string, unknown>) => {
        (value.rng as Record<string, unknown>).value = -1;
      },
    ],
    [
      'an impossible score',
      (value: Record<string, unknown>) => {
        (value.scores as Record<string, unknown>).human = 9_999;
      },
    ],
    [
      'a noncanonical card shape',
      (value: Record<string, unknown>) => {
        const drawPile = value.drawPile as Array<Record<string, unknown>>;
        drawPile[0] = { ...drawPile[0], kind: 'wizard' };
      },
    ],
    [
      'a duplicate card ID',
      (value: Record<string, unknown>) => {
        const drawPile = value.drawPile as Array<Record<string, unknown>>;
        drawPile[0] = { ...drawPile[1] };
      },
    ],
    [
      'a 59-card partition',
      (value: Record<string, unknown>) => {
        (value.drawPile as unknown[]).pop();
      },
    ],
  ])('rejects and removes %s', (_label, corrupt) => {
    const value = serialized();
    corrupt(value);
    const storage = new MemoryStorage(JSON.stringify(value));

    expect(loadGame(storage)).toEqual({ ok: false, reason: 'invalid' });
    expect(storage.removedKeys).toEqual([SAVE_KEY]);
  });

  it('reports unavailable when reading storage throws', () => {
    const storage = new MemoryStorage();
    storage.throwOnGet = true;

    expect(loadGame(storage)).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('reports unavailable when writing storage throws', () => {
    const storage = new MemoryStorage();
    storage.throwOnSet = true;

    expect(saveGame(storage, createMatch(42))).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('keeps invalid-load cleanup failures inside the boundary', () => {
    const storage = new MemoryStorage('{broken');
    storage.throwOnRemove = true;

    expect(loadGame(storage)).toEqual({ ok: false, reason: 'invalid' });
    expect(storage.removedKeys).toEqual([SAVE_KEY]);
  });

  it('clears rather than persists a completed match', () => {
    const storage = new MemoryStorage(JSON.stringify(createMatch(1)));
    const complete: GameState = { ...createMatch(42), phase: 'match-result' };

    expect(saveGame(storage, complete)).toEqual({ ok: true });
    expect(storage.removedKeys).toEqual([SAVE_KEY]);
    expect(storage.values.has(SAVE_KEY)).toBe(false);
  });

  it('rejects and removes a loaded completed match', () => {
    const complete: GameState = { ...dealtState(), phase: 'match-result', activePlayerId: null };
    const storage = new MemoryStorage(JSON.stringify(complete));

    expect(loadGame(storage)).toEqual({ ok: false, reason: 'invalid' });
    expect(storage.removedKeys).toEqual([SAVE_KEY]);
  });

  it('clears the save successfully', () => {
    const storage = new MemoryStorage(JSON.stringify(createMatch(42)));

    expect(clearGame(storage)).toEqual({ ok: true });
    expect(storage.removedKeys).toEqual([SAVE_KEY]);
    expect(storage.values.has(SAVE_KEY)).toBe(false);
  });

  it('reports unavailable when explicit clearing throws', () => {
    const storage = new MemoryStorage();
    storage.throwOnRemove = true;

    expect(clearGame(storage)).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('does not mutate the input state while saving', () => {
    const state = dealtState();
    const before = structuredClone(state);

    expect(saveGame(new MemoryStorage(), state)).toEqual({ ok: true });
    expect(state).toEqual(before);
  });
});
