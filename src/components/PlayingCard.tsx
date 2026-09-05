import type { Card, Rank, Suit } from '../game/types';

const SUIT_DETAILS: Record<Suit, { readonly name: string; readonly symbol: string }> = {
  clubs: { name: 'Clubs', symbol: '♣' },
  diamonds: { name: 'Diamonds', symbol: '♦' },
  hearts: { name: 'Hearts', symbol: '♥' },
  spades: { name: 'Spades', symbol: '♠' },
};

const RANK_NAMES: Record<Rank, string> = {
  2: 'Two',
  3: 'Three',
  4: 'Four',
  5: 'Five',
  6: 'Six',
  7: 'Seven',
  8: 'Eight',
  9: 'Nine',
  10: 'Ten',
  11: 'Jack',
  12: 'Queen',
  13: 'King',
  14: 'Ace',
};

const RANK_SYMBOLS: Record<Rank, string> = {
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
};

export interface PlayingCardProps {
  readonly card: Card;
  readonly playable: boolean;
  readonly onPlay?: () => void;
  readonly faceDown?: boolean;
  readonly disabledReason?: string;
}

export function cardName(card: Card): string {
  if (card.kind === 'wizard') {
    return 'Wizard';
  }
  if (card.kind === 'jester') {
    return 'Jester';
  }

  return `${RANK_NAMES[card.rank]} of ${suitName(card.suit)}`;
}

export function suitName(suit: Suit): string {
  return SUIT_DETAILS[suit].name;
}

export function suitSymbol(suit: Suit): string {
  return SUIT_DETAILS[suit].symbol;
}

export function PlayingCard({
  card,
  playable,
  onPlay,
  faceDown = false,
  disabledReason = 'not playable',
}: PlayingCardProps) {
  if (faceDown) {
    return (
      <span className="playing-card playing-card--back" role="img" aria-label="Face-down card">
        <span className="playing-card__back-ornament" aria-hidden="true">
          <span className="playing-card__back-rune">✦</span>
        </span>
      </span>
    );
  }

  const name = cardName(card);
  const content = <CardFace card={card} />;
  const suit = card.kind === 'suited' ? card.suit : undefined;
  const cardClassName = `playing-card playing-card--${card.kind}`;

  if (onPlay !== undefined) {
    return (
      <button
        type="button"
        className={`${cardClassName}${
          playable ? ' playing-card--playable' : ' playing-card--disabled'
        }`}
        data-card-id={card.id}
        data-kind={card.kind}
        data-suit={suit}
        disabled={!playable}
        aria-label={playable ? `Play ${name}` : `${name} — ${disabledReason}`}
        onClick={playable ? onPlay : undefined}
      >
        {content}
      </button>
    );
  }

  return (
    <span
      className={`${cardClassName} playing-card--played`}
      data-card-id={card.id}
      data-kind={card.kind}
      data-suit={suit}
      role="img"
      aria-label={name}
    >
      {content}
    </span>
  );
}

function CardFace({ card }: { readonly card: Card }) {
  if (card.kind === 'wizard') {
    return (
      <span className="playing-card__face playing-card__face--wizard" aria-hidden="true">
        <CardCorner rank="W" suit="✦" position="top" />
        <span className="playing-card__rune">
          <span>✦</span>
          <span>◇</span>
          <span>✦</span>
        </span>
        <span className="playing-card__special-label">Wizard</span>
        <CardCorner rank="W" suit="✦" position="bottom" />
      </span>
    );
  }
  if (card.kind === 'jester') {
    return (
      <span className="playing-card__face playing-card__face--jester" aria-hidden="true">
        <CardCorner rank="J" suit="◆" position="top" />
        <span className="playing-card__bells">
          <span>◆</span>
          <span>◇</span>
          <span>◆</span>
        </span>
        <span className="playing-card__special-label">Jester</span>
        <CardCorner rank="J" suit="◆" position="bottom" />
      </span>
    );
  }

  const symbol = suitSymbol(card.suit);
  return (
    <span className="playing-card__face playing-card__face--suited" aria-hidden="true">
      <CardCorner rank={RANK_SYMBOLS[card.rank]} suit={symbol} position="top" />
      <span className="playing-card__pip">{symbol}</span>
      <span className="playing-card__suit-name">
        <span>{symbol}</span> {suitName(card.suit)}
      </span>
      <CardCorner rank={RANK_SYMBOLS[card.rank]} suit={symbol} position="bottom" />
    </span>
  );
}

function CardCorner({
  rank,
  suit,
  position,
}: {
  readonly rank: string;
  readonly suit: string;
  readonly position: 'top' | 'bottom';
}) {
  return (
    <span className={`playing-card__corner playing-card__corner--${position}`}>
      <span className="playing-card__rank">{rank}</span>
      <span className="playing-card__suit">{suit}</span>
    </span>
  );
}
