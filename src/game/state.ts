import { createDeck, createRng, nextRandom, shuffle } from './deck';
import { legalCards, winningPlay } from './rules';
import { scoreRound } from './scoring';
import {
  PLAYERS,
  PLAYER_IDS,
  SUITS,
  type Card,
  type GameAction,
  type GameState,
  type PlayerId,
  type PlayerValues,
  type RoundPlayerScore,
} from './types';

export const EVENT_LIMIT = 24;
export const MAX_ROUNDS = 15;

export function createMatch(seed: number): GameState {
  const initialRng = createRng(seed);
  const dealerChoice = nextRandom(initialRng);
  const dealerId = PLAYER_IDS[Math.floor(dealerChoice.value * PLAYER_IDS.length)];

  return {
    schemaVersion: 1,
    matchId: `wizard-${initialRng.value.toString(16).padStart(8, '0')}`,
    difficulty: 'easy',
    players: PLAYERS,
    phase: 'round-setup',
    round: 1,
    dealerId,
    activePlayerId: null,
    rng: dealerChoice.state,
    drawPile: [],
    hands: emptyPlayerArrays(),
    trump: null,
    revealedUpCard: null,
    bids: [],
    currentTrick: [],
    completedTricks: [],
    tricksWon: zeroPlayerValues(),
    scores: zeroPlayerValues(),
    roundScores: [],
    events: ['Match ready.'],
  };
}

export function legalActions(state: GameState): GameAction[] {
  if (state.phase === 'round-setup') {
    return [{ type: 'DEAL_ROUND' }];
  }

  if (state.phase === 'choose-trump' && state.activePlayerId === state.dealerId) {
    return SUITS.map((suit) => ({
      type: 'CHOOSE_TRUMP',
      playerId: state.dealerId,
      suit,
    }));
  }

  if (state.phase === 'bidding' && state.activePlayerId !== null) {
    return Array.from({ length: state.round + 1 }, (_, bid) => ({
      type: 'PLACE_BID',
      playerId: state.activePlayerId as PlayerId,
      bid,
    }));
  }

  if (state.phase === 'playing' && state.activePlayerId !== null) {
    const playerId = state.activePlayerId;

    return legalCards(state.hands[playerId], state.currentTrick).map((card) => ({
      type: 'PLAY_CARD',
      playerId,
      cardId: card.id,
    }));
  }

  if (state.phase === 'trick-result') {
    return [{ type: 'ACKNOWLEDGE_TRICK' }];
  }

  if (state.phase === 'round-result') {
    return [{ type: 'ACKNOWLEDGE_ROUND' }];
  }

  return [];
}

export function reduceGame(state: GameState, action: GameAction): GameState {
  if (state.phase === 'round-setup' && action.type === 'DEAL_ROUND') {
    return dealRound(state);
  }

  if (
    state.phase === 'choose-trump' &&
    action.type === 'CHOOSE_TRUMP' &&
    action.playerId === state.dealerId &&
    action.playerId === state.activePlayerId &&
    SUITS.includes(action.suit)
  ) {
    return appendEvent(
      {
        ...state,
        phase: 'bidding',
        activePlayerId: nextPlayerId(state.dealerId),
        trump: action.suit,
      },
      `${playerName(action.playerId)} chose ${action.suit}.`,
    );
  }

  if (state.phase === 'bidding' && action.type === 'PLACE_BID') {
    return placeBid(state, action.playerId, action.bid);
  }

  if (state.phase === 'playing' && action.type === 'PLAY_CARD') {
    return playCard(state, action.playerId, action.cardId);
  }

  if (state.phase === 'trick-result' && action.type === 'ACKNOWLEDGE_TRICK') {
    return acknowledgeTrick(state);
  }

  if (state.phase === 'round-result' && action.type === 'ACKNOWLEDGE_ROUND') {
    return acknowledgeRound(state);
  }

  return state;
}

export function matchWinners(state: GameState): PlayerId[] {
  const highestScore = Math.max(...PLAYER_IDS.map((playerId) => state.scores[playerId]));

  return PLAYER_IDS.filter((playerId) => state.scores[playerId] === highestScore);
}

function placeBid(state: GameState, playerId: PlayerId, bid: number): GameState {
  if (
    playerId !== state.activePlayerId ||
    !Number.isInteger(bid) ||
    bid < 0 ||
    bid > state.round ||
    state.bids.some((record) => record.playerId === playerId)
  ) {
    return state;
  }

  const bids = [...state.bids, { playerId, bid }];
  const biddingComplete = bids.length === PLAYER_IDS.length;

  return appendEvent(
    {
      ...state,
      phase: biddingComplete ? 'playing' : 'bidding',
      activePlayerId: biddingComplete ? nextPlayerId(state.dealerId) : nextPlayerId(playerId),
      bids,
    },
    `${playerName(playerId)} bid ${bid}.`,
  );
}

function playCard(state: GameState, playerId: PlayerId, cardId: string): GameState {
  if (playerId !== state.activePlayerId || state.currentTrick.length >= PLAYER_IDS.length) {
    return state;
  }

  const card = state.hands[playerId].find((candidate) => candidate.id === cardId);

  if (card === undefined || !legalCards(state.hands[playerId], state.currentTrick).some(({ id }) => id === cardId)) {
    return state;
  }

  const currentTrick = [...state.currentTrick, { playerId, card }];
  const hands = {
    ...state.hands,
    [playerId]: state.hands[playerId].filter(({ id }) => id !== cardId),
  };

  if (currentTrick.length < PLAYER_IDS.length) {
    return appendEvent(
      {
        ...state,
        activePlayerId: nextPlayerId(playerId),
        hands,
        currentTrick,
      },
      `${playerName(playerId)} played ${card.id}.`,
    );
  }

  const winningPlayerId = winningPlay(currentTrick, state.trump).playerId;

  if (!isPlayerId(winningPlayerId)) {
    return state;
  }

  return appendEvent(
    {
      ...state,
      phase: 'trick-result',
      activePlayerId: winningPlayerId,
      hands,
      currentTrick,
      tricksWon: {
        ...state.tricksWon,
        [winningPlayerId]: state.tricksWon[winningPlayerId] + 1,
      },
    },
    `${playerName(playerId)} played ${card.id}. ${playerName(winningPlayerId)} won the trick.`,
  );
}

