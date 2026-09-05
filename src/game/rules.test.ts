import { describe, expect, it } from 'vitest';
import { legalCards, ledSuit, winningPlay, type Play } from './rules';
import type { Card, Rank, Suit } from './types';

const suited = (id: string, suit: Suit, rank: Rank): Card => ({
  id,
  kind: 'suited',
  suit,
  rank,
});

const wizard = (id: string): Card => ({ id, kind: 'wizard' });
const jester = (id: string): Card => ({ id, kind: 'jester' });
const play = (card: Card, index = 0): Play => ({ playerId: `player-${index + 1}`, card });
const cardIds = (cards: readonly Card[]) => cards.map((card) => card.id);

describe('legalCards', () => {
  const hand = [
    suited('hearts-2', 'hearts', 2),
    suited('hearts-9', 'hearts', 9),
    suited('spades-14', 'spades', 14),
    wizard('wizard-1'),
    jester('jester-1'),
  ];

  it('allows every card when the trick is empty', () => {
    expect(cardIds(legalCards(hand, []))).toEqual(cardIds(hand));
  });

  it('requires led-suit cards while still allowing Wizards and Jesters', () => {
    const plays = [play(suited('hearts-12', 'hearts', 12))];

    expect(cardIds(legalCards(hand, plays))).toEqual(['hearts-2', 'hearts-9', 'wizard-1', 'jester-1']);
  });

  it('allows every card when the player is void in the led suit', () => {
    const voidHand = [suited('spades-14', 'spades', 14), wizard('wizard-1'), jester('jester-1')];
    const plays = [play(suited('hearts-12', 'hearts', 12))];

    expect(cardIds(legalCards(voidHand, plays))).toEqual(cardIds(voidHand));
  });

  it('keeps the trick unrestricted while only Jesters have led', () => {
    const plays = [play(jester('jester-1')), play(jester('jester-2'), 1)];

    expect(ledSuit(plays)).toBeNull();
    expect(cardIds(legalCards(hand, plays))).toEqual(cardIds(hand));
  });

  it('establishes a suit after leading Jesters when a normal card is played', () => {
    const plays = [play(jester('jester-1')), play(suited('hearts-12', 'hearts', 12), 1)];

    expect(ledSuit(plays)).toBe('hearts');
    expect(cardIds(legalCards(hand, plays))).toEqual(['hearts-2', 'hearts-9', 'wizard-1', 'jester-1']);
  });

  it('keeps the trick unrestricted after a Wizard appears before any suited card', () => {
    const plays = [
      play(jester('jester-1')),
      play(wizard('wizard-1'), 1),
      play(suited('hearts-12', 'hearts', 12), 2),
    ];

    expect(ledSuit(plays)).toBeNull();
    expect(cardIds(legalCards(hand, plays))).toEqual(cardIds(hand));
  });
});

describe('winningPlay', () => {
  it('selects the first Wizard, including when multiple Wizards are played', () => {
    const plays = [
      play(suited('hearts-14', 'hearts', 14)),
      play(wizard('wizard-1'), 1),
      play(wizard('wizard-2'), 2),
      play(suited('spades-14', 'spades', 14), 3),
    ];

    expect(winningPlay(plays, 'spades').card.id).toBe('wizard-1');
  });

  it('selects the highest trump when no Wizard appears', () => {
    const plays = [
      play(suited('hearts-14', 'hearts', 14)),
      play(suited('spades-2', 'spades', 2), 1),
      play(suited('spades-10', 'spades', 10), 2),
      play(suited('hearts-13', 'hearts', 13), 3),
    ];

    expect(winningPlay(plays, 'spades').card.id).toBe('spades-10');
  });

  it('selects the highest led-suit card when there is no Wizard or trump', () => {
    const plays = [
      play(suited('hearts-9', 'hearts', 9)),
      play(suited('hearts-14', 'hearts', 14), 1),
      play(suited('clubs-14', 'clubs', 14), 2),
      play(suited('hearts-2', 'hearts', 2), 3),
    ];

    expect(winningPlay(plays, 'spades').card.id).toBe('hearts-14');
  });

  it('selects the first Jester when every play is a Jester', () => {
    const plays = [
      play(jester('jester-2')),
      play(jester('jester-1'), 1),
      play(jester('jester-3'), 2),
      play(jester('jester-4'), 3),
    ];

    expect(winningPlay(plays, 'spades').card.id).toBe('jester-2');
  });

  it('rejects an empty trick with a descriptive error', () => {
    expect(() => winningPlay([], null)).toThrow(/empty trick/i);
  });
});
