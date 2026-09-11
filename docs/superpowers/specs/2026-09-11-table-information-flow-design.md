# Table Information Flow Design

## Goal

Simplify end-of-round scoring and make bidding/reveal information appear in the right place at the right time.

## Behavior

- Each round-summary player tile shows only the player name, signed score change, and cumulative total. Bid, tricks won, and formula prose are removed from this summary; the score sheet remains unchanged.
- During `choose-trump` and `bidding`, the face-up card remains in front of the dealer. During `playing` and `trick-result`, the same card moves to a dedicated upper-left position on the table, separate from the four trick slots.
- The human seat uses the same external Bid/Tricks presentation as the three opponents, leaving only name, total score, and markers inside the seat panel.
- Until a human bid record exists, no player's bid label or bid value is rendered. After the human submits a bid, every completed bid becomes visible; players who have not bid yet remain without a bid value. Trick counters remain visible throughout.

## Architecture and verification

No engine, bidding-order, scoring, persistence, or AI changes are required. `GameTable` derives `bidsVisible` from the existing human bid record and derives reveal placement from the existing phase. `PlayerSeat` receives explicit bid-visibility and external-stat presentation inputs. `TrickArea` applies the requested reveal placement while keeping its accessible card/trump description. Component tests cover every transition, and Playwright checks desktop/mobile layout and information visibility.
