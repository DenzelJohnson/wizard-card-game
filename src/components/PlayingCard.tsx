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
        Card back
      </span>
    );
  }

  const name = cardName(card);
  const content = <CardFace card={card} />;

  if (onPlay !== undefined) {
    return (
      <button
        type="button"
        className={`playing-card${playable ? ' playing-card--playable' : ' playing-card--disabled'}`}
        data-card-id={card.id}
        data-kind={card.kind}
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
      className="playing-card playing-card--played"
      data-card-id={card.id}
      data-kind={card.kind}
      role="img"
      aria-label={name}
    >
      {content}
    </span>
  );
}

function CardFace({ card }: { readonly card: Card }) {
  if (card.kind === 'wizard') {
    return <>Wizard</>;
  }
  if (card.kind === 'jester') {
    return <>Jester</>;
  }

  return (
    <>
      <span aria-hidden="true">{RANK_SYMBOLS[card.rank]}</span>{' '}
      <span aria-hidden="true">{suitSymbol(card.suit)}</span>{' '}
      <span>{suitName(card.suit)}</span>
    </>
  );
}
