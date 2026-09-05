import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { createMatch } from '../game/state';
import type { GameState } from '../game/types';
import { GameMenu } from './GameMenu';
import { MatchResult } from './MatchResult';
import { RoundSummary } from './RoundSummary';
import { RulesDialog } from './RulesDialog';
import { ScoreSheet } from './ScoreSheet';

function stateWithScores(overrides: Partial<GameState> = {}): GameState {
  return {
    ...createMatch(42),
    phase: 'round-result',
    round: 2,
    scores: { human: 70, ember: 0, rowan: 30, mira: -30 },
    roundScores: [
      {
        round: 1,
        trump: 'hearts',
        players: [
          { playerId: 'human', bid: 1, tricks: 1, delta: 30, cumulative: 30 },
          { playerId: 'ember', bid: 0, tricks: 1, delta: -10, cumulative: -10 },
          { playerId: 'rowan', bid: 0, tricks: 0, delta: 20, cumulative: 20 },
          { playerId: 'mira', bid: 1, tricks: 0, delta: -10, cumulative: -10 },
        ],
      },
      {
        round: 2,
        trump: null,
        players: [
          { playerId: 'human', bid: 2, tricks: 2, delta: 40, cumulative: 70 },
          { playerId: 'ember', bid: 1, tricks: 0, delta: -10, cumulative: -20 },
          { playerId: 'rowan', bid: 1, tricks: 1, delta: 30, cumulative: 50 },
          { playerId: 'mira', bid: 0, tricks: 2, delta: -20, cumulative: -30 },
        ],
      },
    ],
    ...overrides,
  };
}

describe('ScoreSheet', () => {
  it('shows captioned round records with trump and every named player value', () => {
    const state = stateWithScores();
    render(
      <ScoreSheet
        open
        players={state.players}
        roundScores={state.roundScores}
        onClose={vi.fn()}
      />,
    );

    const table = screen.getByRole('table', { name: 'Complete score sheet' });
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      'Round',
      'Trump',
      'Player',
      'Bid',
      'Tricks',
      'Delta',
      'Total',
    ]);
    expect(within(table).getByText('♥ Hearts')).toBeInTheDocument();
    expect(within(table).getByText('No trump')).toBeInTheDocument();

    for (const name of ['You', 'Ember', 'Rowan', 'Mira']) {
      expect(within(table).getAllByText(name)).toHaveLength(2);
    }

    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(9);
    expect(within(table).getAllByRole('rowgroup')).toHaveLength(3);
    expect(rows[1]).toHaveTextContent('1♥ HeartsYou11+3030');
    expect(rows[6]).toHaveTextContent('Ember10−10−20');
  });

  it('shows an explicit empty state before any round is scored', () => {
    const state = stateWithScores({ roundScores: [] });
    render(
      <ScoreSheet open players={state.players} roundScores={state.roundScores} onClose={vi.fn()} />,
    );

    expect(screen.getByText('No rounds scored yet.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('closes by button or Escape and restores focus to its opener', async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      const state = stateWithScores();
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open scores
          </button>
          <ScoreSheet
            open={open}
            players={state.players}
            roundScores={state.roundScores}
            onClose={() => setOpen(false)}
          />
        </>
      );
    }

    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Open scores' });

    opener.focus();
    fireEvent.click(opener);
    fireEvent.click(screen.getByRole('button', { name: 'Close score sheet' }));
    await waitFor(() => expect(opener).toHaveFocus());

    opener.focus();
    fireEvent.click(opener);
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Score sheet' }), { key: 'Escape' });
    await waitFor(() => expect(opener).toHaveFocus());
  });
});

