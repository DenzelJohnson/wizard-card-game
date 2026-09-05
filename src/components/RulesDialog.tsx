import { useRef, type RefObject } from 'react';

import { AccessibleDialog } from './AccessibleDialog';

export interface RulesDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly returnFocusRef?: RefObject<HTMLElement | null>;
}

const TITLE_ID = 'wizard-rules-title';

export function RulesDialog({ open, onClose, returnFocusRef }: RulesDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <AccessibleDialog
      open={open}
      titleId={TITLE_ID}
      onClose={onClose}
      initialFocusRef={closeButtonRef}
      returnFocusRef={returnFocusRef}
      className="rules-dialog"
    >
      <div className="dialog-heading dialog-heading--sticky">
        <span className="dialog-heading__rune" aria-hidden="true">✦</span>
        <h2 id={TITLE_ID}>How to play Wizard</h2>
        <button
          className="dialog-close"
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="Close rules"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <div className="rules-dialog__content">
        <section>
          <h3>Objective</h3>
          <p>Predict how many tricks you will win, then finish 15 rounds with the highest score.</p>
        </section>
        <section>
          <h3>Deck and rounds</h3>
          <p>
            The 60-card deck has 52 suited cards, four Wizards, and four Jesters. Round one gives
            everyone one card; each later round adds one, ending with 15 cards in round 15. The
            dealer moves clockwise after each round.
          </p>
        </section>
        <section>
          <h3>Trump</h3>
          <p>
            A suited up-card names trump. If the up-card is a Wizard, the dealer chooses a suit. A
            Jester means no trump. In the final round every card is dealt, so there is no up-card
            and no trump.
          </p>
        </section>
        <section>
          <h3>Bidding</h3>
          <p>
            The player left of the dealer bids first, play continues clockwise, and the dealer bids
            last. Bids are unrestricted: choose any whole number from zero through the number of
            cards in your hand.
          </p>
        </section>
        <section>
          <h3>Playing cards</h3>
          <p>
            The player left of the dealer leads the first trick; each winner leads next. Follow the
            led suit when you can. Wizards and Jesters may be played at any time, even when you hold
            the led suit. When a Jester leads, the first later suited card establishes the led suit.
            If a Wizard appears before a suited card, there is no led suit for that trick.
          </p>
        </section>
        <section>
          <h3>Winning a trick</h3>
          <p>
            The first Wizard wins. With no Wizard, the highest trump wins; without trump, the
            highest card of the led suit wins. If all four cards are Jesters, the first Jester wins.
          </p>
        </section>
        <section>
          <h3>Scoring</h3>
          <p>
            Make your bid for 20 + (10 × bid) points. Miss it and lose 10 × |tricks won − bid|
            points.
          </p>
        </section>
      </div>
    </AccessibleDialog>
  );
}
