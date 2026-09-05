import { SUITS, type Card, type Rank, type RngState } from './types';

const RANKS: readonly Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
const DEFAULT_RNG_SEED = 0x6d2b79f5;
const UINT32_RANGE = 0x1_0000_0000;

export function createDeck(): Card[] {
  const suitedCards = SUITS.flatMap((suit) =>
    RANKS.map((rank): Card => ({
      id: `${suit}-${rank}`,
      kind: 'suited',
      suit,
      rank,
    })),
  );
  const wizards = Array.from({ length: 4 }, (_, index): Card => ({
    id: `wizard-${index + 1}`,
    kind: 'wizard',
  }));
  const jesters = Array.from({ length: 4 }, (_, index): Card => ({
    id: `jester-${index + 1}`,
    kind: 'jester',
  }));

  return [...suitedCards, ...wizards, ...jesters];
}

export function createRng(seed: number): RngState {
  const normalizedSeed = seed >>> 0;

  return { value: normalizedSeed === 0 ? DEFAULT_RNG_SEED : normalizedSeed };
}

/**
 * Advances a Mulberry32 state and produces a deterministic value in [0, 1).
 * The nonzero default seed keeps createRng(0) reproducible without a zero state.
 */
export function nextRandom(state: RngState): { value: number; state: RngState } {
  const nextSeed = (state.value + DEFAULT_RNG_SEED) >>> 0;
  let mixed = nextSeed;

  mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
  mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);

  return {
    value: ((mixed ^ (mixed >>> 14)) >>> 0) / UINT32_RANGE,
    state: { value: nextSeed },
  };
}

export function shuffle(cards: readonly Card[], state: RngState): { cards: Card[]; rng: RngState } {
  const shuffledCards = [...cards];
  let rng = state;

  for (let index = shuffledCards.length - 1; index > 0; index -= 1) {
    const next = nextRandom(rng);
    rng = next.state;
    const swapIndex = Math.floor(next.value * (index + 1));

    [shuffledCards[index], shuffledCards[swapIndex]] = [shuffledCards[swapIndex], shuffledCards[index]];
  }

  return { cards: shuffledCards, rng };
}
