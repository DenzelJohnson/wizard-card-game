import { useRef, useState } from 'react';
import { AccessibleDialog } from './AccessibleDialog';
import { RulesDialog } from './RulesDialog';
import { StorageWarning } from './StorageWarning';
import type { Difficulty } from '../game/types';

export interface HomeScreenProps {
  readonly hasSavedGame: boolean;
  readonly storageWarning: boolean;
  readonly onStart: (difficulty: Difficulty) => void;
  readonly onContinue: () => void;
}

const EASY_MODE_TITLE_ID = 'easy-mode-title';
const MEDIUM_MODE_TITLE_ID = 'medium-mode-title';
const NEW_GAME_DIALOG_TITLE_ID = 'new-game-dialog-title';
const NEW_GAME_DIALOG_DESCRIPTION_ID = 'new-game-dialog-description';

export function HomeScreen({
  hasSavedGame,
  storageWarning,
  onStart,
  onContinue,
}: HomeScreenProps) {
  const [openDialog, setOpenDialog] = useState<'new-game' | 'rules' | null>(null);
  const newGameTriggerRef = useRef<HTMLButtonElement>(null);
  const rulesButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const [pendingDifficulty, setPendingDifficulty] = useState<Difficulty>('easy');

  const startGame = (difficulty: Difficulty, trigger: HTMLButtonElement): void => {
    if (hasSavedGame) {
      newGameTriggerRef.current = trigger;
      setPendingDifficulty(difficulty);
      setOpenDialog('new-game');
      return;
    }

    onStart(difficulty);
  };

  const confirmNewGame = (): void => {
    setOpenDialog(null);
    onStart(pendingDifficulty);
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
              className="mode-card mode-card--easy"
              type="button"
              aria-labelledby={EASY_MODE_TITLE_ID}
              onClick={(event) => startGame('easy', event.currentTarget)}
            >
              <span id={EASY_MODE_TITLE_ID} className="mode-card__title">Easy</span>
            </button>
            <button
              className="mode-card mode-card--medium"
              type="button"
              aria-labelledby={MEDIUM_MODE_TITLE_ID}
              onClick={(event) => startGame('medium', event.currentTarget)}
            >
              <span id={MEDIUM_MODE_TITLE_ID} className="mode-card__title">Medium</span>
            </button>
            <button
              className="mode-card mode-card--locked"
              type="button"
              disabled
              aria-label="Hard — Beta"
            >
              <span className="mode-card__title">Hard</span>
              <span className="beta-badge">Beta</span>
              <span className="mode-card__status" aria-hidden="true">Locked</span>
            </button>
          </div>
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
        returnFocusRef={newGameTriggerRef}
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
