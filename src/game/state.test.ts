import { describe, expect, it } from 'vitest';
import { createDeck, createRng, shuffle } from './deck';
import { winningPlay } from './rules';
import { EVENT_LIMIT, createMatch, legalActions, matchWinners, reduceGame } from './state';
import {
  PLAYERS,
  PLAYER_IDS,
  SUITS,
  type Card,
  type GameState,
  type PlayerId,
  type Rank,
  type Suit,
} from './types';

const nextPlayer = (playerId: PlayerId): PlayerId =>
  PLAYER_IDS[(PLAYER_IDS.indexOf(playerId) + 1) % PLAYER_IDS.length];

const allDealtCardIds = (state: GameState): string[] => [
  ...PLAYER_IDS.flatMap((playerId) => state.hands[playerId].map(({ id }) => id)),
  ...(state.revealedUpCard === null ? [] : [state.revealedUpCard.id]),
  ...state.drawPile.map(({ id }) => id),
];

function roundOneWithUpCard(kind: 'suited' | 'wizard' | 'jester'): GameState {
  for (let seed = 1; seed <= 10_000; seed += 1) {
    const state = reduceGame(createMatch(seed), { type: 'DEAL_ROUND' });

    if (state.revealedUpCard?.kind === kind) {
      return state;
    }
  }

  throw new Error(`Could not find a deterministic ${kind} up-card fixture.`);
}

function dealtRound(round: number, seed = 42): GameState {
  const dealt = reduceGame({ ...createMatch(seed), round }, { type: 'DEAL_ROUND' });

  return dealt.phase === 'choose-trump'
    ? reduceGame(dealt, { type: 'CHOOSE_TRUMP', playerId: dealt.dealerId, suit: 'hearts' })
    : dealt;
}

function finishBidding(state: GameState, bids: readonly number[] = []): GameState {
  let next = state;
  let index = 0;

  while (next.phase === 'bidding') {
    next = reduceGame(next, {
      type: 'PLACE_BID',
      playerId: next.activePlayerId as PlayerId,
      bid: bids[index] ?? 0,
    });
    index += 1;
  }

  return next;
}

function playTrick(state: GameState): GameState {
  let next = state;

  while (next.phase === 'playing' && next.currentTrick.length < PLAYER_IDS.length) {
    const action = legalActions(next)[0];

    if (action?.type !== 'PLAY_CARD') {
      throw new Error('Expected a legal card play.');
    }

    next = reduceGame(next, action);
  }

  return next;
}

const suited = (id: string, suit: Suit, rank: Rank): Card => ({ id, kind: 'suited', suit, rank });

function scoreOneCardRound(): GameState {
  const result = playTrick(finishBidding(dealtRound(1), [0, 0, 0, 0]));

  return reduceGame(result, { type: 'ACKNOWLEDGE_TRICK' });
}

describe('createMatch', () => {
  it('creates the same serializable initial match from the same seed', () => {
    const first = createMatch(42);
    const second = createMatch(42);

    expect(first).toEqual(second);
    expect(first.matchId).toBe(second.matchId);
    expect(first.schemaVersion).toBe(1);
    expect(first.difficulty).toBe('easy');
    expect(first.players).toEqual(PLAYERS);
    expect(first.round).toBe(1);
    expect(first.phase).toBe('round-setup');
    expect(first.activePlayerId).toBeNull();
    expect(PLAYER_IDS).toContain(first.dealerId);
    expect(first.rng).not.toEqual(createRng(42));
    expect(first.hands).toEqual({ human: [], ember: [], rowan: [], mira: [] });
    expect(first.bids).toEqual([]);
    expect(first.currentTrick).toEqual([]);
    expect(first.completedTricks).toEqual([]);
    expect(first.tricksWon).toEqual({ human: 0, ember: 0, rowan: 0, mira: 0 });
    expect(first.scores).toEqual({ human: 0, ember: 0, rowan: 0, mira: 0 });
    expect(first.roundScores).toEqual([]);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
  });

  it('publishes immutable clockwise player metadata with one human', () => {
    expect(PLAYER_IDS).toEqual(['human', 'ember', 'rowan', 'mira']);
    expect(PLAYERS.map(({ name }) => name)).toEqual(['You', 'Ember', 'Rowan', 'Mira']);
    expect(PLAYERS.filter(({ isHuman }) => isHuman).map(({ id }) => id)).toEqual(['human']);
    expect(Object.isFrozen(PLAYER_IDS)).toBe(true);
    expect(Object.isFrozen(PLAYERS)).toBe(true);
    expect(PLAYERS.every(Object.isFrozen)).toBe(true);
  });

  it('allows only dealing during round setup', () => {
    expect(legalActions(createMatch(42))).toEqual([{ type: 'DEAL_ROUND' }]);
  });
});

