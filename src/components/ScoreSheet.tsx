import { useRef, type RefObject } from 'react';

import type { PlayerMetadata, RoundScoreRecord, Suit } from '../game/types';
import { suitName, suitSymbol } from './PlayingCard';
import { AccessibleDialog } from './AccessibleDialog';

export interface ScoreSheetProps {
  readonly open: boolean;
  readonly players: readonly PlayerMetadata[];
  readonly roundScores: readonly RoundScoreRecord[];
  readonly onClose: () => void;
  readonly returnFocusRef?: RefObject<HTMLElement | null>;
}

const TITLE_ID = 'score-sheet-title';

export function ScoreSheet({
  open,
  players,
  roundScores,
  onClose,
  returnFocusRef,
}: ScoreSheetProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <AccessibleDialog
      open={open}
      titleId={TITLE_ID}
      onClose={onClose}
      initialFocusRef={closeButtonRef}
      returnFocusRef={returnFocusRef}
      className="score-sheet-dialog"
    >
      <h2 id={TITLE_ID}>Score sheet</h2>
      <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Close score sheet">
        Close
      </button>

      {roundScores.length === 0 ? (
        <p>No rounds scored yet.</p>
      ) : (
        <div className="table-scroll" tabIndex={0} aria-label="Scrollable score sheet">
          <table>
            <caption>Complete score sheet</caption>
            <thead>
              <tr>
                <th scope="col">Round</th>
                <th scope="col">Trump</th>
                <th scope="col">Player</th>
                <th scope="col">Bid</th>
                <th scope="col">Tricks</th>
                <th scope="col">Delta</th>
                <th scope="col">Total</th>
              </tr>
            </thead>
            {roundScores.map((roundScore) => (
              <tbody key={roundScore.round}>
                {players.map((player, playerIndex) => {
                  const score = roundScore.players.find(({ playerId }) => playerId === player.id);
                  if (score === undefined) {
                    return null;
                  }

                  return (
                    <tr key={`${roundScore.round}-${player.id}`}>
                      {playerIndex === 0 ? (
                        <th scope="rowgroup" rowSpan={players.length}>
                          {roundScore.round}
                        </th>
                      ) : null}
                      {playerIndex === 0 ? (
                        <td rowSpan={players.length}>{trumpLabel(roundScore.trump)}</td>
                      ) : null}
                      <th scope="row">{player.name}</th>
                      <td>{score.bid}</td>
                      <td>{score.tricks}</td>
                      <td>{formatSigned(score.delta)}</td>
                      <td>{formatNumber(score.cumulative)}</td>
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </AccessibleDialog>
  );
}

export function formatSigned(value: number): string {
  return value >= 0 ? `+${value}` : `−${Math.abs(value)}`;
}

export function formatNumber(value: number): string {
  return value < 0 ? `−${Math.abs(value)}` : String(value);
}

function trumpLabel(trump: Suit | null): string {
  return trump === null ? 'No trump' : `${suitSymbol(trump)} ${suitName(trump)}`;
}
