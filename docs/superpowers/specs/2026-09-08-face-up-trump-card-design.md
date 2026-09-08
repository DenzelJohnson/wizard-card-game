# Face-Up Trump Card Table Design

## Goal

Replace the gameplay screen's top-left round/prompt/trump panel with the actual revealed card on
the central green felt. The normal top-left grid cell remains visually empty.

## Presentation

- `GameTable` keeps its visually hidden level-one heading but removes the visible round counter,
  phase prompt, and text-based trump block during active gameplay.
- `TrickArea` receives the round's `revealedUpCard` and resolved `trump` values and renders the
  existing non-interactive `PlayingCard` face on the green table, separate from cards in the
  current trick.
- A suited up card communicates trump through its face. A Jester communicates no trump through
  its face. Round 15 has no up card and therefore renders no reveal card.
- When a Wizard is revealed, the card remains the real Wizard face. After the dealer chooses
  trump, a small overlapping suit medallion shows only the suit symbol; no visible “Trump: suit”
  label or explanatory sentence returns. While the dealer is still choosing, no medallion is
  shown.
- The reveal remains legible without crowding four trick cards at desktop, 390 px, or 320 px.

## Accessibility and State

The visual simplification does not alter game state, rules, persistence, or legal actions. The
reveal wrapper has an accessible name describing the face-up card and its trump meaning, including
Wizard-selected trump and no-up-card behavior where relevant. The existing bid and trump-choice
controls continue to provide the human's actionable instruction. Active/dealer/leader markers
continue to communicate turn state without the removed top-left prompt.

A storage failure remains visible inside the gameplay `<main>`; only that exceptional warning may
occupy the top-left status area.

## Verification

Component tests prove that the visible round/prompt/trump prose is absent, the exact revealed card
face is present, Wizard-selected trump gets a symbol medallion, Jester and round-15 states are
correct, and no opponent cards leak. Accessibility tests verify the reveal's accessible name and
the retained single-main/single-heading structure. Existing Playwright full-match and responsive
checks provide regression coverage, with a fresh screenshot inspected after implementation.
