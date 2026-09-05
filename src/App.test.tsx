import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useWizardGame, type WizardGameController } from './app/useWizardGame';
import { App } from './App';
import { createMatch, legalActions } from './game/state';

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
    const startGame = vi.fn();
    useWizardGameMock.mockReturnValue(controller({ startGame }));
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Wizard' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Easy' }));
    expect(startGame).toHaveBeenCalledOnce();
  });

  it('routes Continue Game to the controller', () => {
    const continueGame = vi.fn();
    useWizardGameMock.mockReturnValue(
      controller({ hasSavedGame: true, continueGame }),
    );

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue Game' }));

    expect(continueGame).toHaveBeenCalledOnce();
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

    expect(
      within(screen.getByRole('main')).getByText(
        /this match can continue, but resume may be unavailable/i,
      ),
    ).toBeInTheDocument();
  });

  it('routes a human table decision to the controller', () => {
    const state = {
      ...createMatch(42),
      phase: 'bidding' as const,
      round: 1,
      dealerId: 'mira' as const,
      activePlayerId: 'human' as const,
    };
    const actions = legalActions(state);
    const dispatchHuman = vi.fn();
    useWizardGameMock.mockReturnValue(
      controller({ screen: 'game', state, legalActions: actions, dispatchHuman }),
    );

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Bid 1' }));

    expect(dispatchHuman).toHaveBeenCalledWith({
      type: 'PLACE_BID',
      playerId: 'human',
      bid: 1,
    });
  });

  it('routes round acknowledgement from the round summary', () => {
    const acknowledgeRound = vi.fn();
    const state = {
      ...createMatch(42),
      phase: 'round-result' as const,
      roundScores: [
        {
          round: 1,
          trump: null,
          players: [
            { playerId: 'human' as const, bid: 0, tricks: 0, delta: 20, cumulative: 20 },
            { playerId: 'ember' as const, bid: 0, tricks: 0, delta: 20, cumulative: 20 },
            { playerId: 'rowan' as const, bid: 0, tricks: 0, delta: 20, cumulative: 20 },
            { playerId: 'mira' as const, bid: 0, tricks: 0, delta: 20, cumulative: 20 },
          ],
        },
      ],
    };
    useWizardGameMock.mockReturnValue(
      controller({ screen: 'game', state, acknowledgeRound }),
    );

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(acknowledgeRound).toHaveBeenCalledOnce();
  });

  it('routes final new-match and home actions to start and abandon', () => {
    const startGame = vi.fn();
    const abandonGame = vi.fn();
    const state = {
      ...createMatch(42),
      phase: 'match-result' as const,
      scores: { human: 40, ember: 20, rowan: 0, mira: -10 },
    };
    useWizardGameMock.mockReturnValue(
      controller({ screen: 'game', state, startGame, abandonGame }),
    );

    render(<App />);
    const result = screen.getByRole('region', { name: 'Match complete' });
    fireEvent.click(within(result).getByRole('button', { name: 'New Match' }));
    fireEvent.click(within(result).getByRole('button', { name: 'Return Home' }));

    expect(startGame).toHaveBeenCalledOnce();
    expect(abandonGame).toHaveBeenCalledOnce();
  });
});
