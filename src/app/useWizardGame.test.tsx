import { StrictMode, type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { chooseEasyAction } from '../ai/easy';
import { createMatch, legalActions, reduceGame } from '../game/state';
import type { GameState } from '../game/types';
import { SAVE_KEY, type StorageLike } from '../storage/save';
import { useWizardGame, type MotionQueryLike } from './useWizardGame';

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>();
  readonly removedKeys: string[] = [];
  readonly writtenValues: string[] = [];
  getAttempts = 0;
  setAttempts = 0;
  removeAttempts = 0;
  throwOnGet = false;
  throwOnSet = false;
  throwOnRemove = false;

  constructor(state?: GameState | string) {
    if (typeof state === 'string') {
      this.values.set(SAVE_KEY, state);
    } else if (state !== undefined) {
      this.values.set(SAVE_KEY, JSON.stringify(state));
    }
  }

  getItem(key: string): string | null {
    this.getAttempts += 1;
    if (this.throwOnGet) {
      throw new Error('storage read blocked');
    }

    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.setAttempts += 1;
    if (this.throwOnSet) {
      throw new Error('storage write blocked');
    }

    this.values.set(key, value);
    this.writtenValues.push(value);
  }

  removeItem(key: string): void {
    this.removeAttempts += 1;
    this.removedKeys.push(key);
    if (this.throwOnRemove) {
      throw new Error('storage removal blocked');
    }

    this.values.delete(key);
  }
}

class MotionQuery implements MotionQueryLike {
  matches: boolean;
  readonly listeners = new Set<(event: { matches: boolean }) => void>();

  constructor(matches: boolean) {
    this.matches = matches;
  }

  addEventListener(_type: 'change', listener: (event: { matches: boolean }) => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: 'change', listener: (event: { matches: boolean }) => void): void {
    this.listeners.delete(listener);
  }

  change(matches: boolean): void {
    this.matches = matches;
    for (const listener of this.listeners) {
      listener({ matches });
    }
  }
}

const strictWrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>;

