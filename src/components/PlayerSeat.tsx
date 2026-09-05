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
  readonly winner: boolean;
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
  winner,
  hiddenCardCount,
}: PlayerSeatProps) {
  const stateClasses = [
    active ? 'player-seat--active' : '',
    dealer ? 'player-seat--dealer' : '',
    leader ? 'player-seat--leader' : '',
    winner ? 'player-seat--winner' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section
      className={`player-seat player-seat--${position}${stateClasses ? ` ${stateClasses}` : ''}`}
      data-seat={position}
      aria-label={`${player.name} seat`}
    >
      <h2 className="player-seat__name">{player.name}</h2>
      <p className="seat-summary">
        <span className="seat-summary__score">Score: {score}</span>{' '}
        <span className="seat-summary__bid">Bid: {bid ?? '—'}</span>{' '}
        <span className="seat-summary__tricks">Tricks: {tricksWon}</span>
      </p>
      {dealer || active || leader || winner ? (
        <p className="seat-markers">
          {dealer ? <span className="seat-marker seat-marker--dealer">Dealer</span> : null}
          {active ? <span className="seat-marker seat-marker--active">Active</span> : null}
          {leader ? <span className="seat-marker seat-marker--leader">Leader</span> : null}
          {winner ? <span className="seat-marker seat-marker--winner">Winner</span> : null}
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
          <span className="hidden-card-count" aria-hidden="true">
            {hiddenCardCount} {hiddenCardCount === 1 ? 'card' : 'cards'}
          </span>
          {Array.from({ length: hiddenCardCount }, (_, index) => (
            <span key={index} className="playing-card playing-card--back" aria-hidden="true">
              <span className="playing-card__back-ornament">
                <span className="playing-card__back-rune">✦</span>
              </span>
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
