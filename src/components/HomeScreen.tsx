import { useRef, useState } from 'react';
import { AccessibleDialog } from './AccessibleDialog';
import { RulesDialog } from './RulesDialog';
import { StorageWarning } from './StorageWarning';

export interface HomeScreenProps {
  readonly hasSavedGame: boolean;
  readonly storageWarning: boolean;
  readonly onStart: () => void;
  readonly onContinue: () => void;
}

const HARD_MODE_DESCRIPTION_ID = 'hard-mode-description';
const NEW_GAME_DIALOG_TITLE_ID = 'new-game-dialog-title';
const NEW_GAME_DIALOG_DESCRIPTION_ID = 'new-game-dialog-description';

export function HomeScreen({
  hasSavedGame,
  storageWarning,
  onStart,
  onContinue,
}: HomeScreenProps) {
  const [openDialog, setOpenDialog] = useState<'new-game' | 'rules' | null>(null);
  const easyButtonRef = useRef<HTMLButtonElement>(null);
  const rulesButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  const startEasyGame = (): void => {
    if (hasSavedGame) {
      setOpenDialog('new-game');
      return;
    }

    onStart();
  };

  const confirmNewGame = (): void => {
    setOpenDialog(null);
    onStart();
  };

  return (
    <main className="home-screen" aria-labelledby="wizard-title">
      <div inert={openDialog !== null || undefined} aria-hidden={openDialog !== null || undefined}>
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
        <button ref={rulesButtonRef} type="button" onClick={() => setOpenDialog('rules')}>
          Rules
        </button>
      </div>

      <AccessibleDialog
        open={openDialog === 'new-game'}
        titleId={NEW_GAME_DIALOG_TITLE_ID}
        descriptionId={NEW_GAME_DIALOG_DESCRIPTION_ID}
        onClose={() => setOpenDialog(null)}
        initialFocusRef={cancelButtonRef}
        returnFocusRef={easyButtonRef}
      >
        <h2 id={NEW_GAME_DIALOG_TITLE_ID}>Start a new game?</h2>
        <p id={NEW_GAME_DIALOG_DESCRIPTION_ID}>Your saved match will be replaced.</p>
        <button type="button" onClick={confirmNewGame}>
          Start New Game
        </button>
        <button ref={cancelButtonRef} type="button" onClick={() => setOpenDialog(null)}>
          Cancel
        </button>
      </AccessibleDialog>
      <RulesDialog
        open={openDialog === 'rules'}
        onClose={() => setOpenDialog(null)}
        returnFocusRef={rulesButtonRef}
      />
    </main>
  );
}
