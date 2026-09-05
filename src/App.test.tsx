import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useWizardGame, type WizardGameController } from './app/useWizardGame';
import { App } from './App';
import { createMatch } from './game/state';

vi.mock('./app/useWizardGame', () => ({
  useWizardGame: vi.fn(),
}));

const useWizardGameMock = vi.mocked(useWizardGame);

function controller(
  overrides: Partial<WizardGameController> = {},
): WizardGameController {
  return {
    screen: 'home',
    state: null,
    hasSavedGame: false,
    storageWarning: false,
    legalActions: [],
    startGame: vi.fn(),
    continueGame: vi.fn(),
    dispatchHuman: vi.fn(),
    acknowledgeRound: vi.fn(),
    abandonGame: vi.fn(),
    ...overrides,
  };
}

describe('App', () => {
  beforeEach(() => {
    useWizardGameMock.mockReset();
  });

  it('shows the Wizard home screen from the controller', () => {
    useWizardGameMock.mockReturnValue(controller());
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Wizard' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Easy' })).toBeInTheDocument();
  });

  it('shows the game table when the controller has an active game', () => {
    const state = createMatch(42);
    useWizardGameMock.mockReturnValue(controller({ screen: 'game', state }));

    render(<App />);

    expect(screen.getByRole('heading', { name: 'Wizard game table' })).toBeInTheDocument();
    expect(screen.getByText('Round 1 of 15')).toBeInTheDocument();
  });

  it('keeps a storage warning visible during an active game', () => {
    const state = createMatch(42);
    useWizardGameMock.mockReturnValue(
      controller({ screen: 'game', state, storageWarning: true }),
    );

    render(<App />);

    expect(screen.getByText(/this match can continue, but resume may be unavailable/i)).toBeInTheDocument();
  });
});
