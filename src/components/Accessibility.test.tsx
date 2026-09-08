import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createMatch, legalActions } from '../game/state';
import type { Card, GameState } from '../game/types';
import { GameTable } from './GameTable';
import { HomeScreen } from './HomeScreen';
import { PlayingCard } from './PlayingCard';

const aceOfHearts: Card = {
  id: 'visible-heart-ace',
  kind: 'suited',
  suit: 'hearts',
  rank: 14,
};

function accessibleTableState(overrides: Partial<GameState> = {}): GameState {
  return {
    ...createMatch(21),
    phase: 'bidding',
    round: 3,
    dealerId: 'rowan',
    activePlayerId: 'ember',
    drawPile: [],
    hands: {
      human: [aceOfHearts],
      ember: [{ id: 'secret-ember-card', kind: 'wizard' }],
      rowan: [{ id: 'secret-rowan-card', kind: 'jester' }],
      mira: [{ id: 'secret-mira-card', kind: 'suited', suit: 'clubs', rank: 4 }],
    },
    trump: 'hearts',
    revealedUpCard: { id: 'up-heart-ten', kind: 'suited', suit: 'hearts', rank: 10 },
    bids: [],
    currentTrick: [],
    completedTricks: [],
    tricksWon: { human: 0, ember: 0, rowan: 0, mira: 0 },
    scores: { human: 0, ember: 0, rowan: 0, mira: 0 },
    ...overrides,
  };
}

describe('screen accessibility contracts', () => {
  it('keeps the home screen to one main landmark with ordered headings and named actions', () => {
    const { container } = render(
      <HomeScreen
        hasSavedGame
        storageWarning={false}
        onStart={vi.fn()}
        onContinue={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Wizard' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Choose a mode' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /hard.*beta/i })).toBeDisabled();
    for (const action of screen.getAllByRole('button')) {
      expect(action).toHaveAccessibleName();
    }
    expect(
      container.querySelector('[tabindex]:not([tabindex="0"]):not([tabindex="-1"])'),
    ).toBeNull();
  });

  it('keeps the game to one main landmark with an accessible face-up card and style-free markers', () => {
    const state = accessibleTableState();
    const { container } = render(
      <GameTable state={state} legalActions={legalActions(state)} onAction={vi.fn()} />,
    );

    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Wizard game table' })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    const reveal = screen.getByLabelText('Face-up card: Ten of Hearts. Hearts are trump.');
    expect(within(reveal).getByRole('img', { name: 'Ten of Hearts' })).toBeInTheDocument();
    expect(screen.queryByText(/Trump:/)).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Ember seat' })).getByText('Active'),
    ).toHaveClass('seat-marker--active');
    expect(
      within(screen.getByRole('region', { name: 'Rowan seat' })).getByText('Dealer'),
    ).toHaveClass('seat-marker--dealer');
    for (const action of screen.getAllByRole('button')) {
      expect(action).toHaveAccessibleName();
    }
    expect(container.querySelector('[style]')).toBeNull();
    expect(
      container.querySelector('[tabindex]:not([tabindex="0"]):not([tabindex="-1"])'),
    ).toBeNull();
    expect(container.innerHTML).not.toContain('secret-');
  });
});

describe('PlayingCard visual contract', () => {
  it('provides suited corner, pip, and text hooks while keeping one parent label', () => {
    const { container } = render(
      <PlayingCard card={aceOfHearts} playable onPlay={vi.fn()} />,
    );

    const card = screen.getByRole('button', { name: 'Play Ace of Hearts' });
    expect(card).toHaveAttribute('data-kind', 'suited');
    expect(card).toHaveAttribute('data-suit', 'hearts');
    expect(card).not.toHaveAttribute('tabindex');
    expect(card).toHaveTextContent('A');
    expect(card).toHaveTextContent('♥');
    expect(card).toHaveTextContent('Hearts');
    expect(card.querySelector('.playing-card__face')).toHaveAttribute('aria-hidden', 'true');
    expect(
      card.querySelector('.playing-card__corner--top .playing-card__rank'),
    ).toHaveTextContent('A');
    expect(
      card.querySelector('.playing-card__corner--top .playing-card__suit'),
    ).toHaveTextContent('♥');
    expect(card.querySelector('.playing-card__pip')).toHaveTextContent('♥');
    expect(card.querySelector('.playing-card__suit-name')).toHaveTextContent('Hearts');
    expect(container.querySelectorAll('[aria-label]')).toHaveLength(1);
  });

  it('provides original Wizard and Jester face hooks with hidden ornament', () => {
    render(
      <>
        <PlayingCard card={{ id: 'wizard-face', kind: 'wizard' }} playable onPlay={vi.fn()} />
        <PlayingCard card={{ id: 'jester-face', kind: 'jester' }} playable onPlay={vi.fn()} />
      </>,
    );

    const wizard = screen.getByRole('button', { name: 'Play Wizard' });
    const jester = screen.getByRole('button', { name: 'Play Jester' });
    expect(wizard.querySelector('.playing-card__face--wizard')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(wizard.querySelector('.playing-card__rank')).toHaveTextContent('W');
    expect(wizard.querySelector('.playing-card__special-label')).toHaveTextContent('Wizard');
    expect(wizard.querySelector('.playing-card__rune')).toBeInTheDocument();
    expect(jester.querySelector('.playing-card__face--jester')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(jester.querySelector('.playing-card__rank')).toHaveTextContent('J');
    expect(jester.querySelector('.playing-card__special-label')).toHaveTextContent('Jester');
    expect(jester.querySelector('.playing-card__bells')).toBeInTheDocument();
  });

  it('keeps card backs anonymous and free of face data', () => {
    render(<PlayingCard card={aceOfHearts} playable={false} faceDown />);

    const back = screen.getByRole('img', { name: 'Face-down card' });
    expect(back).toHaveClass('playing-card--back');
    expect(back).not.toHaveAttribute('data-card-id');
    expect(back).not.toHaveAttribute('data-kind');
    expect(back).not.toHaveAttribute('data-suit');
    expect(back.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });
});
