import { useRef, useState } from 'react';

import type { GameState } from '../game/types';
import { AccessibleDialog } from './AccessibleDialog';
import { RulesDialog } from './RulesDialog';
import { ScoreSheet } from './ScoreSheet';

export interface GameMenuProps {
  readonly state: GameState;
  readonly soundEnabled: boolean;
  readonly onToggleSound: () => void;
  readonly onRestart: () => void;
  readonly onHome: () => void;
}

type OpenPanel = 'scores' | 'rules' | 'restart' | 'home' | null;

export function GameMenu({
  state,
  soundEnabled,
  onToggleSound,
  onRestart,
  onHome,
}: GameMenuProps) {
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const scoreSheetButtonRef = useRef<HTMLButtonElement>(null);
  const rulesButtonRef = useRef<HTMLButtonElement>(null);
  const restartButtonRef = useRef<HTMLButtonElement>(null);
  const homeButtonRef = useRef<HTMLButtonElement>(null);
  const matchComplete = state.phase === 'match-result';

  const requestRestart = (): void => {
    if (matchComplete) {
      onRestart();
    } else {
      setOpenPanel('restart');
    }
  };

  const requestHome = (): void => {
    if (matchComplete) {
      onHome();
    } else {
      setOpenPanel('home');
    }
  };

  return (
    <>
      <div className="game-menu" role="toolbar" aria-label="Game menu">
        <button ref={scoreSheetButtonRef} type="button" onClick={() => setOpenPanel('scores')}>
          Score Sheet
        </button>
        <button ref={rulesButtonRef} type="button" onClick={() => setOpenPanel('rules')}>
          Rules
        </button>
        <button type="button" aria-pressed={soundEnabled} onClick={onToggleSound}>
          Sound {soundEnabled ? 'On' : 'Off'}
        </button>
        <button ref={restartButtonRef} type="button" onClick={requestRestart}>
          Restart
        </button>
        <button ref={homeButtonRef} type="button" onClick={requestHome}>
          Return Home
        </button>
      </div>

      <ScoreSheet
        open={openPanel === 'scores'}
        players={state.players}
        roundScores={state.roundScores}
        onClose={() => setOpenPanel(null)}
        returnFocusRef={scoreSheetButtonRef}
      />
      <RulesDialog
        open={openPanel === 'rules'}
        onClose={() => setOpenPanel(null)}
        returnFocusRef={rulesButtonRef}
      />
      <AccessibleDialog
        open={openPanel === 'restart'}
        titleId="restart-match-title"
        onClose={() => setOpenPanel(null)}
        initialFocusRef={cancelButtonRef}
        returnFocusRef={restartButtonRef}
      >
        <h2 id="restart-match-title">Restart match?</h2>
        <p>Your current unfinished match will be lost and replaced with a new match.</p>
        <button
          type="button"
          onClick={() => {
            setOpenPanel(null);
            onRestart();
          }}
        >
          Restart Match
        </button>
        <button ref={cancelButtonRef} type="button" onClick={() => setOpenPanel(null)}>
          Cancel
        </button>
      </AccessibleDialog>
      <AccessibleDialog
        open={openPanel === 'home'}
        titleId="return-home-title"
        onClose={() => setOpenPanel(null)}
        initialFocusRef={cancelButtonRef}
        returnFocusRef={homeButtonRef}
      >
        <h2 id="return-home-title">Return home?</h2>
        <p>Your unfinished match will be abandoned and its saved progress removed.</p>
        <button
          type="button"
          onClick={() => {
            setOpenPanel(null);
            onHome();
          }}
        >
          Return Home and Abandon Match
        </button>
        <button ref={cancelButtonRef} type="button" onClick={() => setOpenPanel(null)}>
          Cancel
        </button>
      </AccessibleDialog>
    </>
  );
}
