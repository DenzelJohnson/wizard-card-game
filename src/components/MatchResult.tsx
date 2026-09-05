import { useRef, useState } from 'react';

import { matchWinners } from '../game/state';
import type { GameState } from '../game/types';
import { formatNumber } from './ScoreSheet';
import { ScoreSheet } from './ScoreSheet';

export interface MatchResultProps {
  readonly state: GameState;
  readonly onNewMatch: () => void;
  readonly onHome: () => void;
}

export function MatchResult({ state, onNewMatch, onHome }: MatchResultProps) {
  const [scoreSheetOpen, setScoreSheetOpen] = useState(false);
  const scoreSheetButtonRef = useRef<HTMLButtonElement>(null);
  const winnerIds = matchWinners(state);
  const winners = winnerIds.map(
    (winnerId) => state.players.find(({ id }) => id === winnerId)?.name ?? winnerId,
  );
  const winningScore = winnerIds[0] === undefined ? 0 : state.scores[winnerIds[0]];
  const standings = state.players
    .map((player, seatIndex) => ({ player, seatIndex, score: state.scores[player.id] }))
    .sort((left, right) => right.score - left.score || left.seatIndex - right.seatIndex);

  return (
    <section className="match-result" aria-labelledby="match-result-title">
      <h2 id="match-result-title">Match complete</h2>
      <p role="status" aria-live="polite">
        {winners.length === 1
          ? `${winners[0]} win${winnerIds[0] === 'human' ? '' : 's'} with ${formatNumber(winningScore)} points!`
          : `${joinNames(winners)} share the win with ${formatNumber(winningScore)} points!`}
      </p>
      <ol aria-label="Final standings">
        {standings.map(({ player, score }, index) => (
          <li key={player.id}>
            {index + 1}. {player.name} — {formatNumber(score)}
          </li>
        ))}
      </ol>
      <div className="result-actions">
        <button ref={scoreSheetButtonRef} type="button" onClick={() => setScoreSheetOpen(true)}>
          Score Sheet
        </button>
        <button type="button" onClick={onNewMatch}>
          New Match
        </button>
        <button type="button" onClick={onHome}>
          Return Home
        </button>
      </div>
      <ScoreSheet
        open={scoreSheetOpen}
        players={state.players}
        roundScores={state.roundScores}
        onClose={() => setScoreSheetOpen(false)}
        returnFocusRef={scoreSheetButtonRef}
      />
    </section>
  );
}

function joinNames(names: readonly string[]): string {
  if (names.length < 2) {
    return names[0] ?? 'No one';
  }
  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`;
  }
  return `${names.slice(0, -1).join(', ')}, and ${names.at(-1)}`;
}
