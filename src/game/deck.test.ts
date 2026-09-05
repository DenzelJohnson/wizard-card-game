import { describe, expect, it } from 'vitest';
import { createDeck, createRng, nextRandom, shuffle } from './deck';

describe('Wizard deck', () => {
  it('creates 60 uniquely identified cards with four Wizards and four Jesters', () => {
    const deck = createDeck();

    expect(deck).toHaveLength(60);
    expect(new Set(deck.map((card) => card.id)).size).toBe(60);
    expect(deck.filter((card) => card.kind === 'wizard')).toHaveLength(4);
    expect(deck.filter((card) => card.kind === 'jester')).toHaveLength(4);
  });

  it('shuffles repeatably from the same seed without mutating the deck', () => {
    const deck = createDeck();
    const originalIds = deck.map((card) => card.id);
    const rng = createRng(42);
    const first = shuffle(deck, rng);
    const second = shuffle(deck, createRng(42));

    expect(first.cards).toHaveLength(60);
    expect(first.cards.map((card) => card.id)).toEqual(second.cards.map((card) => card.id));
    expect(first.cards.map((card) => card.id).sort()).toEqual([...originalIds].sort());
    expect(deck.map((card) => card.id)).toEqual(originalIds);
    expect(first.cards).not.toBe(deck);
    expect(first.rng).not.toEqual(rng);
    expect(first.rng).toEqual({ value: 688200609 });
    expect(rng).toEqual(createRng(42));
  });
});

describe('deterministic RNG', () => {
  it('normalizes a zero seed to a nonzero state', () => {
    expect(createRng(0).value).not.toBe(0);
  });

  it('returns values in the half-open unit interval', () => {
    let state = createRng(42);

    for (let index = 0; index < 20; index += 1) {
      const next = nextRandom(state);
      expect(next.value).toBeGreaterThanOrEqual(0);
      expect(next.value).toBeLessThan(1);
      state = next.state;
    }
  });

  it('advances state without mutating its input', () => {
    const state = createRng(42);
    const { state: nextState } = nextRandom(state);

    expect(nextState).not.toBe(state);
    expect(nextState.value).not.toBe(state.value);
    expect(state).toEqual(createRng(42));
  });
});