describe('dealing and trump', () => {
  it('deals round one clockwise from the dealer with all 60 cards accounted for', () => {
    const initial = createMatch(42);
    const snapshot = structuredClone(initial);
    const dealt = reduceGame(initial, { type: 'DEAL_ROUND' });
    const expectedDealOrder = [
      nextPlayer(initial.dealerId),
      nextPlayer(nextPlayer(initial.dealerId)),
      nextPlayer(nextPlayer(nextPlayer(initial.dealerId))),
      initial.dealerId,
    ];
    const shuffled = shuffle(createDeck(), initial.rng).cards;

    expect(dealt).not.toBe(initial);
    expect(initial).toEqual(snapshot);
    expect(PLAYER_IDS.map((playerId) => dealt.hands[playerId])).toSatisfy((hands: unknown[][]) =>
      hands.every((hand) => hand.length === 1),
    );
    expect(expectedDealOrder.map((playerId) => dealt.hands[playerId][0].id)).toEqual(
      shuffled.slice(0, 4).map(({ id }) => id),
    );
    expect(allDealtCardIds(dealt)).toHaveLength(60);
    expect(new Set(allDealtCardIds(dealt)).size).toBe(60);
    expect(reduceGame(dealt, { type: 'DEAL_ROUND' })).toBe(dealt);
  });

  it('deals all 60 cards in round 15 without an up-card or trump', () => {
    const setup: GameState = { ...createMatch(42), round: 15 };
    const dealt = reduceGame(setup, { type: 'DEAL_ROUND' });

    expect(PLAYER_IDS.map((playerId) => dealt.hands[playerId].length)).toEqual([15, 15, 15, 15]);
    expect(dealt.drawPile).toEqual([]);
    expect(dealt.revealedUpCard).toBeNull();
    expect(dealt.trump).toBeNull();
    expect(dealt.phase).toBe('bidding');
    expect(dealt.activePlayerId).toBe(nextPlayer(dealt.dealerId));
    expect(allDealtCardIds(dealt)).toHaveLength(60);
    expect(new Set(allDealtCardIds(dealt)).size).toBe(60);
  });

  it('uses a suited up-card as trump and starts bidding left of the dealer', () => {
    const state = roundOneWithUpCard('suited');

    expect(state.revealedUpCard?.kind).toBe('suited');
    expect(state.trump).toBe(state.revealedUpCard?.kind === 'suited' ? state.revealedUpCard.suit : null);
    expect(state.phase).toBe('bidding');
    expect(state.activePlayerId).toBe(nextPlayer(state.dealerId));
  });

  it('uses no trump for a Jester up-card and starts bidding', () => {
    const state = roundOneWithUpCard('jester');

    expect(state.trump).toBeNull();
    expect(state.phase).toBe('bidding');
    expect(state.activePlayerId).toBe(nextPlayer(state.dealerId));
  });

  it('makes the dealer choose trump after a Wizard up-card', () => {
    const state = roundOneWithUpCard('wizard');

    expect(state.trump).toBeNull();
    expect(state.phase).toBe('choose-trump');
    expect(state.activePlayerId).toBe(state.dealerId);
    expect(legalActions(state)).toEqual(
      SUITS.map((suit) => ({ type: 'CHOOSE_TRUMP', playerId: state.dealerId, suit })),
    );
  });

  it('accepts only the active dealer and a real suit for Wizard trump choice', () => {
    const state = roundOneWithUpCard('wizard');
    const wrongPlayer = nextPlayer(state.dealerId);

    expect(reduceGame(state, { type: 'CHOOSE_TRUMP', playerId: wrongPlayer, suit: 'hearts' })).toBe(state);
    expect(
      reduceGame(state, {
        type: 'CHOOSE_TRUMP',
        playerId: state.dealerId,
        suit: 'stars',
      } as never),
    ).toBe(state);

    const chosen = reduceGame(state, {
      type: 'CHOOSE_TRUMP',
      playerId: state.dealerId,
      suit: 'hearts',
    });

    expect(chosen).not.toBe(state);
    expect(chosen.phase).toBe('bidding');
    expect(chosen.trump).toBe('hearts');
    expect(chosen.activePlayerId).toBe(nextPlayer(state.dealerId));
    expect(state.trump).toBeNull();
  });
});

