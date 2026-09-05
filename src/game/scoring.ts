export function scoreRound(bid: number, tricks: number): number {
  if (!Number.isInteger(bid) || bid < 0 || !Number.isInteger(tricks) || tricks < 0) {
    throw new RangeError('Bid and tricks must be non-negative integers.');
  }

  return bid === tricks ? 20 + 10 * bid : -10 * Math.abs(tricks - bid);
}
