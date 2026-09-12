import { fireEvent, render, screen, within } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { createMatch, legalActions, reduceGame } from '../game/state';
import type { Card, GameAction, GameState } from '../game/types';
import { isSemanticallyValidGameState } from '../game/validation';
import type { AudioContextLike, SoundController } from '../audio/sounds';
import { GameTable } from './GameTable';
import { cardName } from './PlayingCard';

const twoHearts: Card = { id: 'human-heart-2', kind: 'suited', suit: 'hearts', rank: 2 };
const aceSpades: Card = { id: 'human-spade-ace', kind: 'suited', suit: 'spades', rank: 14 };
const humanWizard: Card = { id: 'human-wizard', kind: 'wizard' };
const humanJester: Card = { id: 'human-jester', kind: 'jester' };

function displayState(overrides: Partial<GameState> = {}): GameState {
  return {
    ...createMatch(42),
    phase: 'bidding',
    round: 3,
    dealerId: 'rowan',
    activePlayerId: 'ember',
    drawPile: [],
    hands: {
      human: [{ id: 'visible-human-heart-ace', kind: 'suited', suit: 'hearts', rank: 14 }],
      ember: [
        { id: 'secret-ember-club-king', kind: 'suited', suit: 'clubs', rank: 13 },
        { id: 'secret-ember-wizard', kind: 'wizard' },
        { id: 'secret-ember-jester', kind: 'jester' },
      ],
      rowan: [
        { id: 'secret-rowan-diamond-two', kind: 'suited', suit: 'diamonds', rank: 2 },
        { id: 'secret-rowan-spade-three', kind: 'suited', suit: 'spades', rank: 3 },
      ],
      mira: [{ id: 'secret-mira-heart-queen', kind: 'suited', suit: 'hearts', rank: 12 }],
    },
    trump: 'hearts',
    revealedUpCard: { id: 'up-heart-ten', kind: 'suited', suit: 'hearts', rank: 10 },
    bids: [],
    currentTrick: [],
    completedTricks: [],
    tricksWon: { human: 1, ember: 0, rowan: 2, mira: 0 },
    scores: { human: 30, ember: -10, rowan: 50, mira: 0 },
    ...overrides,
  };
}

function findDealtState(predicate: (state: GameState) => boolean, round = 1): GameState {
  for (let seed = 0; seed < 20_000; seed += 1) {
    const initial = { ...createMatch(seed), round };
    const dealt = reduceGame(initial, { type: 'DEAL_ROUND' });
    if (predicate(dealt)) {
      return dealt;
    }
  }

  throw new Error('Unable to find a deterministic dealt-state fixture.');
}

function restrictedFollowSuitState(activePlayerId: GameState['activePlayerId'] = 'human'): GameState {
  return displayState({
    phase: 'playing',
    round: 4,
    dealerId: 'rowan',
    activePlayerId,
    hands: {
      human: [twoHearts, aceSpades, humanWizard, humanJester],
      ember: [{ id: 'secret-ember-club-four', kind: 'suited', suit: 'clubs', rank: 4 }],
      rowan: [{ id: 'secret-rowan-diamond-five', kind: 'suited', suit: 'diamonds', rank: 5 }],
      mira: [{ id: 'secret-mira-spade-six', kind: 'suited', suit: 'spades', rank: 6 }],
    },
    bids: [
      { playerId: 'ember', bid: 1 },
      { playerId: 'rowan', bid: 2 },
      { playerId: 'mira', bid: 0 },
      { playerId: 'human', bid: 1 },
    ],
    currentTrick:
      activePlayerId === 'human'
        ? [
            {
              playerId: 'ember',
              card: { id: 'played-ember-heart-nine', kind: 'suited', suit: 'hearts', rank: 9 },
            },
            { playerId: 'rowan', card: { id: 'played-rowan-jester', kind: 'jester' } },
            {
              playerId: 'mira',
              card: { id: 'played-mira-heart-king', kind: 'suited', suit: 'hearts', rank: 13 },
            },
          ]
        : [],
  });
}

