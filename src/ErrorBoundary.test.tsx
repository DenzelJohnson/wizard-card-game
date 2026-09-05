import { fireEvent, render, screen } from '@testing-library/react';
import { Component, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppErrorBoundary } from './ErrorBoundary';
import { createMatch } from './game/state';
import { SAVE_KEY } from './storage/save';

class BrokenChild extends Component {
  override render(): ReactNode {
    throw new Error('forced render failure');
  }
}

describe('AppErrorBoundary', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('shows an accessible home-recovery screen after a child render failure', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <AppErrorBoundary>
        <BrokenChild />
      </AppErrorBoundary>,
    );

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveAccessibleName('The spell fizzled');
    expect(screen.getByRole('link', { name: 'Return Home' })).toHaveAttribute('href', '/');
    expect(screen.getByText(/continue game/i)).toBeInTheDocument();
  });

  it('does not erase a saved match when the player uses the recovery action', () => {
    const savedMatch = JSON.stringify(createMatch(42));
    window.localStorage.setItem(SAVE_KEY, savedMatch);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <AppErrorBoundary>
        <BrokenChild />
      </AppErrorBoundary>,
    );

    const returnHome = screen.getByRole('link', { name: 'Return Home' });
    returnHome.addEventListener('click', (event) => event.preventDefault());
    fireEvent.click(returnHome);

    expect(window.localStorage.getItem(SAVE_KEY)).toBe(savedMatch);
  });
});
