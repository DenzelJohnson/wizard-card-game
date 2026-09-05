# Wizard Card Game

A complete, browser-based Wizard card game for one human and three computer opponents, presented
as a candlelit fantasy tavern. Play all 15 rounds in **Easy** mode, where every computer obeys the
rules and chooses uniformly at random from its legal actions. **Hard — Beta** is visible on the
home screen but intentionally unavailable in this release.

[Play Wizard](https://denzeljohnson.github.io/wizard-card-game/) ·
[View the public repository](https://github.com/DenzelJohnson/wizard-card-game)

## Requirements

- [Node.js 24](https://nodejs.org/) and npm
- A current desktop or mobile browser
- Chromium installed through Playwright to run the end-to-end tests

## Install and run locally

Install the locked dependency tree:

```sh
npm ci
```

For ordinary local development, choose a free loopback port and start Vite with strict port
binding. For example:

```sh
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Open the exact URL Vite reports. If port `5173` is already occupied, select another free port;
do not stop or reuse an unrelated listener.

When Codex starts, restarts, serves, or previews this project, it must invoke `$run-local-host`
first. That workflow inspects the repository instructions, verifies a free loopback port, launches
Vite on that exact port with strict binding, and confirms that the launched process owns the
listener. Codex must not launch the server directly.

## Checks and builds

```sh
# Unit and component tests
npm test

# Watch unit and component tests
npm run test:watch

# Type-check and create the production build in dist/
npm run build

# Run unit/component tests, then the production build
npm run check

# Install Chromium once, then run desktop and mobile browser tests
npx playwright install chromium
npm run test:e2e
```

Playwright starts its own strict loopback Vite server when `PLAYWRIGHT_BASE_URL` is unset. To test
an already-running local server instead, provide its exact URL:

```sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 npm run test:e2e
```

The production build uses `/wizard-card-game/` as its asset base so it works at the GitHub Pages
project URL. Development builds use `/`.

## How to play

### Match and trump

- The game always has four seats: you, Ember, Rowan, and Mira.
- The initial dealer is chosen by the seeded game randomizer. The dealer moves one seat clockwise
  after every round.
- Round 1 deals one card to each player, round 2 deals two, and so on through round 15.
- A suited face-up card sets its suit as trump. A face-up Jester creates a no-trump round. When a
  Wizard is face-up, the dealer chooses one of the four suits.
- Round 15 deals all 60 cards, so it has no face-up card and no trump.

### Bidding

- Bidding begins with the player left of the dealer and continues clockwise, with the dealer last.
- Each player may bid any whole number from zero through the number of cards in that round.
- The optional rule that prevents the dealer from making the total bids equal the number of tricks
  is not used.

### Playing cards

- The player left of the dealer leads the first trick. The winner of each trick leads the next.
- Wizards and Jesters may always be played.
- Otherwise, a player must follow the led suit when holding a suited card of that suit. A player
  who cannot follow suit may play any card.
- A leading Jester does not establish a suit; the first later suited card does. If a Wizard is
  played before a suit is established, it fixes the winner and the remaining players are
  unrestricted.
- Easy opponents select uniformly at random from the legal bids, trump suits, or cards supplied by
  the same rules engine used for the human player.

### Winning tricks and scoring

The first Wizard wins the trick. With no Wizard, the highest trump wins; with no trump played, the
highest card of the led suit wins. If all four cards are Jesters, the first Jester wins.

An exact bid scores `20 + (10 × bid)` points. A missed bid scores `-10 × |tricks won - bid|`.
Scores accumulate through all 15 rounds. Every player tied for the highest final score is declared
a winner.

## Save, resume, and settings

An unfinished match is saved automatically in browser `localStorage` after accepted game-state
changes. Returning in the same browser exposes **Continue Game** when the saved match is valid.
Completed, abandoned, or invalid saves are cleared safely. Saves are local to the current browser
and device; there are no accounts or cloud synchronization.

Sound is opt-in, synthesized in the browser, and stored separately from the match. The game remains
fully playable when browser storage or Web Audio is unavailable.

## Accessibility

The interface uses semantic landmarks, headings, buttons, dialogs, and a captioned score table.
All game actions are keyboard accessible, focus is visibly indicated and managed when dialogs or
result screens open, and disabled/illegal actions are conveyed programmatically as well as
visually. Text labels supplement color and card symbols. The layout supports desktop and narrow
mobile screens, and animation is minimized when the operating system requests reduced motion.

## Project structure

| Path | Purpose |
| --- | --- |
| `src/game/` | Pure deck, rules, scoring, state-machine, and validation logic |
| `src/ai/` | Uniform-random Easy opponent using engine-provided legal actions |
| `src/storage/` | Versioned, validated browser save handling |
| `src/app/` | React orchestration, persistence, and computer-turn scheduling |
| `src/components/` | Accessible home, table, controls, dialogs, and result views |
| `src/audio/` | Optional synthesized sound cues and preference handling |
| `src/styles/` | Responsive fantasy-tavern presentation |
| `e2e/` | Seeded Playwright full-match, resume, accessibility, and viewport checks |
| `.github/workflows/deploy.yml` | Tested GitHub Pages build and deployment |

## Deployment

Pushes to `main` and manual workflow dispatches run the GitHub Pages workflow. It installs the
locked dependencies with Node 24, runs the unit/component checks and production build, installs
Playwright Chromium, runs the end-to-end suite, uploads `dist/`, and deploys it to the
`github-pages` environment. The repository's Pages source must be configured as **GitHub Actions**.

Production site: <https://denzeljohnson.github.io/wizard-card-game/>

Repository: <https://github.com/DenzelJohnson/wizard-card-game>

## Fan-project notice

This is an independent, non-commercial fan project. Wizard and its associated names and game are
associated with their respective rights holders. This repository contains original code and
project-owned visual styling; it does not include copied commercial artwork.
