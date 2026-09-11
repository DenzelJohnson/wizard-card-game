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
  readonly externalRoundStats?: boolean;
  readonly showBid?: boolean;
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
  externalRoundStats = false,
  showBid = true,
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
        {externalRoundStats ? null : (
          <>
            {showBid && bid !== undefined ? (
              <><span className="seat-summary__bid">Bid: {bid}</span>{' '}</>
            ) : null}
            <span className="seat-summary__tricks">Tricks: {tricksWon}</span>
          </>
        )}
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
          {Array.from({ length: hiddenCardCount }, (_, index) => (
            <span key={index} className="playing-card playing-card--back" aria-hidden="true">
              <span className="playing-card__back-ornament">
                <span className="playing-card__back-rune">✦</span>
              </span>
            </span>
          ))}
        </div>
      ) : null}
      {externalRoundStats ? (
        <div className="seat-table-stats" aria-label={`${player.name} round stats`}>
          {showBid && bid !== undefined ? (
            <span><small>Bid</small><strong>{bid}</strong></span>
          ) : null}
          <span><small>Tricks</small><strong>{tricksWon}</strong></span>
        </div>
      ) : null}
    </section>
  );
}
