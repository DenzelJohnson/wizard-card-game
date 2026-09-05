import type { PlayedCard, PlayerMetadata } from '../game/types';
import { PlayingCard } from './PlayingCard';

export interface TrickAreaProps {
  readonly plays: readonly PlayedCard[];
  readonly players: readonly PlayerMetadata[];
}

export function TrickArea({ plays, players }: TrickAreaProps) {
  const playerNames = new Map(players.map((player) => [player.id, player.name]));

  return (
    <section className="trick-area" aria-labelledby="current-trick-heading">
      <h2 id="current-trick-heading">Current trick</h2>
      {plays.length === 0 ? (
        <p>No cards played yet.</p>
      ) : (
        <ol className="trick-area__plays">
          {plays.map((play, index) => (
            <li
              key={`${index}-${play.playerId}-${play.card.id}`}
              className={`trick-play trick-play--${play.playerId}`}
            >
              <span className="trick-play__name">
                {playerNames.get(play.playerId) ?? play.playerId}
              </span>
              <PlayingCard card={play.card} playable={false} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
