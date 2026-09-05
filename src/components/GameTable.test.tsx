import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createMatch, legalActions, reduceGame } from '../game/state';
import type { Card, GameState } from '../game/types';
import { GameTable } from './GameTable';

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

describe('GameTable', () => {
  it('shows all seats and opponent counts without leaking hidden faces or IDs', () => {
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
    expect(screen.getByRole('button', { name: /Ace of Hearts/ })).toBeInTheDocument();

    expect(container.innerHTML).not.toMatch(/secret-/i);
    expect(container.innerHTML).not.toMatch(/King of Clubs/i);
    expect(container.innerHTML).not.toMatch(/Queen of Hearts/i);
    expect(screen.queryByText(/^Wizard$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Jester$/)).not.toBeInTheDocument();
    expect(container.querySelector('[data-kind="wizard"], [data-kind="jester"]')).toBeNull();
  });

  it('announces round, phase, dealer, active player, score details, and trump in text', () => {
    const state = displayState();
    render(<GameTable state={state} legalActions={legalActions(state)} onAction={vi.fn()} />);

    expect(screen.getByText('Round 3 of 15')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Ember is bidding…');
    expect(within(screen.getByRole('region', { name: 'Ember seat' })).getByText('Active')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Rowan seat' })).getByText('Dealer')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'You seat' })).getByText('Bid: —')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'You seat' })).getByText('Tricks: 1')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'You seat' })).getByText('Score: 30')).toBeInTheDocument();
    expect(screen.getByText(/Trump: ♥ Hearts/)).toBeInTheDocument();
    expect(screen.getByText('Up card: Ten of Hearts')).toBeInTheDocument();
  });

  it('renders exactly the engine-provided human bid actions and emits the chosen payload', () => {
    const state = findDealtState(
      (candidate) => candidate.phase === 'bidding' && candidate.activePlayerId === 'human',
      3,
    );
    const actions = legalActions(state);
    const onAction = vi.fn();
    render(<GameTable state={state} legalActions={actions} onAction={onAction} />);

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

    expect(screen.getByText(/Revealed Wizard.*dealer chooses trump/i)).toBeInTheDocument();
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

  it('shows clear no-trump context for a revealed Jester', () => {
    const state = displayState({
      trump: null,
      revealedUpCard: { id: 'up-jester', kind: 'jester' },
    });
    render(<GameTable state={state} legalActions={legalActions(state)} onAction={vi.fn()} />);

    expect(screen.getByText('Trump: No trump')).toBeInTheDocument();
    expect(screen.getByText('Up card: Jester')).toBeInTheDocument();
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
    expect(screen.getByRole('status')).toHaveTextContent('Ember is playing…');
    expect(within(screen.getByRole('region', { name: 'Ember seat' })).getByText('Leader')).toBeInTheDocument();
  });

  it('renders trick plays in order with player names, accessible card names, and leader text', () => {
    const state = displayState({
      phase: 'trick-result',
      activePlayerId: 'rowan',
      currentTrick: [
        { playerId: 'rowan', card: { id: 'played-jester', kind: 'jester' } },
        {
          playerId: 'mira',
          card: { id: 'played-club-king', kind: 'suited', suit: 'clubs', rank: 13 },
        },
        { playerId: 'human', card: { id: 'played-wizard', kind: 'wizard' } },
      ],
    });
    render(<GameTable state={state} legalActions={legalActions(state)} onAction={vi.fn()} />);

    const plays = screen.getAllByRole('listitem');
    expect(plays).toHaveLength(3);
    expect(within(plays[0]).getByText('Rowan')).toBeInTheDocument();
    expect(within(plays[0]).getByLabelText('Jester')).toBeInTheDocument();
    expect(within(plays[1]).getByText('Mira')).toBeInTheDocument();
    expect(within(plays[1]).getByLabelText('King of Clubs')).toBeInTheDocument();
    expect(within(plays[2]).getByText('You')).toBeInTheDocument();
    expect(within(plays[2]).getByLabelText('Wizard')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Rowan seat' })).getByText('Leader')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Resolving trick…');
  });
});
