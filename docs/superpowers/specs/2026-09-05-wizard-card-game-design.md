# Wizard Card Game Design

Date: 2026-09-05  
Status: Approved  
Repository: `DenzelJohnson/wizard-card-game`

## 1. Product Definition

Build a polished, fully playable browser version of the Wizard trick-taking card game for exactly
four players: one human and three computer opponents. The first release has two home-screen modes:

- **Easy** is playable. Computer players obey every rule and choose uniformly at random from the
  legal actions available to them.
- **Hard — Beta** is visible, clearly labelled, and disabled. It has no game logic in this release.

The game uses the standard 60-card deck: the 52 suited cards from 2 through Ace, four Wizards, and
four Jesters. A match lasts the full 15 rounds. It runs entirely in the browser, automatically
saves an unfinished match, and is deployed from a public GitHub repository to GitHub Pages.

## 2. Success Criteria

The release is successful when a player can start or resume a match, complete all bidding and play
through 15 rounds without an illegal move or manual bookkeeping, see correct scores after every
round, and reach a clear final result. The interface must remain understandable and usable on
desktop, tablet, and mobile, including with a keyboard and reduced-motion preference.

## 3. Rules

### 3.1 Match and dealing

- Seat order is clockwise: human, computer 1, computer 2, computer 3.
- The initial dealer is selected with the seeded game randomizer; the dealer moves one seat
  clockwise after each round.
- Round 1 deals one card to each player, round 2 deals two, continuing through round 15.
- After dealing, the next card is turned face-up to determine trump.
- A suited up-card makes that suit trump.
- A Jester up-card creates a no-trump round.
- A Wizard up-card makes the dealer choose one of the four suits. There is no no-trump choice.
- In round 15 all 60 cards are dealt, so there is no up-card and no trump.

### 3.2 Bidding

- Bidding begins with the player left of the dealer and proceeds clockwise, with the dealer last.
- Each player may bid any whole number from zero through the number of cards in their hand.
- The optional rule restricting the dealer from making bids total the number of tricks is omitted.
- Easy computers choose uniformly at random from every allowed bid.

### 3.3 Legal play

- The player left of the dealer leads the first trick. Each subsequent trick is led by the winner
  of the previous trick.
- A Wizard or Jester may be played at any time, regardless of cards held.
- Otherwise, a player must follow the led suit when holding at least one card of that suit.
- If the player has no card of the led suit, any card may be played.
- When a Jester opens a trick, it is null: the first later suited card establishes the led suit.
- If a Wizard appears before any suited card establishes the led suit, the remaining players may
  play any card because the Wizard has already fixed the winner and no suit was led.
- Easy computers choose uniformly at random from the legal cards returned by the rules engine.

### 3.4 Trick winner

The winner is determined in this order:

1. The first Wizard played.
2. If no Wizard was played, the highest-ranked trump card.
3. If no trump was played, the highest-ranked card of the led suit.
4. If all four cards are Jesters, the first Jester played.

The winner receives one trick and leads the next trick.

### 3.5 Scoring and match result

- Exact bid: `20 + (10 × bid)` points.
- Missed bid: `-10 × absolute value(tricks won - bid)` points.
- Round points are added to the cumulative score.
- After round 15, every player tied for the highest score is declared a winner.

## 4. Application Architecture

Use React, TypeScript, and Vite. Keep the rules engine pure and independent from React so legal
actions, trick resolution, scoring, and state transitions can be exhaustively tested. The app is
split into five bounded areas:

1. `src/game/`: domain types, deck generation and shuffle, legal actions, state machine, trick
   winner calculation, scoring, and deterministic seeded randomizer contract.
2. `src/ai/`: Easy-mode selection from engine-provided legal actions. It never duplicates or
   bypasses rule logic.
3. `src/storage/`: versioned serialization, validation, migration, save, resume, and clear.
4. `src/app/`: orchestration between the engine, AI turns, persistence, and presentation timing.
5. `src/components/` and `src/styles/`: accessible screens, controls, cards, layout, and theme.

The core reducer accepts a `GameState` and a validated action, then returns a new `GameState`.
UI components emit player intents; the app asks the engine for legal actions before dispatching.
Computer turns use the same public legal-action API as the human controls.

## 5. State and Data Flow

The state model records the schema version, match identifier, difficulty, phase, round, dealer,
active player, deck/deal data, trump state, bids, hands, current trick, completed tricks, scores,
short event history, animation acknowledgement, and seeded randomizer state.

The phase state machine is explicit:

`home -> round setup -> trump selection (when needed) -> bidding -> trick play -> trick result ->
round result -> next round -> match result`

At each phase, the engine exposes only the valid actions. The app advances computer turns after a
short visible delay, pauses to show trick and round results, and waits for a human action whenever
the active decision belongs to the human. Persistence runs after every accepted state transition.

## 6. Screens and Interaction

### 6.1 Home

- Branded fantasy-tavern title treatment.
- Primary **Easy** mode card/button.
- **Hard — Beta** mode card shown locked, disabled, and excluded from action handling.
- **Continue Game** appears above new-game choices only when a valid unfinished save exists.
- Starting a new game while a save exists requires confirmation.
- Rules and accessibility/settings entry points remain available.

