import { useEffect, useRef, useState } from 'react';

export interface HomeScreenProps {
  readonly hasSavedGame: boolean;
  readonly storageWarning: boolean;
  readonly onStart: () => void;
  readonly onContinue: () => void;
}

const HARD_MODE_DESCRIPTION_ID = 'hard-mode-description';
const NEW_GAME_DIALOG_TITLE_ID = 'new-game-dialog-title';

export function HomeScreen({
  hasSavedGame,
  storageWarning,
  onStart,
  onContinue,
}: HomeScreenProps) {
  const [confirmingNewGame, setConfirmingNewGame] = useState(false);
  const easyButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreEasyFocusRef = useRef(false);

  useEffect(() => {
    if (confirmingNewGame) {
      cancelButtonRef.current?.focus();
      return;
    }

    if (restoreEasyFocusRef.current) {
      restoreEasyFocusRef.current = false;
      easyButtonRef.current?.focus();
    }
  }, [confirmingNewGame]);

  const closeConfirmation = (): void => {
    restoreEasyFocusRef.current = true;
    setConfirmingNewGame(false);
  };

  const startEasyGame = (): void => {
    if (hasSavedGame) {
      setConfirmingNewGame(true);
      return;
    }

    onStart();
  };

  const confirmNewGame = (): void => {
    setConfirmingNewGame(false);
    onStart();
  };

  return (
    <main
      className="home-screen"
      aria-labelledby="wizard-title"
      onFocusCapture={(event) => {
        if (confirmingNewGame && !dialogRef.current?.contains(event.target as Node)) {
          cancelButtonRef.current?.focus();
        }
      }}
      onKeyDownCapture={(event) => {
        if (confirmingNewGame && event.key === 'Escape') {
          event.preventDefault();
          closeConfirmation();
        }
      }}
    >
      <div inert={confirmingNewGame || undefined} aria-hidden={confirmingNewGame || undefined}>
        <header>
          <h1 id="wizard-title">Wizard</h1>
          <p>Predict your tricks, command the trump suit, and outscore three rival spellcasters.</p>
        </header>

        {storageWarning ? <StorageWarning /> : null}

        {hasSavedGame ? (
          <button type="button" onClick={onContinue}>
            Continue Game
          </button>
        ) : null}

        <section aria-labelledby="choose-mode-heading">
          <h2 id="choose-mode-heading">Choose a mode</h2>
          <button ref={easyButtonRef} type="button" onClick={startEasyGame}>
            Easy
          </button>
          <button type="button" disabled aria-describedby={HARD_MODE_DESCRIPTION_ID}>
            Hard <span>Beta</span>
          </button>
          <p id={HARD_MODE_DESCRIPTION_ID}>Hard mode is in Beta and coming soon.</p>
        </section>
      </div>

      {confirmingNewGame ? (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={NEW_GAME_DIALOG_TITLE_ID}
          onKeyDown={(event) => {
            if (event.key === 'Tab') {
              event.preventDefault();
              const buttons = Array.from(
                dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ??
                  [],
              );
              const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
              const direction = event.shiftKey ? -1 : 1;
              const nextIndex =
                currentIndex < 0
                  ? 0
                  : (currentIndex + direction + buttons.length) % buttons.length;
              buttons[nextIndex]?.focus();
            }
          }}
        >
          <h2 id={NEW_GAME_DIALOG_TITLE_ID}>Start a new game?</h2>
          <p>Your saved match will be replaced.</p>
          <button type="button" onClick={confirmNewGame}>
            Start New Game
          </button>
          <button ref={cancelButtonRef} type="button" onClick={closeConfirmation}>
            Cancel
          </button>
        </div>
      ) : null}
    </main>
  );
}

export function StorageWarning() {
  return (
    <p role="status" className="storage-notice">
      This match can continue, but resume may be unavailable because browser storage could not be
      accessed.
    </p>
  );
}
