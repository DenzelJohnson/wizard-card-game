export const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'] as const;

export type Suit = (typeof SUITS)[number];
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export type Card =
  | { id: string; kind: 'suited'; suit: Suit; rank: Rank }
  | { id: string; kind: 'wizard' }
  | { id: string; kind: 'jester' };

export interface RngState {
  value: number;
}