### 6.2 Game table

- A candlelit wood table fills the viewport with warm brown, muted gold, burgundy, emerald, and
  midnight-blue accents.
- The human hand is face-up at the bottom. Computers occupy the left, top, and right positions
  with face-down card counts.
- Every seat shows name, bid, tricks won, round score context, and total score.
- Dealer, trick leader, active player, and trump are visually distinct and also have text labels.
- Played cards enter a central trick area in seating order. The winner is highlighted before cards
  clear.
- Legal human cards lift and glow; illegal cards are dimmed, disabled, and remain visible.
- Bids and trump choices use large button groups with keyboard focus states.
- A compact score summary stays on the table; a modal score sheet shows every completed round.
- The menu contains rules, sound toggle, return home, and restart with confirmation.

### 6.3 Round and match results

- The round result compares each bid with tricks won and explains the point calculation.
- The final result celebrates the winner or shared winners and shows complete standings.
- Actions allow a new match, score-sheet review, or return home.

### 6.4 Responsive and accessible behavior

- Desktop uses the full four-seat table. Tablet and mobile preserve spatial seating while reducing
  ornamentation and overlapping/fanning hands to fit.
- All actions are reachable by keyboard. Focus is visible and moves into opened dialogs.
- Status changes are announced through a polite live region without narrating decorative motion.
- Suit information uses symbols and labels rather than color alone.
- Contrast targets WCAG AA. Motion is reduced or removed under `prefers-reduced-motion`.
- Audio is supplementary, starts muted until user interaction permits it, and can be disabled.

## 7. Visual Assets

All card faces and decorative art are original project assets or code-generated shapes. Standard
rank and suit notation remains familiar. Wizards and Jesters receive distinct magical designs and
unmistakable labels. No commercial Wizard card artwork, logo, rulebook text, or third-party image
is copied. The interface may name the game descriptively but includes a small fan-project notice
and does not imply affiliation with the commercial publisher.

## 8. Persistence and Recovery

- Save a versioned JSON record in `localStorage` after each accepted action and important
  presentation acknowledgement.
- Validate the complete record before resuming. Never trust parsed browser data directly.
- Persist the randomizer state so resumed computer decisions remain consistent.
- A compatible older schema is migrated; an unknown, incomplete, or corrupt record is discarded
  and replaced only when a new match begins.
- If storage is blocked or full, the current match remains playable in memory and a non-blocking
  notice explains that resume is unavailable.
- Finishing or explicitly abandoning a match removes the resumable save. A completed score sheet
  remains visible until the player leaves the result screen but is not stored as permanent history.

## 9. Error Handling and Invariants

Illegal or stale UI actions are rejected by the engine without mutating state. The UI then refreshes
its legal actions from the current state. Development builds assert essential invariants: 60 unique
cards, no card in two locations, correct hand counts, valid active player, bids within range, and
total tricks matching completed trick records. A top-level error boundary offers a safe return to
home while preserving a valid save where possible.

## 10. Testing

### Unit tests

- Generate exactly 52 suited cards, four Wizards, and four Jesters with unique identifiers.
- Verify deterministic shuffle behavior and complete dealing for rounds 1 through 15.
- Cover legal-card selection for every combination of led suit, void suit, trump, Wizard, Jester,
  and Jester-led tricks.
- Cover trick winners, including multiple Wizards, all Jesters, and trump/led-suit ties by rank.
- Cover all scoring outcomes, dealer rotation, phase transitions, and match ties.
- Verify Easy AI always selects an element of the engine-provided legal action set.
- Verify persisted-state validation, migration, corruption recovery, and storage failure handling.

### Integration tests

- Exercise human bidding, human trump selection, legal/illegal card presentation, computer turn
  progression, trick collection, round results, resume, restart, and final standings.
- Verify Hard mode cannot be activated by pointer, keyboard, or direct UI events.

### End-to-end tests

- Play a seeded 15-round match to completion through the browser.
- Refresh mid-bid and mid-trick, resume, and complete the match.
- Run critical flows at desktop and mobile viewport sizes.
- Check built asset paths under the GitHub Pages `/wizard-card-game/` base path.

## 11. Delivery

- Initialize the repository on `main` with normal development, test, build, and preview scripts.
- Create the public repository `DenzelJohnson/wizard-card-game` and push the complete history.
- Configure a GitHub Actions workflow that installs locked dependencies, runs automated checks,
  builds the static site, and deploys the artifact to GitHub Pages on pushes to `main`.
- Enable Pages with GitHub Actions as its source and verify the public deployment URL loads.
- Local development-server startup must follow the repository's `$run-local-host` workflow, use a
  verified free loopback port, and confirm that the launched process owns the listener.

## 12. Out of Scope

- Playable Hard mode or strategic computer logic
- Player counts other than four
- Online multiplayer, accounts, cloud saves, leaderboards, chat, or analytics
- Rule variants, optional bid restrictions, custom decks, or match-length settings
- Permanent match history, achievements, monetization, or native mobile applications
