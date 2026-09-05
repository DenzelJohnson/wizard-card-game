import type { PlayerMetadata } from '../game/types';

export type SeatPosition = 'bottom' | 'left' | 'top' | 'right';

export interface PlayerSeatProps {
  readonly player: PlayerMetadata;
  readonly position: SeatPosition;
  readonly score: number;
  readonly bid: number | undefined;
  readonly tricksWon: number;
  readonly dealer: boolean;
  readonly active: boolean;
  readonly leader: boolean;
  readonly hiddenCardCount?: number;
}

export function PlayerSeat({
  player,
  position,
  score,
  bid,
  tricksWon,
  dealer,
  active,
  leader,
  hiddenCardCount,
}: PlayerSeatProps) {
  return (
    <section
      className={`player-seat player-seat--${position}`}
      data-seat={position}
      aria-label={`${player.name} seat`}
    >
      <h2>{player.name}</h2>
      <p className="seat-summary">
        <span>Score: {score}</span>{' '}
        <span>Bid: {bid ?? '—'}</span>{' '}
        <span>Tricks: {tricksWon}</span>
      </p>
      {dealer || active || leader ? (
        <p className="seat-markers">
          {dealer ? <span>Dealer</span> : null}
          {active ? <span>Active</span> : null}
          {leader ? <span>Leader</span> : null}
        </p>
      ) : null}
      {hiddenCardCount !== undefined ? (
        <div
          className="hidden-card-stack"
          role="img"
          aria-label={`${player.name} has ${hiddenCardCount} hidden ${
            hiddenCardCount === 1 ? 'card' : 'cards'
          }`}
        >
          <span aria-hidden="true">
            {hiddenCardCount} {hiddenCardCount === 1 ? 'card' : 'cards'}
          </span>
          {Array.from({ length: hiddenCardCount }, (_, index) => (
            <span key={index} className="playing-card playing-card--back" aria-hidden="true">
              Card back
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
