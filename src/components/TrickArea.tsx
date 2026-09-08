import type { Card, PlayedCard, PlayerMetadata, Suit } from '../game/types';
import { cardName, PlayingCard, suitName, suitSymbol } from './PlayingCard';

export interface TrickAreaProps {
  readonly plays: readonly PlayedCard[];
  readonly players: readonly PlayerMetadata[];
  readonly revealedUpCard: Card | null;
  readonly trump: Suit | null;
  readonly dealerChoosingTrump: boolean;
}

export function TrickArea({
  plays,
  players,
  revealedUpCard,
  trump,
  dealerChoosingTrump,
}: TrickAreaProps) {
  const playerNames = new Map(players.map((player) => [player.id, player.name]));

  return (
    <section className="trick-area" aria-labelledby="current-trick-heading">
      <h2 id="current-trick-heading">Current trick</h2>
      <div className="trick-area__surface">
        {revealedUpCard === null ? null : (
          <div
            className="face-up-card"
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
