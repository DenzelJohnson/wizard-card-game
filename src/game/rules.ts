import type { Card, Suit } from './types';

export interface Play {
  playerId: string;
  card: Card;
}

export function ledSuit(plays: readonly Play[]): Suit | null {
  for (const { card } of plays) {
    if (card.kind === 'wizard') {
      return null;
    }

    if (card.kind === 'suited') {
      return card.suit;
    }
  }

  return null;
}

export function legalCards(hand: readonly Card[], plays: readonly Play[]): Card[] {
  const suit = ledSuit(plays);

  if (suit === null || !hand.some((card) => card.kind === 'suited' && card.suit === suit)) {
    return [...hand];
  }

  return hand.filter((card) => card.kind !== 'suited' || card.suit === suit);
}

export function winningPlay(plays: readonly Play[], trump: Suit | null): Play {
  if (plays.length === 0) {
    throw new Error('Cannot determine a winner for an empty trick.');
  }

  const firstWizard = plays.find((play) => play.card.kind === 'wizard');

  if (firstWizard !== undefined) {
    return firstWizard;
  }

  const highestTrump = highestSuitedPlay(plays, trump);

  if (highestTrump !== undefined) {
    return highestTrump;
  }

  const highestLedSuit = highestSuitedPlay(plays, ledSuit(plays));

  return highestLedSuit ?? plays[0];
}

function highestSuitedPlay(plays: readonly Play[], suit: Suit | null): Play | undefined {
  if (suit === null) {
    return undefined;
  }

  return plays.reduce<Play | undefined>((highest, play) => {
    if (play.card.kind !== 'suited' || play.card.suit !== suit) {
      return highest;
    }

    if (highest === undefined || highest.card.kind !== 'suited' || play.card.rank > highest.card.rank) {
      return play;
    }

    return highest;
  }, undefined);
}
