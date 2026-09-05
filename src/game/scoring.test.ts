import { describe, expect, it } from 'vitest';
import { scoreRound } from './scoring';

describe('scoreRound', () => {
  it.each([
    [0, 0, 20],
    [1, 1, 30],
    [5, 5, 70],
    [0, 2, -20],
    [4, 2, -20],
    [2, 3, -10],
  ])('scores bid %i with %i tricks as %i', (bid, tricks, expected) => {
    expect(scoreRound(bid, tricks)).toBe(expected);
  });

  it.each([
    [-1, 0],
    [0, -1],
    [1.5, 1],
    [1, 0.5],
  ])('rejects invalid bid %s or trick count %s', (bid, tricks) => {
    expect(() => scoreRound(bid, tricks)).toThrow(/non-negative integers/i);
  });
});