describe('RoundSummary', () => {
  it('explains exact and missed bids from the stored score row', () => {
    const state = stateWithScores();
    render(<RoundSummary state={state} onContinue={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Round 2 complete' })).toBeInTheDocument();
    const you = screen.getByRole('listitem', { name: /you/i });
    expect(you).toHaveTextContent('Bid 2');
    expect(you).toHaveTextContent('Won 2 tricks');
    expect(you).toHaveTextContent('20 + (10 × 2) = +40');
    expect(you).toHaveTextContent('Total 70');

    const ember = screen.getByRole('listitem', { name: /ember/i });
    expect(ember).toHaveTextContent('Bid 1');
    expect(ember).toHaveTextContent('Won 0 tricks');
    expect(ember).toHaveTextContent('10 × |0 − 1| = 10 point loss (−10)');
    expect(ember).toHaveTextContent('Total −20');
  });

  it('continues the round exactly once from one activation', () => {
    const onContinue = vi.fn();
    render(<RoundSummary state={stateWithScores()} onContinue={onContinue} />);

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(onContinue).toHaveBeenCalledOnce();
  });
});

describe('MatchResult', () => {
  it('announces one winner, sorts standings by score, and invokes result actions', () => {
    const onNewMatch = vi.fn();
    const onHome = vi.fn();
    const state = stateWithScores({
      phase: 'match-result',
      scores: { human: 110, ember: 60, rowan: 60, mira: -20 },
    });
    render(<MatchResult state={state} onNewMatch={onNewMatch} onHome={onHome} />);

    expect(screen.getByRole('heading', { name: 'Match complete' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('You win with 110 points!');
    expect(
      within(screen.getByRole('list', { name: 'Final standings' }))
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['You — 110', 'Ember — 60', 'Rowan — 60', 'Mira — −20']);

    fireEvent.click(screen.getByRole('button', { name: 'New Match' }));
    fireEvent.click(screen.getByRole('button', { name: 'Return Home' }));
    expect(onNewMatch).toHaveBeenCalledOnce();
    expect(onHome).toHaveBeenCalledOnce();
  });

  it('announces shared winners and keeps the complete score sheet available', () => {
    const state = stateWithScores({
      phase: 'match-result',
      scores: { human: 100, ember: 120, rowan: 120, mira: 0 },
    });
    render(<MatchResult state={state} onNewMatch={vi.fn()} onHome={vi.fn()} />);

    expect(screen.getByRole('status')).toHaveTextContent(
      'Ember and Rowan share the win with 120 points!',
    );
    const standings = within(screen.getByRole('list', { name: 'Final standings' })).getAllByRole(
      'listitem',
    );
    expect(standings.map((item) => (item as HTMLLIElement).value)).toEqual([1, 1, 3, 4]);
    expect(standings.map((item) => item.textContent)).toEqual([
      'Ember — 120',
      'Rowan — 120',
      'You — 100',
      'Mira — 0',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Score Sheet' }));
    expect(screen.getByRole('dialog', { name: 'Score sheet' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Complete score sheet' })).toBeInTheDocument();
  });
});

describe('RulesDialog', () => {
  it('marks and contains the non-native modal fallback', () => {
    const prototype = HTMLDialogElement.prototype;
    const showModalDescriptor = Object.getOwnPropertyDescriptor(prototype, 'showModal');
    Object.defineProperty(prototype, 'showModal', { configurable: true, value: undefined });

    try {
      render(
        <>
          <button type="button" data-testid="background-action">Background action</button>
          <RulesDialog open onClose={vi.fn()} />
        </>,
      );

      const dialog = screen.getByRole('dialog', { name: 'How to play Wizard' });
      expect(dialog).toHaveClass('app-dialog', 'rules-dialog');
      expect(dialog).toHaveAttribute('data-fallback', 'true');
      expect(dialog).toHaveAttribute('open');
      expect(screen.getByTestId('background-action')).toHaveAttribute('inert');
    } finally {
      if (showModalDescriptor === undefined) {
        Reflect.deleteProperty(prototype, 'showModal');
      } else {
        Object.defineProperty(prototype, 'showModal', showModalDescriptor);
      }
    }
  });

  it('summarizes every game rule in original concise prose', () => {
    const onClose = vi.fn();
    render(<RulesDialog open onClose={onClose} />);

    const dialog = screen.getByRole('dialog', { name: 'How to play Wizard' });
    expect(within(dialog).getByRole('heading', { name: 'Objective' })).toBeInTheDocument();
    expect(dialog).toHaveTextContent(/60-card deck.*52 suited.*four Wizards.*four Jesters/i);
    expect(dialog).toHaveTextContent(/15 rounds/i);
    expect(dialog).toHaveTextContent(/suited up-card.*trump/i);
    expect(dialog).toHaveTextContent(/Wizard.*dealer chooses/i);
    expect(dialog).toHaveTextContent(/Jester.*no trump/i);
    expect(dialog).toHaveTextContent(/final round.*no trump/i);
    expect(dialog).toHaveTextContent(/bids.*unrestricted.*zero.*cards in your hand/i);
    expect(dialog).toHaveTextContent(/left of the dealer.*bids first.*dealer bids last/i);
    expect(dialog).toHaveTextContent(/left of the dealer leads the first trick.*winner leads next/i);
    expect(dialog).toHaveTextContent(/follow the led suit/i);
    expect(dialog).toHaveTextContent(/Wizard.*Jester.*any time/i);
    expect(dialog).toHaveTextContent(/Jester leads.*first later suited card.*led suit/i);
    expect(dialog).toHaveTextContent(/Wizard appears before a suited card.*no led suit/i);
    expect(dialog).toHaveTextContent(
      /first Wizard.*highest trump.*highest card of the led suit.*all.*Jesters.*first Jester/i,
    );
    expect(dialog).toHaveTextContent(/20 \+ \(10 × bid\)/i);
    expect(dialog).toHaveTextContent(/10 × \|tricks won − bid\|/i);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close rules' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('GameMenu', () => {
  function MenuHarness({
    state = stateWithScores(),
    onRestart = vi.fn(),
    onHome = vi.fn(),
    onToggleSound = vi.fn(),
  }: {
    state?: GameState;
    onRestart?: () => void;
    onHome?: () => void;
    onToggleSound?: () => void;
  }) {
    const [soundEnabled, setSoundEnabled] = useState(false);
    return (
      <GameMenu
        state={state}
        soundEnabled={soundEnabled}
        onToggleSound={() => {
          onToggleSound();
          setSoundEnabled((enabled) => !enabled);
        }}
        onRestart={onRestart}
        onHome={onHome}
      />
    );
  }

  it('opens the score sheet and rules, restores focus, and toggles the labelled sound state', async () => {
    const onToggleSound = vi.fn();
    render(<MenuHarness onToggleSound={onToggleSound} />);

    const menu = screen.getByRole('group', { name: 'Game menu' });
    expect(screen.queryByRole('toolbar', { name: 'Game menu' })).not.toBeInTheDocument();
    const scoresButton = screen.getByRole('button', { name: 'Score Sheet' });
    fireEvent.click(scoresButton);
    expect(screen.getByRole('dialog', { name: 'Score sheet' })).toBeInTheDocument();
    expect(menu).toHaveAttribute('inert');
    fireEvent.click(screen.getByRole('button', { name: 'Close score sheet' }));
    await waitFor(() => expect(scoresButton).toHaveFocus());
    expect(menu).not.toHaveAttribute('inert');

    const rulesButton = screen.getByRole('button', { name: 'Rules' });
    fireEvent.click(rulesButton);
    expect(screen.getByRole('dialog', { name: 'How to play Wizard' })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'How to play Wizard' }), {
      key: 'Escape',
    });
    await waitFor(() => expect(rulesButton).toHaveFocus());

    const soundButton = screen.getByRole('button', { name: 'Sound' });
    expect(soundButton).toHaveAttribute('aria-pressed', 'false');
    expect(within(soundButton).getByText('Off')).toBeVisible();
    fireEvent.click(soundButton);
    expect(onToggleSound).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Sound' })).toBe(soundButton);
    expect(soundButton).toHaveAttribute('aria-pressed', 'true');
    expect(within(soundButton).getByText('On')).toBeVisible();
  });

  it('cancels or confirms restart with the consequence, Escape, and focus restoration', async () => {
    const onRestart = vi.fn();
    render(<MenuHarness onRestart={onRestart} />);
    const restart = screen.getByRole('button', { name: 'Restart' });

    fireEvent.click(restart);
    const firstDialog = screen.getByRole('dialog', { name: 'Restart match?' });
    expect(firstDialog).toHaveTextContent(/unfinished match.*lost/i);
    expect(firstDialog).toHaveAccessibleDescription(
      'Your current unfinished match will be lost and replaced with a new match.',
    );
    expect(firstDialog).toHaveAttribute('aria-describedby', 'restart-match-description');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Cancel' }), { key: 'Tab' });
    expect(screen.getByRole('button', { name: 'Restart Match' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Restart Match' }), {
      key: 'Tab',
      shiftKey: true,
    });
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(restart).toHaveFocus());
    expect(onRestart).not.toHaveBeenCalled();

    fireEvent.click(restart);
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Restart match?' }), { key: 'Escape' });
    await waitFor(() => expect(restart).toHaveFocus());

    fireEvent.click(restart);
    fireEvent.click(screen.getByRole('button', { name: 'Restart Match' }));
    expect(onRestart).toHaveBeenCalledOnce();
  });

  it('confirms returning home during play, but completed matches navigate immediately', () => {
    const onHome = vi.fn();
    const { unmount } = render(<MenuHarness onHome={onHome} />);

    fireEvent.click(screen.getByRole('button', { name: 'Return Home' }));
    const dialog = screen.getByRole('dialog', { name: 'Return home?' });
    expect(dialog).toHaveTextContent(/unfinished match.*abandoned/i);
    expect(dialog).toHaveAccessibleDescription(
      'Your unfinished match will be abandoned and its saved progress removed.',
    );
    expect(dialog).toHaveAttribute('aria-describedby', 'return-home-description');
    expect(onHome).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Return Home and Abandon Match' }));
    expect(onHome).toHaveBeenCalledOnce();

    unmount();
    const completedHome = vi.fn();
    const completedRestart = vi.fn();
    render(
      <MenuHarness
        state={stateWithScores({ phase: 'match-result' })}
        onHome={completedHome}
        onRestart={completedRestart}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Return Home' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restart' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(completedHome).toHaveBeenCalledOnce();
    expect(completedRestart).toHaveBeenCalledOnce();
  });
});