function resolvedNonLeaderWinState(): GameState {
  for (let seed = 0; seed < 20_000; seed += 1) {
    let state = createMatch(seed);

    for (let transition = 0; transition < 12 && state.phase !== 'trick-result'; transition += 1) {
      const action = legalActions(state)[0] as GameAction | undefined;
      if (action === undefined) {
        break;
      }
      state = reduceGame(state, action);
    }

    if (
      state.phase === 'trick-result' &&
      state.currentTrick[0]?.playerId === 'human' &&
      state.currentTrick[0].card.kind === 'suited' &&
      state.activePlayerId === 'rowan' &&
      state.currentTrick.find((play) => play.playerId === 'rowan')?.card.kind === 'wizard'
    ) {
      return state;
    }
  }

  throw new Error('Unable to find a valid non-leader trick-win fixture.');
}

function scoredState(phase: 'round-result' | 'match-result' = 'round-result'): GameState {
  return displayState({
    phase,
    round: phase === 'match-result' ? 15 : 3,
    activePlayerId: null,
    hands: { human: [], ember: [], rowan: [], mira: [] },
    scores: { human: 40, ember: 20, rowan: -10, mira: 40 },
    roundScores: [
      {
        round: phase === 'match-result' ? 15 : 3,
        trump: null,
        players: [
          { playerId: 'human', bid: 2, tricks: 2, delta: 40, cumulative: 40 },
          { playerId: 'ember', bid: 0, tricks: 0, delta: 20, cumulative: 20 },
          { playerId: 'rowan', bid: 1, tricks: 2, delta: -10, cumulative: -10 },
          { playerId: 'mira', bid: 2, tricks: 2, delta: 40, cumulative: 40 },
        ],
      },
    ],
  });
}

