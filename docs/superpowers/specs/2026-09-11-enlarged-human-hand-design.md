# Enlarged Human Hand Design

## Goal

Make the player’s hand substantially easier to read by displaying its cards at approximately twice their current dimensions and removing the faded treatment from cards that cannot currently be played.

## Design

- Apply a hand-specific card-width variable so only cards inside `.human-hand` become larger. Target about twice the existing shared-card width across desktop and mobile breakpoints.
- Let the hand panel grow vertically around the larger 5:7 cards and retain horizontal scrolling for later rounds with many cards.
- Increase overlap proportionally enough to keep the row coherent without hiding ranks or suit corners.
- Override grayscale, saturation, and opacity only for disabled cards inside the human hand.
- Preserve native `disabled` attributes, `disabledReason` accessible descriptions, legal-card test hooks, and click behavior. A full-color card remains non-interactive whenever the engine does not provide its legal action.
- Leave trick cards, the face-up trump card, and opponent card backs at their current sizes.

## Testing

Add browser coverage that reaches the human bidding phase, measures a hand card against the shared card size target, and confirms a disabled hand card computes to opacity `1` and filter `none`. Retain the existing 390px and 320px containment/scroll checks, then visually inspect desktop and mobile screenshots.
