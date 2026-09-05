import { useRef } from 'react';

import type { GameState, RoundPlayerScore } from '../game/types';
import { formatNumber, formatSigned } from './ScoreSheet';

export interface RoundSummaryProps {
  readonly state: GameState;
  readonly onContinue: () => void;
}

export function RoundSummary({ state, onContinue }: RoundSummaryProps) {
  const continuedRef = useRef(false);
  const record = state.roundScores.at(-1);
  const roundNumber = record?.round ?? state.round;

  return (
    <section className="round-summary" aria-labelledby="round-summary-title">
      <h2 id="round-summary-title">Round {roundNumber} complete</h2>
      {record === undefined ? (
        <p>No round score is available.</p>
      ) : (
        <ul aria-label={`Round ${roundNumber} scores`}>
          {record.players.map((score) => {
            const name = state.players.find(({ id }) => id === score.playerId)?.name ?? score.playerId;
            return (
              <li key={score.playerId} aria-label={name}>
                <h3>{name}</h3>
                <p>
                  Bid {score.bid}; Won {score.tricks} {score.tricks === 1 ? 'trick' : 'tricks'}
                </p>
                <p>{scoreExplanation(score)}</p>
                <p>Total {formatNumber(score.cumulative)}</p>
              </li>
            );
          })}
        </ul>
      )}
      <button
        type="button"
        onClick={() => {
          if (continuedRef.current) {
            return;
          }
          continuedRef.current = true;
          onContinue();
        }}
      >
        Continue
      </button>
    </section>
  );
}

function scoreExplanation(score: RoundPlayerScore): string {
  if (score.bid === score.tricks) {
    return `20 + (10 × ${score.bid}) = ${formatSigned(score.delta)}`;
  }

  return `10 × |${score.tricks} − ${score.bid}| = ${Math.abs(score.delta)} point loss (${formatSigned(score.delta)})`;
}
