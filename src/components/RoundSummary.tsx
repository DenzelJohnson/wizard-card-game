import { useEffect, useRef } from 'react';

import type { GameState } from '../game/types';
import { formatNumber, formatSigned } from './ScoreSheet';

export interface RoundSummaryProps {
  readonly state: GameState;
  readonly onContinue: () => void;
}

export function RoundSummary({ state, onContinue }: RoundSummaryProps) {
  const continuedRef = useRef(false);
  const continueButtonRef = useRef<HTMLButtonElement>(null);
  const record = state.roundScores.at(-1);
  const roundNumber = record?.round ?? state.round;
  const rankedPlayers = record === undefined
    ? []
    : [...record.players].sort((left, right) => right.cumulative - left.cumulative);

  useEffect(() => {
    continueButtonRef.current?.focus();
  }, []);

  return (
    <section className="round-summary" aria-labelledby="round-summary-title">
      <h1 id="round-summary-title">Round {roundNumber} complete</h1>
      {record === undefined ? (
        <p>No round score is available.</p>
      ) : (
        <ul className="round-summary__scores" aria-label={`Round ${roundNumber} scores`}>
          {rankedPlayers.map((score) => {
            const name = state.players.find(({ id }) => id === score.playerId)?.name ?? score.playerId;
            return (
              <li
                key={score.playerId}
                className={`round-summary__player ${
                  score.delta >= 0 ? 'score--positive' : 'score--negative'
                }`}
                aria-label={name}
              >
                <div className="round-summary__player-score">
                  <h2>{name}</h2>
                  <p className="round-summary__change">({formatSigned(score.delta)})</p>
                </div>
                <p className="round-summary__total">Total {formatNumber(score.cumulative)}</p>
              </li>
            );
          })}
        </ul>
      )}
      <button
        ref={continueButtonRef}
        className="button button--primary round-summary__continue"
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
