import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { HomeScreen } from './HomeScreen';

function renderHome(
  overrides: Partial<React.ComponentProps<typeof HomeScreen>> = {},
) {
  const props: React.ComponentProps<typeof HomeScreen> = {
    hasSavedGame: false,
    storageWarning: false,
    onStart: vi.fn(),
    onContinue: vi.fn(),
    ...overrides,
  };

  render(<HomeScreen {...props} />);
  return props;
}

describe('HomeScreen', () => {
  it('starts Easy mode immediately when no saved game exists', () => {
    const props = renderHome();
    const easyButton = screen.getByRole('button', { name: 'Easy' });

    expect(easyButton).not.toHaveAttribute('aria-label');
    expect(easyButton).toHaveAttribute('aria-describedby', 'easy-mode-description');
    expect(easyButton).toHaveAccessibleDescription('Friendly rivals · Random legal moves');
    fireEvent.click(easyButton);

    expect(props.onStart).toHaveBeenCalledWith('easy');
  });

  it('offers Medium as an enabled rule-based mode', () => {
    const props = renderHome();
    const mediumButton = screen.getByRole('button', { name: 'Medium' });

    expect(mediumButton).toBeEnabled();
    expect(mediumButton).toHaveAccessibleDescription(/strategic rule-based rivals/i);
    fireEvent.click(mediumButton);

    expect(props.onStart).toHaveBeenCalledWith('medium');
  });

  it('shows Hard as a described native disabled Beta option', () => {
    const props = renderHome();
    const hardButton = screen.getByRole('button', { name: /hard.*beta/i });
    const descriptionId = hardButton.getAttribute('aria-describedby');

    expect(hardButton).toBeDisabled();
    expect(descriptionId).toBeTruthy();
    expect(document.getElementById(descriptionId as string)).toHaveTextContent(/beta.*coming soon/i);

    fireEvent.click(hardButton);
    expect(props.onStart).not.toHaveBeenCalled();
  });

  it('shows Continue Game only for a saved match and invokes it', () => {
    const withoutSave = renderHome();
    expect(screen.queryByRole('button', { name: 'Continue Game' })).not.toBeInTheDocument();
    expect(withoutSave.onContinue).not.toHaveBeenCalled();

    const withSave = renderHome({ hasSavedGame: true });
    fireEvent.click(screen.getByRole('button', { name: 'Continue Game' }));

    expect(withSave.onContinue).toHaveBeenCalledOnce();
  });

  it('requires confirmation before replacing a saved match', () => {
    const props = renderHome({ hasSavedGame: true });

    fireEvent.click(screen.getByRole('button', { name: 'Easy' }));

    expect(props.onStart).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', { name: 'Start a new game?' });
    expect(dialog).toHaveAccessibleDescription('Your saved match will be replaced.');
    expect(dialog).toHaveAttribute('aria-describedby', 'new-game-dialog-description');

    fireEvent.click(screen.getByRole('button', { name: 'Start New Game' }));

    expect(props.onStart).toHaveBeenCalledWith('easy');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('cancels new-game confirmation and restores focus to Easy', () => {
    const props = renderHome({ hasSavedGame: true });
    const easyButton = screen.getByRole('button', { name: 'Easy' });

    fireEvent.click(easyButton);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(props.onStart).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(easyButton).toHaveFocus();
  });

  it('closes new-game confirmation with Escape', () => {
    renderHome({ hasSavedGame: true });
    const easyButton = screen.getByRole('button', { name: 'Easy' });

    fireEvent.click(easyButton);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(easyButton).toHaveFocus();
  });

  it('keeps confirmation modal by making the background inert and containing focus', () => {
    renderHome({ hasSavedGame: true });
    const easyButton = screen.getByRole('button', { name: 'Easy' });

    fireEvent.click(easyButton);
    const dialog = screen.getByRole('dialog');
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    const confirmButton = screen.getByRole('button', { name: 'Start New Game' });

    expect(easyButton.closest('[inert]')).toBeInTheDocument();
    expect(cancelButton).toHaveFocus();

    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(confirmButton).toHaveFocus();

    easyButton.focus();
    expect(cancelButton).toHaveFocus();

    fireEvent.keyDown(cancelButton, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(easyButton).toHaveFocus();
  });

  it('shows a nonblocking storage warning', () => {
    renderHome({ storageWarning: true });

    expect(screen.getByRole('status')).toHaveTextContent(
      /this match can continue, but resume may be unavailable/i,
    );
  });

  it('opens the rules from home, closes with Escape, and restores focus', async () => {
    renderHome();
    const rulesButton = screen.getByRole('button', { name: 'Rules' });

    fireEvent.click(rulesButton);
    expect(screen.getByRole('dialog', { name: 'How to play Wizard' })).toHaveTextContent(
      /60-card deck/i,
    );

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'How to play Wizard' }), {
      key: 'Escape',
    });

    expect(screen.queryByRole('dialog', { name: 'How to play Wizard' })).not.toBeInTheDocument();
    expect(rulesButton).toHaveFocus();
  });
});
