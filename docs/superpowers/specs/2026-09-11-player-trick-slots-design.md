# Player Trick Slots Design

## Goal

Make ownership of every card in the current trick immediately understandable by arranging four persistent player slots as a cross: Ember on the left, Rowan on top, Mira on the right, and You on the bottom.

## Design

`TrickArea` will render one fixed slot for every player, using the existing seat-position mapping rather than the order cards were played. Each slot will show the player's name and an empty visual placeholder until that player plays; then the card fills the same location. The slots remain semantic list markup, and each receives an accessible label describing whether it is empty or which card that player played.

The desktop layout places the slots toward their matching seats and counters while keeping the four cards close enough to read as one trick. Smaller viewports preserve the cross with reduced card and gap sizes instead of collapsing ownership back into a sequence. The face-up trump card remains at the dealer-facing outer edge and visually distinct from the four trick slots.

## Boundaries and testing

No rules, state, AI, timing, persistence, or card-play order changes. Component tests will establish all four slots, fixed position classes, and card-to-player assignment. Browser tests and screenshots will protect desktop and narrow responsive geometry, including the absence of overflow and overlap.