describe('bidding', () => {
  it('offers every bid and proceeds clockwise from left of dealer through the dealer', () => {
    let state = dealtRound(5);
    const bidderOrder = [
      nextPlayer(state.dealerId),
      nextPlayer(nextPlayer(state.dealerId)),
      nextPlayer(nextPlayer(nextPlayer(state.dealerId))),
      state.dealerId,
    ];
    const bids = [5, 0, 4, 2];

    for (let index = 0; index < bidderOrder.length; index += 1) {
      const playerId = bidderOrder[index];

      expect(state.activePlayerId).toBe(playerId);
      expect(legalActions(state)).toEqual(
        Array.from({ length: 6 }, (_, bid) => ({ type: 'PLACE_BID', playerId, bid })),
      );
      state = reduceGame(state, { type: 'PLACE_BID', playerId, bid: bids[index] });
    }

    expect(state.bids).toEqual(bidderOrder.map((playerId, index) => ({ playerId, bid: bids[index] })));
    expect(state.phase).toBe('playing');
    expect(state.activePlayerId).toBe(bidderOrder[0]);
  });

  it('rejects stale, fractional, negative, and over-round bids without allocating state', () => {
    const state = dealtRound(3);
    const activePlayerId = state.activePlayerId as PlayerId;

    expect(
      reduceGame(state, {
        type: 'PLACE_BID',
        playerId: nextPlayer(activePlayerId),
        bid: 1,
      }),
    ).toBe(state);
    expect(reduceGame(state, { type: 'PLACE_BID', playerId: activePlayerId, bid: 1.5 })).toBe(state);
    expect(reduceGame(state, { type: 'PLACE_BID', playerId: activePlayerId, bid: -1 })).toBe(state);
    expect(reduceGame(state, { type: 'PLACE_BID', playerId: activePlayerId, bid: 4 })).toBe(state);
  });
});

