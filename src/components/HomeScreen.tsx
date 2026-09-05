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
      <div
        className="home-screen__panel"
        inert={openDialog !== null || undefined}
        aria-hidden={openDialog !== null || undefined}
      >
        <header className="home-hero">
          <p className="home-hero__eyebrow">A candlelit game of bids &amp; tricks</p>
          <h1 id="wizard-title" className="wizard-wordmark">
            <span aria-hidden="true">✦</span> Wizard <span aria-hidden="true">✦</span>
          </h1>
          <p className="home-hero__subtitle">
            Predict your tricks, command the trump suit, and outscore three rival spellcasters.
          </p>
        </header>

        {storageWarning ? <StorageWarning /> : null}

        {hasSavedGame ? (
          <button className="button button--continue" type="button" onClick={onContinue}>
            Continue Game
          </button>
        ) : null}

        <section className="mode-selector" aria-labelledby="choose-mode-heading">
          <h2 id="choose-mode-heading">Choose a mode</h2>
          <div className="mode-selector__grid">
            <button
              ref={easyButtonRef}
              className="mode-card mode-card--easy"
              type="button"
              aria-label="Easy"
              onClick={startEasyGame}
            >
              <span className="mode-card__icon" aria-hidden="true">♣</span>
              <span className="mode-card__title">Easy</span>
              <span className="mode-card__description">Friendly rivals · Random legal moves</span>
              <span className="mode-card__cta" aria-hidden="true">Enter the tavern →</span>
            </button>
            <button
              className="mode-card mode-card--locked"
              type="button"
              disabled
              aria-label="Hard — Beta"
              aria-describedby={HARD_MODE_DESCRIPTION_ID}
            >
              <span className="mode-card__icon" aria-hidden="true">♠</span>
              <span className="mode-card__title">Hard</span>
              <span className="beta-badge">Beta</span>
              <span className="mode-card__description">A sharper challenge is being conjured</span>
              <span className="mode-card__cta" aria-hidden="true">Locked</span>
            </button>
          </div>
          <p id={HARD_MODE_DESCRIPTION_ID} className="mode-selector__note">
            Hard mode is in Beta and coming soon.
          </p>
        </section>
        <div className="home-screen__secondary-actions">
          <button
            ref={rulesButtonRef}
            className="button button--secondary"
            type="button"
            aria-label="Rules"
            onClick={() => setOpenDialog('rules')}
          >
            Read the Rules
          </button>
        </div>
        <p className="fan-notice">
          An unofficial, fan-made browser game; not affiliated with the game’s publisher.
        </p>
      </div>

      <AccessibleDialog
        open={openDialog === 'new-game'}
        titleId={NEW_GAME_DIALOG_TITLE_ID}
        descriptionId={NEW_GAME_DIALOG_DESCRIPTION_ID}
        onClose={() => setOpenDialog(null)}
        initialFocusRef={cancelButtonRef}
        returnFocusRef={easyButtonRef}
        className="confirm-dialog"
      >
        <div className="dialog-heading">
          <span className="dialog-heading__rune" aria-hidden="true">✦</span>
          <h2 id={NEW_GAME_DIALOG_TITLE_ID}>Start a new game?</h2>
        </div>
        <p id={NEW_GAME_DIALOG_DESCRIPTION_ID}>Your saved match will be replaced.</p>
        <div className="dialog-actions">
          <button className="button button--danger" type="button" onClick={confirmNewGame}>
            Start New Game
          </button>
          <button
            ref={cancelButtonRef}
            className="button button--secondary"
            type="button"
            onClick={() => setOpenDialog(null)}
          >
            Cancel
          </button>
        </div>
      </AccessibleDialog>
      <RulesDialog
        open={openDialog === 'rules'}
        onClose={() => setOpenDialog(null)}
        returnFocusRef={rulesButtonRef}
      />
    </main>
  );
}
