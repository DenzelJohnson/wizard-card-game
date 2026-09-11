import type { Card, PlayedCard, PlayerId, PlayerMetadata, Suit } from '../game/types';
import { cardName, PlayingCard, suitName, suitSymbol } from './PlayingCard';
import type { SeatPosition } from './PlayerSeat';

export interface TrickAreaProps {
  readonly plays: readonly PlayedCard[];
  readonly players: readonly PlayerMetadata[];
  readonly revealedUpCard: Card | null;
  readonly trump: Suit | null;
  readonly dealerChoosingTrump: boolean;
  readonly dealerPosition: SeatPosition;
}

const TRICK_SLOT_POSITIONS: Readonly<Record<PlayerId, SeatPosition>> = {
  human: 'bottom',
  ember: 'left',
  rowan: 'top',
  mira: 'right',
};

export function TrickArea({
  plays,
  players,
  revealedUpCard,
  trump,
  dealerChoosingTrump,
  dealerPosition,
}: TrickAreaProps) {
  const playsByPlayer = new Map(plays.map((play) => [play.playerId, play]));

  return (
    <section className="trick-area" aria-labelledby="current-trick-heading">
      <h2 id="current-trick-heading">Current trick</h2>
      <div className={`trick-area__surface trick-area__surface--dealer-${dealerPosition}`}>
        {revealedUpCard === null ? null : (
          <div
            className={`face-up-card face-up-card--${dealerPosition}`}
            aria-label={faceUpCardLabel(revealedUpCard, trump, dealerChoosingTrump)}
          >
            <PlayingCard card={revealedUpCard} playable={false} />
            {revealedUpCard.kind === 'wizard' && trump !== null && !dealerChoosingTrump ? (
              <span className="face-up-card__trump-suit" aria-hidden="true">
                {suitSymbol(trump)}
              </span>
            ) : null}
          </div>
        )}
        <div className="trick-area__current">
          <ul className="trick-area__plays" aria-label="Player card slots">
            {players.map((player) => {
              const play = playsByPlayer.get(player.id);
              const position = TRICK_SLOT_POSITIONS[player.id];

              return (
                <li
                  key={player.id}
                  className={`trick-play trick-play--${player.id} trick-play--${position}`}
                  data-trick-player={player.id}
                  aria-label={
                    play === undefined
                      ? `${player.name} has not played`
                      : `${player.name} played ${cardName(play.card)}`
                  }
                >
                  <span className="trick-play__name" aria-hidden="true">{player.name}</span>
                  {play === undefined ? (
                    <span className="trick-play__empty" aria-hidden="true" />
                  ) : (
                    <PlayingCard card={play.card} playable={false} />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

function faceUpCardLabel(card: Card, trump: Suit | null, dealerChoosingTrump: boolean): string {
  const prefix = `Face-up card: ${cardName(card)}.`;

  if (card.kind === 'jester') {
    return `${prefix} No trump this round.`;
  }
  if (card.kind === 'suited') {
    return `${prefix} ${suitName(card.suit)} are trump.`;
  }
  if (dealerChoosingTrump || trump === null) {
    return `${prefix} Dealer is choosing trump.`;
  }

  return `${prefix} ${suitName(trump)} are trump.`;
}
