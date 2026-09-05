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
    .sort((left, right) => right.score - left.score || left.seatIndex - right.seatIndex)
    .map((standing, index, ordered) => ({
      ...standing,
      rank: index > 0 && standing.score === ordered[index - 1]?.score ? undefined : index + 1,
    }))
    .reduce<Array<{ player: (typeof state.players)[number]; score: number; rank: number }>>(
      (ranked, standing) => [
        ...ranked,
        {
          player: standing.player,
          score: standing.score,
          rank: standing.rank ?? ranked.at(-1)?.rank ?? 1,
        },
      ],
      [],
    );

  return (
    <section className="match-result" aria-labelledby="match-result-title">
      <span className="match-result__ornament" aria-hidden="true">✦ ◆ ✦</span>
      <h2 id="match-result-title">Match complete</h2>
      <p className="match-result__announcement" role="status" aria-live="polite">
        {winners.length === 1
          ? `${winners[0]} win${winnerIds[0] === 'human' ? '' : 's'} with ${formatNumber(winningScore)} points!`
          : `${joinNames(winners)} share the win with ${formatNumber(winningScore)} points!`}
      </p>
      <ol className="match-result__standings" aria-label="Final standings">
        {standings.map(({ player, score, rank }) => (
          <li
            className={winnerIds.includes(player.id) ? 'match-result__winner' : undefined}
            key={player.id}
            value={rank}
          >
            {player.name} — {formatNumber(score)}
          </li>
        ))}
      </ol>
      <div className="result-actions">
        <button
          className="button button--secondary"
          ref={scoreSheetButtonRef}
          type="button"
          onClick={() => setScoreSheetOpen(true)}
        >
          Score Sheet
        </button>
        <button className="button button--primary" type="button" onClick={onNewMatch}>
          New Match
        </button>
        <button className="button button--secondary" type="button" onClick={onHome}>
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