function acknowledgeTrick(state: GameState): GameState {
  if (state.currentTrick.length !== PLAYER_IDS.length || state.activePlayerId === null) {
    return state;
  }

  const completedTricks = [
    ...state.completedTricks,
    { plays: [...state.currentTrick], winnerId: state.activePlayerId },
  ];
  const clearedTrick = {
    ...state,
    currentTrick: [],
    completedTricks,
  };

  if (PLAYER_IDS.some((playerId) => state.hands[playerId].length > 0)) {
    return appendEvent({ ...clearedTrick, phase: 'playing' }, 'Next trick.');
  }

  const roundPlayers: RoundPlayerScore[] = [];
  const scores: Record<PlayerId, number> = { ...state.scores };

  for (const playerId of PLAYER_IDS) {
    const bid = state.bids.find((record) => record.playerId === playerId)?.bid;

    if (bid === undefined) {
      return state;
    }

    const tricks = state.tricksWon[playerId];
    const delta = scoreRound(bid, tricks);
    scores[playerId] += delta;
    roundPlayers.push({ playerId, bid, tricks, delta, cumulative: scores[playerId] });
  }

  return appendEvent(
    {
      ...clearedTrick,
      phase: 'round-result',
      activePlayerId: null,
      scores,
      roundScores: [
        ...state.roundScores,
        { round: state.round, trump: state.trump, players: roundPlayers },
      ],
    },
    `Round ${state.round} scored.`,
  );
}

function acknowledgeRound(state: GameState): GameState {
  if (!Number.isInteger(state.round) || state.round < 1 || state.round > MAX_ROUNDS) {
    return state;
  }

  if (state.round === MAX_ROUNDS) {
    return appendEvent({ ...state, phase: 'match-result', activePlayerId: null }, 'Match complete.');
  }

  const round = state.round + 1;

  return appendEvent(
    {
      ...state,
      phase: 'round-setup',
      round,
      dealerId: nextPlayerId(state.dealerId),
      activePlayerId: null,
      drawPile: [],
      hands: emptyPlayerArrays(),
      trump: null,
      revealedUpCard: null,
      bids: [],
      currentTrick: [],
      completedTricks: [],
      tricksWon: zeroPlayerValues(),
    },
    `Round ${round} ready.`,
  );
}

function dealRound(state: GameState): GameState {
  if (!Number.isInteger(state.round) || state.round < 1 || state.round > MAX_ROUNDS) {
    return state;
  }

  const shuffled = shuffle(createDeck(), state.rng);
  const hands: Record<PlayerId, Card[]> = { human: [], ember: [], rowan: [], mira: [] };
  let cardIndex = 0;

  for (let count = 0; count < state.round; count += 1) {
    for (let seat = 1; seat <= PLAYER_IDS.length; seat += 1) {
      const playerId = PLAYER_IDS[(PLAYER_IDS.indexOf(state.dealerId) + seat) % PLAYER_IDS.length];
      hands[playerId].push(shuffled.cards[cardIndex]);
      cardIndex += 1;
    }
  }

  const revealedUpCard = shuffled.cards[cardIndex] ?? null;
  const drawPile = shuffled.cards.slice(cardIndex + (revealedUpCard === null ? 0 : 1));
  const phase = revealedUpCard?.kind === 'wizard' ? 'choose-trump' : 'bidding';
  const activePlayerId = phase === 'choose-trump' ? state.dealerId : nextPlayerId(state.dealerId);
  const trump = revealedUpCard?.kind === 'suited' ? revealedUpCard.suit : null;
  const message =
    phase === 'choose-trump'
      ? `Round ${state.round} dealt. Dealer chooses trump.`
      : `Round ${state.round} dealt.${trump === null ? ' No trump.' : ` Trump is ${trump}.`}`;

  return appendEvent(
    {
      ...state,
      phase,
      activePlayerId,
      rng: shuffled.rng,
      drawPile,
      hands,
      trump,
      revealedUpCard,
      bids: [],
      currentTrick: [],
      completedTricks: [],
      tricksWon: zeroPlayerValues(),
    },
    message,
  );
}

export function nextPlayerId(playerId: PlayerId): PlayerId {
  return PLAYER_IDS[(PLAYER_IDS.indexOf(playerId) + 1) % PLAYER_IDS.length];
}

function isPlayerId(value: string): value is PlayerId {
  return (PLAYER_IDS as readonly string[]).includes(value);
}

function playerName(playerId: PlayerId): string {
  return PLAYERS.find(({ id }) => id === playerId)?.name ?? playerId;
}

function appendEvent(state: GameState, message: string): GameState {
  return {
    ...state,
    events: [...state.events, message].slice(-EVENT_LIMIT),
  };
}

function zeroPlayerValues(): PlayerValues<number> {
  return { human: 0, ember: 0, rowan: 0, mira: 0 };
}

function emptyPlayerArrays(): PlayerValues<readonly never[]> {
  return { human: [], ember: [], rowan: [], mira: [] };
}

export type { GameAction, GameState, PlayerId };