function reachableState(predicate: (state: GameState) => boolean): GameState {
  let state = createMatch(20_260_905);

  for (let transition = 0; transition <= 1_200; transition += 1) {
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

function humanDecisionState(): GameState {
  return reachableState(
    (state) =>
      state.activePlayerId === 'human' &&
      (state.phase === 'choose-trump' || state.phase === 'bidding' || state.phase === 'playing'),
  );
}

function computerDecisionState(): GameState {
  return reachableState(
    (state) =>
      state.activePlayerId !== null &&
      state.activePlayerId !== 'human' &&
      (state.phase === 'choose-trump' || state.phase === 'bidding' || state.phase === 'playing'),
  );
}

function computerDecisionBeforeHumanState(): GameState {
  return reachableState((state) => {
    const choice = chooseEasyAction(state);
    if (choice === null) {
      return false;
    }

    const next = reduceGame({ ...state, rng: choice.rng }, choice.action);
    return (
      next.activePlayerId === 'human' &&
      (next.phase === 'choose-trump' || next.phase === 'bidding' || next.phase === 'playing')
    );
  });
}

function trickResultState(): GameState {
  return reachableState((state) => state.phase === 'trick-result');
}

function roundResultState(round = 1): GameState {
  return reachableState((state) => state.phase === 'round-result' && state.round === round);
}

function seedForHumanDecision(): number {
  for (let seed = 1; seed <= 10_000; seed += 1) {
    const state = reduceGame(createMatch(seed), { type: 'DEAL_ROUND' });
    if (
      state.activePlayerId === 'human' &&
      (state.phase === 'choose-trump' || state.phase === 'bidding' || state.phase === 'playing')
    ) {
      return seed;
    }
  }

  throw new Error('No deterministic human-turn seed found.');
}

describe('useWizardGame', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads one valid resume candidate but stays home until continuing the exact state', () => {
    const saved = humanDecisionState();
    const storage = new MemoryStorage(saved);
    const { result } = renderHook(() => useWizardGame({ storage }), { wrapper: strictWrapper });

    expect(storage.getAttempts).toBe(1);
    expect(result.current.hasSavedGame).toBe(true);
    expect(result.current.screen).toBe('home');
    expect(result.current.state).toBeNull();

    act(() => result.current.continueGame());

    expect(result.current.screen).toBe('game');
    expect(result.current.state).toEqual(saved);
    expect(storage.setAttempts).toBe(0);
  });

  it('treats missing and invalid saves as unavailable to continue without a warning', () => {
    const missing = new MemoryStorage();
    const invalid = new MemoryStorage('{not-json');
    const missingHook = renderHook(() => useWizardGame({ storage: missing }));
    const invalidHook = renderHook(() => useWizardGame({ storage: invalid }));

    expect(missingHook.result.current.hasSavedGame).toBe(false);
    expect(missingHook.result.current.storageWarning).toBe(false);
    expect(invalidHook.result.current.hasSavedGame).toBe(false);
    expect(invalidHook.result.current.storageWarning).toBe(false);
    expect(invalid.removedKeys).toEqual([SAVE_KEY]);

    act(() => invalidHook.result.current.continueGame());
    expect(invalidHook.result.current.state).toBeNull();
    expect(invalidHook.result.current.screen).toBe('home');
  });

  it('reports unavailable storage reads without creating a resume candidate', () => {
    const storage = new MemoryStorage();
    storage.throwOnGet = true;

    const { result } = renderHook(() => useWizardGame({ storage }));

    expect(result.current.hasSavedGame).toBe(false);
    expect(result.current.storageWarning).toBe(true);
    expect(result.current.state).toBeNull();
  });

  it('starts and auto-deals a seeded match, replacing the loaded candidate and using the seed factory', () => {
    const storage = new MemoryStorage(humanDecisionState());
    const seedFactory = vi.fn(() => 0);
    const { result } = renderHook(() => useWizardGame({ storage, seedFactory }));

    act(() => result.current.startGame());

    const expected = reduceGame(createMatch(0), { type: 'DEAL_ROUND' });
    expect(seedFactory).toHaveBeenCalledTimes(1);
    expect(result.current.screen).toBe('game');
    expect(result.current.state).toEqual(expected);
    expect(result.current.state?.rng.value).not.toBe(0);
    expect(storage.setAttempts).toBe(2);
    expect(JSON.parse(storage.values.get(SAVE_KEY) ?? '')).toEqual(expected);

    const replacement = result.current.state;
    act(() => result.current.continueGame());
    expect(result.current.state).toBe(replacement);
  });

  it('uses an explicit seed without calling the default seed factory', () => {
    const storage = new MemoryStorage();
    const seedFactory = vi.fn(() => 99);
    const { result } = renderHook(() => useWizardGame({ storage, seedFactory }));

    act(() => result.current.startGame(42));

    expect(seedFactory).not.toHaveBeenCalled();
    expect(result.current.state).toEqual(reduceGame(createMatch(42), { type: 'DEAL_ROUND' }));
  });

  it('accepts a current legal human action, persists it once, and rejects illegal or stale actions', () => {
    const saved = humanDecisionState();
    const storage = new MemoryStorage(saved);
    const { result } = renderHook(() => useWizardGame({ storage }));
    act(() => result.current.continueGame());
    const current = result.current.state as GameState;
    const action = legalActions(current)[0];
    const expected = reduceGame(current, action);

    act(() => result.current.dispatchHuman({ type: 'ACKNOWLEDGE_TRICK' }));
    expect(result.current.state).toBe(current);
    expect(storage.setAttempts).toBe(0);

    act(() => result.current.dispatchHuman(action));
    expect(result.current.state).toEqual(expected);
    expect(storage.setAttempts).toBe(1);

    const transitioned = result.current.state;
    act(() => result.current.dispatchHuman(action));
    expect(result.current.state).toBe(transitioned);
    expect(storage.setAttempts).toBe(1);
  });

  it('does not let the human dispatcher drive a computer decision', () => {
    const saved = computerDecisionState();
    const storage = new MemoryStorage(saved);
    const { result } = renderHook(() => useWizardGame({ storage }));
    act(() => result.current.continueGame());
    const current = result.current.state as GameState;

    act(() => result.current.dispatchHuman(legalActions(current)[0]));

    expect(result.current.state).toBe(current);
    expect(storage.setAttempts).toBe(0);
  });

  it('runs exactly one Easy decision at 450ms in StrictMode and persists its consumed RNG', () => {
    const saved = computerDecisionState();
    const storage = new MemoryStorage(saved);
    const { result } = renderHook(() => useWizardGame({ storage }), { wrapper: strictWrapper });
    act(() => result.current.continueGame());
    const current = result.current.state as GameState;
    const choice = chooseEasyAction(current);
    if (choice === null) {
      throw new Error('Expected an Easy decision fixture.');
    }
    const expected = reduceGame({ ...current, rng: choice.rng }, choice.action);

    expect(vi.getTimerCount()).toBe(1);
    act(() => vi.advanceTimersByTime(449));
    expect(result.current.state).toBe(current);
    expect(storage.setAttempts).toBe(0);

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.state).toEqual(expected);
    expect(result.current.state?.rng).toEqual(choice.rng);
    expect(storage.setAttempts).toBe(1);
  });

  it('keeps a trick result visible for 900ms before acknowledging and persisting it', () => {
    const saved = trickResultState();
    const storage = new MemoryStorage(saved);
    const { result } = renderHook(() => useWizardGame({ storage }));
    act(() => result.current.continueGame());
    const current = result.current.state as GameState;

    act(() => vi.advanceTimersByTime(899));
    expect(result.current.state).toBe(current);
    expect(storage.setAttempts).toBe(0);

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.state).toEqual(reduceGame(current, { type: 'ACKNOWLEDGE_TRICK' }));
    expect(storage.setAttempts).toBe(1);
  });

  it('uses a zero delay when reduced motion initially matches', () => {
    const saved = trickResultState();
    const storage = new MemoryStorage(saved);
    const motion = new MotionQuery(true);
    const { result } = renderHook(() => useWizardGame({ storage, matchMedia: () => motion }));
    act(() => result.current.continueGame());
    const current = result.current.state as GameState;

    expect(result.current.state).toBe(current);
    act(() => vi.advanceTimersByTime(0));

    expect(result.current.state).toEqual(reduceGame(current, { type: 'ACKNOWLEDGE_TRICK' }));
  });

  it('also reduces a computer decision delay to zero', () => {
    const saved = computerDecisionBeforeHumanState();
    const storage = new MemoryStorage(saved);
    const motion = new MotionQuery(true);
    const { result } = renderHook(() => useWizardGame({ storage, matchMedia: () => motion }));
    act(() => result.current.continueGame());
    const current = result.current.state as GameState;
    const choice = chooseEasyAction(current);
    if (choice === null) {
      throw new Error('Expected an Easy decision fixture.');
    }
    const expected = reduceGame({ ...current, rng: choice.rng }, choice.action);

    act(() => vi.advanceTimersByTime(0));

    expect(result.current.state).toEqual(expected);
    expect(storage.setAttempts).toBe(1);
  });

  it('reacts to reduced-motion changes and removes its listener on unmount', () => {
    const saved = trickResultState();
    const motion = new MotionQuery(false);
    const { result, unmount } = renderHook(() =>
      useWizardGame({ storage: new MemoryStorage(saved), matchMedia: () => motion }),
    );
    act(() => result.current.continueGame());
    const current = result.current.state as GameState;

    expect(motion.listeners.size).toBe(1);
    act(() => motion.change(true));
    act(() => vi.advanceTimersByTime(0));
    expect(result.current.state).toEqual(reduceGame(current, { type: 'ACKNOWLEDGE_TRICK' }));

    unmount();
    expect(motion.listeners.size).toBe(0);
  });

  it('holds a round result until acknowledgeRound advances it through automatic setup', () => {
    const saved = roundResultState();
    const storage = new MemoryStorage(saved);
    const { result } = renderHook(() => useWizardGame({ storage }));
    act(() => result.current.continueGame());
    const current = result.current.state as GameState;

    act(() => vi.runAllTimers());
    expect(result.current.state).toBe(current);
    expect(storage.setAttempts).toBe(0);

    const roundSetup = reduceGame(current, { type: 'ACKNOWLEDGE_ROUND' });
    const expected = reduceGame(roundSetup, { type: 'DEAL_ROUND' });
    act(() => result.current.acknowledgeRound());

    expect(result.current.state).toEqual(expected);
    expect(storage.setAttempts).toBe(2);
  });

  it('cancels a pending computer timer on unmount', () => {
    const storage = new MemoryStorage(computerDecisionState());
    const { result, unmount } = renderHook(() => useWizardGame({ storage }));
    act(() => result.current.continueGame());

    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.runAllTimers());
    expect(storage.setAttempts).toBe(0);
  });

  it('does not apply a stale computer callback to a replacement match', () => {
    const storage = new MemoryStorage(computerDecisionState());
    const { result } = renderHook(() => useWizardGame({ storage }));
    act(() => result.current.continueGame());
    expect(vi.getTimerCount()).toBe(1);

    act(() => result.current.startGame(seedForHumanDecision()));
    const replacement = result.current.state;
    const saveAttempts = storage.setAttempts;
    expect(replacement?.activePlayerId).toBe('human');

    act(() => vi.advanceTimersByTime(450));
    expect(result.current.state).toBe(replacement);
    expect(storage.setAttempts).toBe(saveAttempts);
  });

  it('does not apply a stale trick acknowledgement to a replacement match', () => {
    const storage = new MemoryStorage(trickResultState());
    const { result } = renderHook(() => useWizardGame({ storage }));
    act(() => result.current.continueGame());
    expect(vi.getTimerCount()).toBe(1);

    act(() => result.current.startGame(seedForHumanDecision()));
    const replacement = result.current.state;
    const saveAttempts = storage.setAttempts;

    act(() => vi.advanceTimersByTime(900));
    expect(result.current.state).toBe(replacement);
    expect(storage.setAttempts).toBe(saveAttempts);
  });

  it('keeps a new match playable in memory when storage writes fail', () => {
    const storage = new MemoryStorage();
    storage.throwOnSet = true;
    const { result } = renderHook(() => useWizardGame({ storage }));

    act(() => result.current.startGame(seedForHumanDecision()));

    expect(result.current.screen).toBe('game');
    expect(result.current.state).not.toBeNull();
    expect(result.current.state?.phase).not.toBe('round-setup');
    expect(result.current.storageWarning).toBe(true);
    expect(result.current.hasSavedGame).toBe(false);
    expect(storage.setAttempts).toBe(2);
  });

  it('clears a transient warning after a later state save succeeds', () => {
    const storage = new MemoryStorage();
    storage.throwOnSet = true;
    const { result } = renderHook(() => useWizardGame({ storage }));

    act(() => result.current.startGame(seedForHumanDecision()));
    expect(result.current.storageWarning).toBe(true);

    storage.throwOnSet = false;
    act(() => result.current.startGame(seedForHumanDecision()));

    expect(result.current.storageWarning).toBe(false);
    expect(result.current.hasSavedGame).toBe(true);
  });

  it('abandons to home, clears the candidate, and clears an old warning after successful removal', () => {
    const storage = new MemoryStorage(humanDecisionState());
    storage.throwOnSet = true;
    const { result } = renderHook(() => useWizardGame({ storage }));
    act(() => result.current.continueGame());
    act(() => result.current.dispatchHuman(legalActions(result.current.state as GameState)[0]));
    expect(result.current.storageWarning).toBe(true);
    storage.throwOnSet = false;

    act(() => result.current.abandonGame());

    expect(result.current.screen).toBe('home');
    expect(result.current.state).toBeNull();
    expect(result.current.hasSavedGame).toBe(false);
    expect(result.current.storageWarning).toBe(false);
    expect(storage.values.has(SAVE_KEY)).toBe(false);
    act(() => result.current.continueGame());
    expect(result.current.state).toBeNull();
  });

  it('still abandons in memory and warns when clearing storage fails', () => {
    const storage = new MemoryStorage(humanDecisionState());
    storage.throwOnRemove = true;
    const { result } = renderHook(() => useWizardGame({ storage }));
    act(() => result.current.continueGame());

    act(() => result.current.abandonGame());

    expect(result.current.screen).toBe('home');
    expect(result.current.state).toBeNull();
    expect(result.current.hasSavedGame).toBe(false);
    expect(result.current.storageWarning).toBe(true);
  });

  it('clears the resumable save when the final round is acknowledged', () => {
    const saved = roundResultState(15);
    const storage = new MemoryStorage(saved);
    const { result } = renderHook(() => useWizardGame({ storage }));
    act(() => result.current.continueGame());

    act(() => result.current.acknowledgeRound());

    expect(result.current.state?.phase).toBe('match-result');
    expect(result.current.hasSavedGame).toBe(false);
    expect(storage.values.has(SAVE_KEY)).toBe(false);
    expect(storage.removeAttempts).toBe(1);
  });

  it('keeps the completed match visible and warns when its save cannot be cleared', () => {
    const saved = roundResultState(15);
    const storage = new MemoryStorage(saved);
    storage.throwOnRemove = true;
    const { result } = renderHook(() => useWizardGame({ storage }));
    act(() => result.current.continueGame());

    act(() => result.current.acknowledgeRound());
    const completed = result.current.state;

    expect(completed?.phase).toBe('match-result');
    expect(result.current.hasSavedGame).toBe(false);
    expect(result.current.storageWarning).toBe(true);
    expect(storage.values.has(SAVE_KEY)).toBe(true);

    act(() => result.current.acknowledgeRound());
    act(() => vi.runAllTimers());
    expect(result.current.state).toBe(completed);
    expect(storage.removeAttempts).toBe(1);
  });

  it('exposes engine legal actions only for the active game state', () => {
    const storage = new MemoryStorage(humanDecisionState());
    const { result } = renderHook(() => useWizardGame({ storage }));

    expect(result.current.legalActions).toEqual([]);
    act(() => result.current.continueGame());
    expect(result.current.legalActions).toEqual(legalActions(result.current.state as GameState));

    act(() => result.current.abandonGame());
    expect(result.current.legalActions).toEqual([]);
  });
});