describe('GameTable', () => {
  it('exposes only non-sensitive game state and legal visible-card browser hooks', () => {
    const state = restrictedFollowSuitState();
    const { container } = render(
      <GameTable state={state} legalActions={legalActions(state)} onAction={vi.fn()} />,
    );

    const gameState = screen.getByTestId('game-state');
    expect(gameState).toHaveAttribute('data-phase', 'playing');
    expect(gameState).toHaveAttribute('data-round', '4');
    expect(gameState).toHaveAttribute('data-active-player', 'human');
    expect(screen.getAllByTestId('legal-card')).toHaveLength(3);
    expect(screen.getByRole('button', { name: /Ace of Spades/ })).not.toHaveAttribute(
      'data-testid',
    );
    expect(container.innerHTML).not.toMatch(/secret-/i);
  });

  it('shows all seats without a visible opponent card count or hidden faces and IDs', () => {
    const state = displayState();
    const { container } = render(
      <GameTable state={state} legalActions={legalActions(state)} onAction={vi.fn()} />,
    );

    for (const name of ['You', 'Ember', 'Rowan', 'Mira']) {
      expect(screen.getByRole('region', { name: `${name} seat` })).toBeInTheDocument();
    }
    expect(screen.getByLabelText('Ember has 3 hidden cards')).toBeInTheDocument();
    expect(screen.getByLabelText('Rowan has 2 hidden cards')).toBeInTheDocument();
    expect(screen.getByLabelText('Mira has 1 hidden card')).toBeInTheDocument();
    expect(screen.queryByText('3 cards')).not.toBeInTheDocument();
    expect(screen.queryByText('2 cards')).not.toBeInTheDocument();
    expect(screen.queryByText('1 card')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ace of Hearts/ })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Your hand, 1 card' })).toBeInTheDocument();

    expect(container.innerHTML).not.toMatch(/secret-/i);
    expect(container.innerHTML).not.toMatch(/King of Clubs/i);
    expect(container.innerHTML).not.toMatch(/Queen of Hearts/i);
    expect(screen.queryByText(/^Wizard$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Jester$/)).not.toBeInTheDocument();
    expect(container.querySelector('[data-kind="wizard"], [data-kind="jester"]')).toBeNull();
  });

  it('places every player bid and trick counter on the table after the human bids', () => {
    const state = displayState({
      bids: [
        { playerId: 'ember', bid: 2 },
        { playerId: 'rowan', bid: 1 },
        { playerId: 'mira', bid: 0 },
        { playerId: 'human', bid: 3 },
      ],
    });
    const { container } = render(
      <GameTable state={state} legalActions={legalActions(state)} onAction={vi.fn()} />,
    );

    for (const [name, bid, tricks] of [
      ['You', '3', '1'],
      ['Ember', '2', '0'],
      ['Rowan', '1', '2'],
      ['Mira', '0', '0'],
    ]) {
      const seat = screen.getByRole('region', { name: `${name} seat` });
      const counters = within(seat).getByLabelText(`${name} round stats`);
      expect(counters).toHaveClass('seat-table-stats');
      expect(counters).toHaveTextContent(`Bid${bid}`);
      expect(counters).toHaveTextContent(`Tricks${tricks}`);
      expect(within(seat).getByText(/Score:/)).toBeInTheDocument();
      expect(within(seat).queryByText(/Bid:/)).not.toBeInTheDocument();
      expect(within(seat).queryByText(/Tricks:/)).not.toBeInTheDocument();
    }
    expect(container.querySelector('.seat-marker--dealer')).toHaveClass('seat-marker--dealer');
  });

  it('hides every bid value until the human submits a bid', () => {
    const state = displayState({
      bids: [
        { playerId: 'ember', bid: 2 },
        { playerId: 'rowan', bid: 1 },
        { playerId: 'mira', bid: 0 },
      ],
    });
    render(<GameTable state={state} legalActions={legalActions(state)} onAction={vi.fn()} />);

    for (const name of ['You', 'Ember', 'Rowan', 'Mira']) {
      const stats = screen.getByLabelText(`${name} round stats`);
      expect(stats).not.toHaveTextContent('Bid');
      expect(stats).toHaveTextContent('Tricks');
    }
  });

  it('shows the face-up trump card by the dealer during bidding', () => {
    const state = displayState();
    const { container } = render(
      <GameTable state={state} legalActions={legalActions(state)} onAction={vi.fn()} />,
    );

    expect(container.querySelector('.table-status')).toBeNull();
    expect(screen.queryByText('Round 3 of 15')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Ember seat' })).getByText('Active')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Rowan seat' })).getByText('Dealer')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'You seat' })).getByText('Score: 30')).toBeInTheDocument();
    expect(screen.queryByText(/Trump:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Up card:/)).not.toBeInTheDocument();
    const reveal = screen.getByLabelText('Face-up card: Ten of Hearts. Hearts are trump.');
    expect(reveal).toHaveClass('face-up-card--top');
    expect(within(reveal).getByRole('img', { name: 'Ten of Hearts' })).toBeInTheDocument();
  });

  it.each([
    ['ember', 'left'],
    ['rowan', 'top'],
    ['mira', 'right'],
    ['human', 'bottom'],
  ] as const)('positions the face-up card in front of the %s dealer', (dealerId, position) => {
    render(
      <GameTable
        state={displayState({ dealerId })}
        legalActions={legalActions(displayState({ dealerId }))}
        onAction={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Face-up card: Ten of Hearts. Hearts are trump.')).toHaveClass(
      `face-up-card--${position}`,
    );
  });

  it.each(['playing', 'trick-result'] as const)(
    'parks the face-up card in the upper-left after bidding during %s',
    (phase) => {
      const state = displayState({ phase });
      render(<GameTable state={state} legalActions={legalActions(state)} onAction={vi.fn()} />);

      const reveal = screen.getByLabelText('Face-up card: Ten of Hearts. Hearts are trump.');
      expect(reveal).toHaveClass('face-up-card--table-corner');
      expect(reveal).not.toHaveClass('face-up-card--top');
    },
  );

  it('renders four fixed player-owned card slots in a cross and fills them by player identity', () => {
    const state = displayState({
      phase: 'playing',
      currentTrick: [
        {
          playerId: 'mira',
          card: { id: 'played-mira-heart-seven', kind: 'suited', suit: 'hearts', rank: 7 },
        },
        { playerId: 'ember', card: { id: 'played-ember-wizard', kind: 'wizard' } },
      ],
    });
    const { container } = render(
      <GameTable state={state} legalActions={legalActions(state)} onAction={vi.fn()} />,
    );

    const slots = within(screen.getByRole('region', { name: 'Current trick' })).getAllByRole(
      'listitem',
    );
    expect(slots).toHaveLength(4);

    const expectedSlots = [
      ['Ember', 'left', 'Wizard'],
      ['Rowan', 'top', null],
      ['Mira', 'right', 'Seven of Hearts'],
      ['You', 'bottom', null],
    ] as const;

    for (const [name, position, cardName] of expectedSlots) {
      const slot = screen.getByRole('listitem', {
        name: cardName === null ? `${name} has not played` : `${name} played ${cardName}`,
      });
      expect(slot).toHaveClass(`trick-play--${position}`);
      expect(within(slot).getByText(name)).toBeInTheDocument();
      if (cardName === null) {
        expect(within(slot).queryByRole('img')).not.toBeInTheDocument();
      } else {
        expect(within(slot).getByRole('img')).toHaveAccessibleName(cardName);
      }
    }

    expect(container.querySelector('[data-trick-player="ember"] [data-card-id]')).toHaveAttribute(
      'data-card-id',
      'played-ember-wizard',
    );
    expect(container.querySelector('[data-trick-player="mira"] [data-card-id]')).toHaveAttribute(
      'data-card-id',
      'played-mira-heart-seven',
    );
  });

  it('renders exactly the engine-provided human bid actions and emits the chosen payload', () => {
    const state = findDealtState(
      (candidate) => candidate.phase === 'bidding' && candidate.activePlayerId === 'human',
      3,
    );
    const actions = legalActions(state);
    const onAction = vi.fn();
    render(<GameTable state={state} legalActions={actions} onAction={onAction} />);

    expect(screen.getByRole('region', { name: 'Your decision' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Bid \d+$/ }).map((button) => button.textContent)).toEqual([
      'Bid 0',
      'Bid 1',
      'Bid 2',
      'Bid 3',
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Bid 2' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'PLACE_BID', playerId: 'human', bid: 2 });
  });

  it('does not synthesize bid controls beyond the supplied legal actions', () => {
    const state = findDealtState(
      (candidate) => candidate.phase === 'bidding' && candidate.activePlayerId === 'human',
      3,
    );
    const onlyBidTwo = legalActions(state).filter(
      (action) => action.type === 'PLACE_BID' && action.bid === 2,
    );
    render(<GameTable state={state} legalActions={onlyBidTwo} onAction={vi.fn()} />);

    expect(screen.getAllByRole('button', { name: /^Bid \d+$/ })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Bid 2' })).toBeInTheDocument();
  });

  it('renders four engine-provided suit choices for a human Wizard dealer and emits one', () => {
    const state = findDealtState(
      (candidate) =>
        candidate.phase === 'choose-trump' &&
        candidate.dealerId === 'human' &&
        candidate.activePlayerId === 'human',
    );
    const actions = legalActions(state);
    const onAction = vi.fn();
    render(<GameTable state={state} legalActions={actions} onAction={onAction} />);

    expect(screen.getByLabelText('Face-up card: Wizard. Dealer is choosing trump.')).toBeInTheDocument();
    expect(document.querySelector('.face-up-card__trump-suit')).toBeNull();
    expect(
      within(screen.getByRole('group', { name: 'Choose trump' })).getAllByRole('button'),
    ).toHaveLength(4);
    expect(screen.getByRole('button', { name: '♣ Clubs' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '♦ Diamonds' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '♥ Hearts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '♠ Spades' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '♠ Spades' }));
    expect(onAction).toHaveBeenCalledWith({
      type: 'CHOOSE_TRUMP',
      playerId: 'human',
      suit: 'spades',
    });
  });

  it('does not synthesize trump controls beyond the supplied legal actions', () => {
    const state = findDealtState(
      (candidate) =>
        candidate.phase === 'choose-trump' &&
        candidate.dealerId === 'human' &&
        candidate.activePlayerId === 'human',
    );
    const onlyHearts = legalActions(state).filter(
      (action) => action.type === 'CHOOSE_TRUMP' && action.suit === 'hearts',
    );
    render(<GameTable state={state} legalActions={onlyHearts} onAction={vi.fn()} />);

    const controls = within(screen.getByRole('group', { name: 'Choose trump' })).getAllByRole(
      'button',
    );
    expect(controls).toHaveLength(1);
    expect(controls[0]).toHaveAccessibleName('♥ Hearts');
  });

  it('shows a revealed Jester on the felt without trump prose', () => {
    const state = displayState({
      trump: null,
      revealedUpCard: { id: 'up-jester', kind: 'jester' },
    });
    render(<GameTable state={state} legalActions={legalActions(state)} onAction={vi.fn()} />);

    const reveal = screen.getByLabelText('Face-up card: Jester. No trump this round.');
    expect(within(reveal).getByRole('img', { name: 'Jester' })).toBeInTheDocument();
    expect(screen.queryByText(/Trump:/)).not.toBeInTheDocument();
  });

  it('marks a revealed Wizard with only the resolved trump suit symbol', () => {
    const state = displayState({
      trump: 'spades',
      revealedUpCard: { id: 'up-wizard', kind: 'wizard' },
    });
    const { container } = render(
      <GameTable state={state} legalActions={legalActions(state)} onAction={vi.fn()} />,
    );

    const reveal = screen.getByLabelText('Face-up card: Wizard. Spades are trump.');
    expect(within(reveal).getByRole('img', { name: 'Wizard' })).toBeInTheDocument();
    expect(container.querySelector('.face-up-card__trump-suit')).toHaveTextContent('♠');
    expect(screen.queryByText(/Trump:/)).not.toBeInTheDocument();
  });

  it('shows no face-up card in round 15', () => {
    const state = displayState({ round: 15, trump: null, revealedUpCard: null });
    render(<GameTable state={state} legalActions={legalActions(state)} onAction={vi.fn()} />);

    expect(screen.queryByLabelText(/Face-up card:/)).not.toBeInTheDocument();
  });

  it('enables only exact human PLAY_CARD actions in a follow-suit situation', () => {
    const state = restrictedFollowSuitState();
    const onAction = vi.fn();
    render(
      <GameTable state={state} legalActions={legalActions(state)} onAction={onAction} />,
    );

    const heart = screen.getByRole('button', { name: 'Play Two of Hearts' });
    const spade = screen.getByRole('button', { name: 'Ace of Spades — must follow suit' });
    const wizard = screen.getByRole('button', { name: 'Play Wizard' });
    const jester = screen.getByRole('button', { name: 'Play Jester' });

    expect(heart).toBeEnabled();
    expect(spade).toBeDisabled();
    expect(wizard).toBeEnabled();
    expect(jester).toBeEnabled();
    expect(heart).toHaveAttribute('data-card-id', twoHearts.id);

    fireEvent.click(heart);
    fireEvent.click(spade);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith({
      type: 'PLAY_CARD',
      playerId: 'human',
      cardId: twoHearts.id,
    });
    expect(within(screen.getByRole('region', { name: 'Ember seat' })).getByText('Leader')).toBeInTheDocument();
  });

  it('always displays the human hand by suit and descending rank, then Wizards and Jesters', () => {
    const orderedCards: Card[] = [
      { id: 'spades-14', kind: 'suited', suit: 'spades', rank: 14 },
      { id: 'spades-3', kind: 'suited', suit: 'spades', rank: 3 },
      { id: 'hearts-13', kind: 'suited', suit: 'hearts', rank: 13 },
      { id: 'clubs-12', kind: 'suited', suit: 'clubs', rank: 12 },
      { id: 'clubs-2', kind: 'suited', suit: 'clubs', rank: 2 },
      { id: 'diamonds-10', kind: 'suited', suit: 'diamonds', rank: 10 },
      { id: 'wizard-1', kind: 'wizard' },
      { id: 'wizard-2', kind: 'wizard' },
      { id: 'jester-1', kind: 'jester' },
    ];
    const state = displayState({
      hands: {
        ...displayState().hands,
        human: [orderedCards[8], orderedCards[4], orderedCards[2], orderedCards[6], orderedCards[1], orderedCards[5], orderedCards[0], orderedCards[7], orderedCards[3]],
      },
    });
    const { container } = render(
      <GameTable state={state} legalActions={legalActions(state)} onAction={vi.fn()} />,
    );

    expect(
      [...container.querySelectorAll('.human-hand > [data-card-id]')].map((element) =>
        element.getAttribute('data-card-id'),
      ),
    ).toEqual(orderedCards.map((item) => item.id));
  });

  it('highlights only the human cards that match the resolved trump suit', () => {
    const state = displayState({
      hands: {
        ...displayState().hands,
        human: [twoHearts, aceSpades, humanWizard, humanJester],
      },
      trump: 'hearts',
    });
    render(<GameTable state={state} legalActions={legalActions(state)} onAction={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Two of Hearts/ })).toHaveClass('playing-card--trump');
    expect(screen.getByRole('button', { name: /Ace of Spades/ })).not.toHaveClass('playing-card--trump');
    expect(screen.getByRole('button', { name: /Wizard/ })).not.toHaveClass('playing-card--trump');
    expect(screen.getByRole('button', { name: /Jester/ })).not.toHaveClass('playing-card--trump');
  });

  it('disables every human card during a computer turn and explains the phase', () => {
    const state = restrictedFollowSuitState('ember');
    const onAction = vi.fn();
    render(
      <GameTable state={state} legalActions={legalActions(state)} onAction={onAction} />,
    );

    const humanCards = screen.getAllByRole('button', { name: /wait for your turn/i });
    expect(humanCards).toHaveLength(state.hands.human.length);
    for (const card of humanCards) {
      expect(card).toBeDisabled();
      fireEvent.click(card);
    }
    expect(onAction).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Ember seat' })).getByText('Leader')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Your decision' })).not.toBeInTheDocument();
  });

  it('distinguishes the trick leader from a non-leader winner in a resolved engine state', () => {
    const state = resolvedNonLeaderWinState();
    render(<GameTable state={state} legalActions={legalActions(state)} onAction={vi.fn()} />);

    expect(state.phase).toBe('trick-result');
    expect(isSemanticallyValidGameState(state)).toBe(true);
    expect(state.currentTrick[0]?.playerId).toBe('human');
    expect(state.activePlayerId).toBe('rowan');
    const plays = screen.getAllByRole('listitem');
    expect(plays).toHaveLength(4);
    for (const [index, play] of state.currentTrick.entries()) {
      const playerName = state.players.find((player) => player.id === play.playerId)?.name;
      expect(within(plays[index]).getByText(playerName as string)).toBeInTheDocument();
      expect(within(plays[index]).getByLabelText(cardName(play.card))).toBeInTheDocument();
    }
    expect(within(screen.getByRole('region', { name: 'You seat' })).getByText('Leader')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Rowan seat' })).getByText('Winner')).toBeInTheDocument();
    expect(screen.queryByText('Active')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders a gameplay storage warning within the game table main landmark', () => {
    const state = displayState();
    render(
      <GameTable
        state={state}
        legalActions={legalActions(state)}
        onAction={vi.fn()}
        storageWarning
      />,
    );

    expect(
      within(screen.getByRole('main')).getByText(
        /this match can continue, but resume may be unavailable/i,
      ),
    ).toBeInTheDocument();
  });

  it('replaces the table with a focused round result and score-menu access', () => {
    const state = scoredState();
    const onContinueRound = vi.fn();
    render(
      <GameTable
        state={state}
        legalActions={legalActions(state)}
        onAction={vi.fn()}
        onContinueRound={onContinueRound}
        onRestart={vi.fn()}
        onHome={vi.fn()}
        storageWarning
      />,
    );

    const main = screen.getByRole('main');
    const continueButton = screen.getByRole('button', { name: 'Continue' });
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(main).toHaveClass('game-table--result-screen');
    expect(screen.getByRole('heading', { level: 1, name: 'Round 3 complete' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('listitem', { name: 'You' })).getByRole('heading', {
        level: 2,
        name: 'You',
      }),
    ).toBeInTheDocument();
    expect(continueButton).toHaveFocus();
    expect(
      within(main).getByText(/this match can continue, but resume may be unavailable/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Game menu' })).toBeInTheDocument();
    expect(screen.queryByRole('toolbar', { name: 'Game menu' })).not.toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'You' })).toHaveTextContent('+40');
    expect(screen.getByRole('listitem', { name: 'You' })).toHaveTextContent('40');
    expect(screen.getByRole('listitem', { name: 'You' })).not.toHaveTextContent('Total');
    expect(screen.queryByRole('heading', { name: 'Current trick' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /your hand/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Opponent summaries' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /seat$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Play / })).not.toBeInTheDocument();

    fireEvent.click(continueButton);
    expect(onContinueRound).toHaveBeenCalledOnce();
  });

  it('replaces the table and menu with only a focused match result surface', () => {
    const onRestart = vi.fn();
    const onHome = vi.fn();
    const state = scoredState('match-result');
    render(
      <GameTable
        state={state}
        legalActions={legalActions(state)}
        onAction={vi.fn()}
        onContinueRound={vi.fn()}
        onRestart={onRestart}
        onHome={onHome}
        storageWarning
      />,
    );

    const main = screen.getByRole('main');
    const result = screen.getByRole('region', { name: 'Match complete' });
    const heading = within(result).getByRole('heading', { level: 1, name: 'Match complete' });
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(main).toHaveClass('game-table--result-screen');
    expect(heading).toHaveFocus();
    expect(
      within(main).getByText(/this match can continue, but resume may be unavailable/i),
    ).toBeInTheDocument();
    expect(within(result).getByRole('status')).toHaveTextContent(
      'You and Mira share the win with 40 points!',
    );
    expect(screen.queryByRole('group', { name: 'Game menu' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Current trick' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /your hand/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Opponent summaries' })).not.toBeInTheDocument();
    expect(within(result).getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Score Sheet',
      'New Match',
      'Return Home',
    ]);
    fireEvent.click(within(result).getByRole('button', { name: 'New Match' }));
    fireEvent.click(within(result).getByRole('button', { name: 'Return Home' }));
    expect(onRestart).toHaveBeenCalledOnce();
    expect(onHome).toHaveBeenCalledOnce();
  });

  it('plays cues only for new state transitions and never merely on mount or rerender', () => {
    const play = vi.fn();
    const sounds: SoundController = {
      enabled: true,
      toggle: vi.fn(() => false),
      play,
      dispose: vi.fn(),
    };
    const initial = restrictedFollowSuitState('ember');
    const props = {
      legalActions: legalActions(initial),
      onAction: vi.fn(),
      onContinueRound: vi.fn(),
      onRestart: vi.fn(),
      onHome: vi.fn(),
      sounds,
    };
    const { rerender } = render(<GameTable state={initial} {...props} />);

    expect(play).not.toHaveBeenCalled();
    rerender(<GameTable state={initial} {...props} />);
    expect(play).not.toHaveBeenCalled();

    const onePlay = {
      ...initial,
      currentTrick: [
        {
          playerId: 'ember' as const,
          card: { id: 'played-ember-club-four', kind: 'suited' as const, suit: 'clubs' as const, rank: 4 as const },
        },
      ],
    };
    rerender(<GameTable state={onePlay} {...props} />);
    expect(play).toHaveBeenLastCalledWith('card');

    const trickResult = {
      ...onePlay,
      phase: 'trick-result' as const,
      activePlayerId: 'mira' as const,
      currentTrick: [
        ...onePlay.currentTrick,
        { playerId: 'rowan' as const, card: { id: 'play-2', kind: 'jester' as const } },
        { playerId: 'mira' as const, card: { id: 'play-3', kind: 'wizard' as const } },
        { playerId: 'human' as const, card: { id: 'play-4', kind: 'jester' as const } },
      ],
    };
    rerender(<GameTable state={trickResult} {...props} />);
    expect(play.mock.calls.slice(-2)).toEqual([['card'], ['trick']]);

    const roundResult = scoredState();
    rerender(<GameTable state={roundResult} {...props} />);
    expect(play).toHaveBeenLastCalledWith('round');
    rerender(<GameTable state={roundResult} {...props} />);
    expect(play).toHaveBeenCalledTimes(4);
  });

  it('does not replay a result cue when mounting a saved result state', () => {
    const sounds: SoundController = {
      enabled: true,
      toggle: vi.fn(() => false),
      play: vi.fn(),
      dispose: vi.fn(),
    };
    const state = scoredState();
    render(
      <GameTable
        state={state}
        legalActions={legalActions(state)}
        onAction={vi.fn()}
        onContinueRound={vi.fn()}
        onRestart={vi.fn()}
        onHome={vi.fn()}
        sounds={sounds}
      />,
    );

    expect(sounds.play).not.toHaveBeenCalled();
  });

  it('does not duplicate transition audio in StrictMode and closes its context on unmount', () => {
    let contextState = 'running';
    const close = vi.fn(() => {
      contextState = 'closed';
      return Promise.resolve();
    });
    const createOscillator = vi.fn(() => ({
      frequency: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }));
    const context: AudioContextLike = {
      currentTime: 1,
      get state() {
        return contextState;
      },
      destination: {},
      resume: vi.fn().mockResolvedValue(undefined),
      close,
      createOscillator,
      createGain: vi.fn(() => ({
        gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
      })),
    };
    const createAudioContext = vi.fn(() => context);
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    };
    const initial = restrictedFollowSuitState('ember');
    const table = (state: GameState) => (
      <StrictMode>
        <GameTable
          state={state}
          legalActions={legalActions(state)}
          onAction={vi.fn()}
          onContinueRound={vi.fn()}
          onRestart={vi.fn()}
          onHome={vi.fn()}
          soundOptions={{ storage, createAudioContext }}
        />
      </StrictMode>
    );
    const { rerender, unmount } = render(table(initial));
    fireEvent.click(screen.getByRole('button', { name: 'Sound' }));
    expect(createAudioContext).toHaveBeenCalledOnce();

    const onePlay: GameState = {
      ...initial,
      currentTrick: [
        {
          playerId: 'ember',
          card: { id: 'strict-play', kind: 'suited', suit: 'clubs', rank: 4 },
        },
      ],
    };
    rerender(table(onePlay));
    expect(createOscillator).toHaveBeenCalledOnce();

    unmount();
    expect(close).toHaveBeenCalledOnce();
  });
});