describe('playing tricks', () => {
  it('offers and accepts only an active player legal card without mutating the prior state', () => {
    const heart = suited('fixture-heart-2', 'hearts', 2);
    const spade = suited('fixture-spade-14', 'spades', 14);
    const state: GameState = {
      ...createMatch(42),
      phase: 'playing',
      activePlayerId: 'human',
      hands: { human: [heart, spade], ember: [], rowan: [], mira: [] },
      currentTrick: [{ playerId: 'mira', card: suited('fixture-heart-10', 'hearts', 10) }],
    };
    const snapshot = structuredClone(state);

    expect(legalActions(state)).toEqual([{ type: 'PLAY_CARD', playerId: 'human', cardId: heart.id }]);
    expect(reduceGame(state, { type: 'PLAY_CARD', playerId: 'ember', cardId: heart.id })).toBe(state);
    expect(reduceGame(state, { type: 'PLAY_CARD', playerId: 'human', cardId: spade.id })).toBe(state);
    expect(reduceGame(state, { type: 'PLAY_CARD', playerId: 'human', cardId: 'missing' })).toBe(state);

    const played = reduceGame(state, { type: 'PLAY_CARD', playerId: 'human', cardId: heart.id });

    expect(played).not.toBe(state);
    expect(played.hands.human).toEqual([spade]);
    expect(played.currentTrick.at(-1)).toEqual({ playerId: 'human', card: heart });
    expect(played.activePlayerId).toBe('ember');
    expect(state).toEqual(snapshot);
  });

  it('keeps the fourth play visible, resolves its winner, and increments that player tricks', () => {
    const state = finishBidding(dealtRound(1));
    const result = playTrick(state);
    const winnerId = winningPlay(result.currentTrick, result.trump).playerId as PlayerId;

    expect(result.phase).toBe('trick-result');
    expect(result.currentTrick).toHaveLength(4);
    expect(result.completedTricks).toEqual([]);
    expect(result.activePlayerId).toBe(winnerId);
    expect(result.tricksWon[winnerId]).toBe(1);
    expect(PLAYER_IDS.filter((playerId) => playerId !== winnerId).map((playerId) => result.tricksWon[playerId])).toEqual([
      0,
      0,
      0,
    ]);
    expect(legalActions(result)).toEqual([{ type: 'ACKNOWLEDGE_TRICK' }]);
  });

  it('acknowledges a completed trick and lets its winner lead while cards remain', () => {
    const result = playTrick(finishBidding(dealtRound(2)));
    const winnerId = result.activePlayerId;
    const snapshot = structuredClone(result);
    const continued = reduceGame(result, { type: 'ACKNOWLEDGE_TRICK' });

    expect(continued.phase).toBe('playing');
    expect(continued.activePlayerId).toBe(winnerId);
    expect(continued.currentTrick).toEqual([]);
    expect(continued.completedTricks).toHaveLength(1);
    expect(continued.completedTricks[0]).toEqual({ plays: result.currentTrick, winnerId });
    expect(PLAYER_IDS.map((playerId) => continued.hands[playerId].length)).toEqual([1, 1, 1, 1]);
    expect(result).toEqual(snapshot);
  });

  it('scores every player exactly when the last trick is acknowledged', () => {
    const result = playTrick(finishBidding(dealtRound(1), [0, 0, 0, 0]));
    const winnerId = result.activePlayerId as PlayerId;

    expect(reduceGame({ ...result, phase: 'playing' }, { type: 'ACKNOWLEDGE_TRICK' })).toEqual({
      ...result,
      phase: 'playing',
    });

    const scored = reduceGame(result, { type: 'ACKNOWLEDGE_TRICK' });
    const expectedPlayers = PLAYER_IDS.map((playerId) => ({
      playerId,
      bid: 0,
      tricks: playerId === winnerId ? 1 : 0,
      delta: playerId === winnerId ? -10 : 20,
      cumulative: playerId === winnerId ? -10 : 20,
    }));

    expect(scored.phase).toBe('round-result');
    expect(scored.activePlayerId).toBeNull();
    expect(scored.currentTrick).toEqual([]);
    expect(scored.completedTricks).toHaveLength(1);
    expect(scored.scores).toEqual(
      Object.fromEntries(expectedPlayers.map(({ playerId, cumulative }) => [playerId, cumulative])),
    );
    expect(scored.roundScores).toEqual([
      { round: 1, trump: scored.trump, players: expectedPlayers },
    ]);
  });
});

