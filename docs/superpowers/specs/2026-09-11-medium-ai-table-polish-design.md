# Medium AI and Table Polish Design

## Goal

Add an enabled Medium game mode powered only by explicit rules, and improve table readability and pacing without changing Wizard's legal-move engine.

## Game modes and persistence

`GameState.difficulty` becomes `easy | medium` inside the existing schema version. Existing Easy saves remain valid. The home screen offers Easy, Medium, and the still-disabled Hard Beta option. Starting a new match records the selected difficulty; Continue resumes it; Restart preserves it.

Easy continues choosing uniformly from legal actions and consuming deterministic RNG. Medium never learns or calls a service. It selects only from engine-provided legal actions using deterministic heuristics:

- Trump: score suits by length and card strength, favoring suits with high ranks.
- Bid: estimate likely tricks from Wizards, trump strength, off-suit aces/high cards, and suit length, clamped to the engine's legal bids.
- Play: compare exact legal candidates against the current trick. When below the bid target, win as economically as possible; when at/above target, avoid wins and shed dangerous cards. On leads, pursue with strong controlled cards or shed the weakest card according to the bid target.

Stable tie-breakers make Medium reproducible and ensure it does not consume RNG.

## Timing

Computer trump and bid decisions keep the existing short decision pause. Every computer card play uses a distinct 700 ms delay, creating a visible beat between consecutive players. Reduced-motion users continue receiving zero-delay progression.

## Table presentation

The reveal card stays within the central green trick surface but receives a dealer-position modifier. It sits on the edge nearest the dealer: top, right, bottom, or left. The dealer badge is substantially enlarged to approximately three times its former visual area.

Opponent panels retain name and total score. Their hidden-card fan remains, but its numeric count badge is removed. Bid and Tricks become a larger two-value counter positioned on the felt just outside each opponent panel, toward the center of the table. The human seat retains its current summary.

The human hand is display-sorted without changing engine ownership order: Spades high-to-low, Hearts high-to-low, Clubs high-to-low, Diamonds high-to-low, Wizards, then Jesters. Special-card ties use card ID for stability.

## Accessibility and responsive behavior

Opponent hidden-card stacks retain an accessible count even though the visual count badge is removed. External bid/trick counters remain inside each seat's accessible region. The face-up card retains its existing accessible trump description. Desktop and 390/320 px layouts must remain horizontally contained.

## Verification

Unit tests cover Medium trump, bid, and play decisions; difficulty save/load and controller routing; restart mode retention; hand sorting; dealer-relative reveal placement; dealer badge sizing hooks; and opponent counter structure. Existing full-match, resume, reduced-motion, accessibility, build, and responsive Playwright tests remain green, with a Medium full-match browser path added.