describe('round and match progression', () => {
  it('rotates the dealer and resets only round-specific state for the next round', () => {
    const scored = scoreOneCardRound();
    const snapshot = structuredClone(scored);

    expect(legalActions(scored)).toEqual([{ type: 'ACKNOWLEDGE_ROUND' }]);

    const next = reduceGame(scored, { type: 'ACKNOWLEDGE_ROUND' });

    expect(next.phase).toBe('round-setup');
    expect(next.round).toBe(2);
    expect(next.dealerId).toBe(nextPlayer(scored.dealerId));
    expect(next.activePlayerId).toBeNull();
    expect(next.rng).toEqual(scored.rng);
    expect(next.drawPile).toEqual([]);
    expect(next.hands).toEqual({ human: [], ember: [], rowan: [], mira: [] });
    expect(next.trump).toBeNull();
    expect(next.revealedUpCard).toBeNull();
    expect(next.bids).toEqual([]);
    expect(next.currentTrick).toEqual([]);
    expect(next.completedTricks).toEqual([]);
    expect(next.tricksWon).toEqual({ human: 0, ember: 0, rowan: 0, mira: 0 });
    expect(next.scores).toEqual(scored.scores);
    expect(next.roundScores).toEqual(scored.roundScores);
    expect(scored).toEqual(snapshot);
  });

  it('moves round 15 to match result and exposes no further action', () => {
    const roundResult: GameState = { ...scoreOneCardRound(), round: 15 };
    const complete = reduceGame(roundResult, { type: 'ACKNOWLEDGE_ROUND' });

    expect(complete.phase).toBe('match-result');
    expect(complete.round).toBe(15);
    expect(complete.activePlayerId).toBeNull();
    expect(legalActions(complete)).toEqual([]);
    expect(reduceGame(complete, { type: 'ACKNOWLEDGE_ROUND' })).toBe(complete);
  });

  it('completes a deterministic 15-round match using only public legal actions', () => {
    const transitionLimit = 800;
    let transitionCount = 0;
    let state = createMatch(20_260_905);
    let observedRound15Deal = false;
    let observedRound15Scoring = false;

    while (state.phase !== 'match-result') {
      const actions = legalActions(state);
      const action = actions[0];

      expect(action, `No legal action at round ${state.round} in ${state.phase}.`).toBeDefined();

      if (action === undefined) {
        throw new Error('A reachable nonterminal state had no legal action.');
      }

      const previous = state;
      state = reduceGame(state, action);
      transitionCount += 1;

      expect(state, `Legal action ${action.type} was rejected.`).not.toBe(previous);
      expect(transitionCount).toBeLessThanOrEqual(transitionLimit);

      if (previous.round === 15 && action.type === 'DEAL_ROUND') {
        const cardIds = allDealtCardIds(state);

        observedRound15Deal = true;
        expect(PLAYER_IDS.map((playerId) => state.hands[playerId].length)).toEqual([15, 15, 15, 15]);
        expect(cardIds).toHaveLength(60);
        expect(new Set(cardIds).size).toBe(60);
        expect(state.drawPile).toEqual([]);
        expect(state.revealedUpCard).toBeNull();
        expect(state.trump).toBeNull();
      }

      if (
        previous.round === 15 &&
        action.type === 'ACKNOWLEDGE_TRICK' &&
        state.phase === 'round-result'
      ) {
        observedRound15Scoring = true;
        expect(state.completedTricks).toHaveLength(15);
        expect(PLAYER_IDS.map((playerId) => state.hands[playerId].length)).toEqual([0, 0, 0, 0]);
      }
    }

    const cumulativeScores: Record<PlayerId, number> = { human: 0, ember: 0, rowan: 0, mira: 0 };

    expect(observedRound15Deal).toBe(true);
    expect(observedRound15Scoring).toBe(true);
    expect(state.roundScores).toHaveLength(15);
    expect(state.roundScores.map(({ round }) => round)).toEqual(
      Array.from({ length: 15 }, (_, index) => index + 1),
    );

    for (const roundScore of state.roundScores) {
      expect(roundScore.players.map(({ playerId }) => playerId)).toEqual(PLAYER_IDS);

      for (const playerScore of roundScore.players) {
        cumulativeScores[playerScore.playerId] += playerScore.delta;
        expect(playerScore.cumulative).toBe(cumulativeScores[playerScore.playerId]);
      }
    }

    expect(state.phase).toBe('match-result');
    expect(state.round).toBe(15);
    expect(state.completedTricks).toHaveLength(15);
    expect(state.scores).toEqual(cumulativeScores);
    expect(legalActions(state)).toEqual([]);
    expect(transitionCount).toBeLessThan(transitionLimit);
  });

  it('returns all players tied for the highest score in clockwise seat order', () => {
    const state: GameState = {
      ...createMatch(42),
      phase: 'match-result',
      scores: { human: 50, ember: 80, rowan: 80, mira: 10 },
    };

    expect(matchWinners(state)).toEqual(['ember', 'rowan']);
  });

  it('bounds original event prose after accepted transitions', () => {
    const bidding = dealtRound(3);
    const activePlayerId = bidding.activePlayerId as PlayerId;
    const state: GameState = {
      ...bidding,
      events: Array.from({ length: EVENT_LIMIT }, (_, index) => `Earlier event ${index + 1}.`),
    };
    const next = reduceGame(state, { type: 'PLACE_BID', playerId: activePlayerId, bid: 2 });

    expect(next.events).toHaveLength(EVENT_LIMIT);
    expect(next.events[0]).toBe('Earlier event 2.');
    expect(next.events.at(-1)).toMatch(/ bid 2\.$/);
    expect(state.events[0]).toBe('Earlier event 1.');
  });

  it('returns the exact same object for an action invalid in the current phase', () => {
    const state = createMatch(42);

    expect(reduceGame(state, { type: 'ACKNOWLEDGE_TRICK' })).toBe(state);
  });
});
