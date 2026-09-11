# Project Scope - Wizard Card Game

> Single source of truth for this project's moving parts and how they depend on each other.
> Maintained with the `scope-and-impact-analysis` workflow. Update this file in the same change
> that alters any part below.

_Last updated: 2026-09-11 by Codex_

## 1. Overview

Wizard Card Game is a browser-based, four-player implementation of the standard 60-card Wizard
trick-taking game. One human plays against three computer opponents. The first release provides
Easy mode, where computers choose uniformly at random from legal actions, and Medium mode, where
computers use deterministic card-strength, bidding, trump, trick-position, and bid-target heuristics;
Hard mode appears as a disabled beta option. The application is fully client-side, saves an in-progress match in the
browser, and is published as a static site from a public GitHub repository using GitHub Pages.

## 2. Tech Stack

- Language / runtime: TypeScript on Node.js for development; modern browser at runtime
- Frameworks: React and Vite
- Styling: CSS with project-owned card illustrations and theme assets
- Testing: Vitest, Testing Library, and Playwright
- Hosting / deploy target: GitHub Pages
- Persistence: versioned browser `localStorage`; no server or user account

## 3. Code Modules

| Module / path | Responsibility | Reads | Writes |
|---------------|----------------|-------|--------|
| `src/game/` | Pure rules engine, stable card domain types, deck generation, deterministic RNG, game transitions, legal actions, trick resolution, scoring, and semantic `GameState` validation | Game actions and deterministic RNG interface | `Card`/`RngState` values, versioned `GameState` values, and game-validity results |
| `src/ai/` | Easy random and Medium rule-based computer decisions | Legal actions, hands, bids, trump, and public trick history from `src/game/` | Selected legal action; only Easy consumes RNG |
| `src/storage/` | Structurally parse, load, save, and clear resumable matches through tagged, non-throwing results | Versioned `GameState`, game-owned semantic validation, and injected `StorageLike` browser storage | `wizard-card-game/save-v1` JSON record |
| `src/components/` | Accessible home and table interfaces, with focused seat, card, bidding, face-up-card/trick table, score-sheet, rules, game-menu, round-summary, and match-result renderers | `GameState` display data, including the revealed card and resolved trump suit, engine-owned result helpers, controller-provided legal actions, and sound controls | Typed `GameAction` user intents plus controller navigation/result callbacks |
| `src/audio/` | Non-throwing, opt-in synthesized interface cues and the React sound controller | Independent `wizard-card-game/sound-enabled` browser preference and card/trick/round presentation transitions | The same independent sound preference and short Web Audio oscillator/gain cues |
| `src/app/` | Application orchestration and phase progression through `useWizardGame`, whose stable controller exposes home/game navigation, resume status, storage warnings, readonly engine legal actions, human dispatch, explicit round acknowledgement, and abandon controls | Engine, AI, storage, secure/fallback seed sources, motion/timing preferences, UI intents | State updates and persistence requests |
| `src/ErrorBoundary.tsx` | Top-level React render-failure recovery UI | React error lifecycle and the Vite base URL | Accessible reload link to the home screen; never reads, writes, or clears saved-match storage |
| `src/styles/global.css` | Shared fantasy-tavern tokens, reset, home screen, controls, and accessibility preferences | Global semantic elements and home/component class names | Base rendered presentation |
| `src/styles/table.css` | Responsive four-seat table, status, action-tray, hand, and result layout | Game-table, seat, trick, decision, and result class names | Spatial table presentation |
| `src/styles/cards.css` | Suited, special-face, and card-back visual system | `PlayingCard` class names plus visible-card `data-kind` and `data-suit` hooks | Card presentation and legal/illegal interaction states |
| `src/styles/dialogs.css` | Parchment dialogs, backdrops, score-sheet tables, and dialog action areas | Dialog classes and semantic table markup | Modal and score-sheet presentation |
| `tests/` and `e2e/` | Unit, integration, and Playwright browser verification, including full-match, resume, dialog, motion, responsive-layout, and production-asset checks | Public engine/UI contracts plus non-sensitive phase/round/active-player/legal-card DOM hooks | Test reports and uncommitted visual-review screenshots only |
| Root package and tool configuration | ESM runtime, TypeScript project references, Vite build base, and test harness | Source files and package scripts | Development, build, unit-test, and browser-test commands |

## 4. Databases

None.

## 5. Spreadsheets

None.

## 6. External Services, Web Apps & Accounts

| Service | Purpose | Auth / account | Used by |
|---------|---------|----------------|---------|
| GitHub | Public source repository `DenzelJohnson/wizard-card-game` | User's authenticated GitHub account | Git and repository administration |
| GitHub Pages | Verified static hosting at `https://denzeljohnson.github.io/wizard-card-game/` | Repository Pages configuration | Deployment workflow |
| GitHub Actions | Build, test, and deploy the static site | Repository-scoped workflow token | `.github/workflows/deploy.yml` |

No third-party runtime API, analytics, database, or paid service is in scope.

## 7. Automations

| Automation | Trigger / schedule | Reads | Writes | Assumptions it makes |
|------------|--------------------|-------|--------|----------------------|
| GitHub Pages deployment (`.github/workflows/deploy.yml`) | Push to `main` and manual dispatch | Repository source, npm lockfile, unit/build scripts, Playwright Chromium suite, and Vite production output | Uploaded `dist/` Pages artifact and `github-pages` environment deployment | Node 24 and npm scripts match project configuration; `npm run check` produces the production build; Vite base path matches the repository name; action dependencies stay pinned to reviewed immutable commits |

No other scheduled, local, or external automation is part of this project.

## 8. Dependency Map

- `GameState` and action contracts -> produced by `src/game/`; consumed by `src/app/`, `src/ai/`, `src/storage/`, `src/components/`, and tests; `difficulty` is persisted as `easy | medium`, with existing Easy saves remaining schema-v1 compatible
- `Card`, `RngState`, deck creation, and seeded shuffle contracts -> produced by `src/game/types.ts` and `src/game/deck.ts`; consumed by game-state logic, AI, storage validation, and unit tests
- Legal-action contract -> produced by `src/game/`; consumed by human UI controls, Easy AI, and tests
- Persisted-save schema/version -> `src/storage/save.ts` writes complete schema-v1 `GameState` JSON to `wizard-card-game/save-v1`, validates its JSON/key/type/card structure, and delegates phase/trick/score invariants to `src/game/validation.ts`; `src/app/useWizardGame.ts` consumes `LoadResult` / `WriteResult` to resume or surface unavailable storage without exceptions
- Wizard controller contract -> `src/app/useWizardGame.ts` is the sole live-state owner and returns a memoized controller with readonly legal actions plus difficulty-aware start/restart, continue, human dispatch, explicit round acknowledgement, and abandon commands; injected storage, seed, timing, and motion dependencies are captured on initial mount; `src/App.tsx` selects the home or game screen, and `src/components/` renders controller state and emits typed intents while the hook alone schedules round setup, difficulty-selected computer turns, a distinct visible pause between card plays, and trick acknowledgement
- Development seed entry -> in non-production Vite builds only, `src/App.tsx` may parse one base-10 safe integer from the page `seed` query and pass it through the existing `startGame(seed?)` controller boundary for new Easy/restarted matches; invalid, empty, non-integer, or unsafe-integer input passes no override and therefore keeps the controller's secure/fallback seed behavior; production builds do not consume the URL value, while the existing RNG contract normalizes accepted numeric seeds to 32 bits
- Semantic `GameState` validity -> produced by `src/game/validation.ts` using canonical card ownership, existing legal-card/winner/scoring rules, phase readiness, turn order, and cumulative score history; consumed by `src/storage/save.ts` before returning a resumable state
- Accepted-transition invariants -> `src/game/invariants.ts` consumes every newly allocated state returned by `src/game/state.ts`, asserting canonical 60-card ownership and counts, active-player membership, bid ranges, and trick-record totals only in development builds; rejected illegal or stale actions retain reference identity and bypass assertions, production transitions retain their prior behavior, and storage continues to use the stricter semantic validator
- Top-level render recovery -> `src/main.tsx` renders `App` inside `AppErrorBoundary`; its accessible fallback links to Vite's base URL for a clean home reload without touching `wizard-card-game/save-v1`, allowing the normal validated Continue Game path to remain available
- Round/seat progression helpers -> `MAX_ROUNDS` and `nextPlayerId` are produced by `src/game/state.ts`; consumed by engine transitions, semantic validation, and structural round bounds
- `StorageLike` boundary -> implemented by injected browser `localStorage` in app orchestration and in-memory test fakes; only `getItem`, `setItem`, and `removeItem` are required
- Save lifecycle -> resumable phases are persisted; `match-result` clears the resumable record; invalid/nonresumable loads attempt cleanup; explicit clear reports storage removal failures
- Core UI intent contract -> `HomeScreen` receives save/warning flags and a difficulty-aware start callback, exposes enabled Easy and Medium cards containing only their difficulty names, and retains a disabled Hard card containing only its name, top-right Beta badge, and Locked status; `GameTable` receives `GameState`, readonly controller-provided legal actions, one `GameAction` callback, and an optional storage-warning flag rendered inside its main landmark, derives control availability only by exact action matching, sorts the human hand for display as Spades/Hearts/Clubs/Diamonds descending then Wizards then Jesters without mutating engine state, passes the resolved trump suit to human hand cards so only matching suited cards receive a hand-only visual highlight, enlarges the dealer marker, removes the visible opponent card-count badge, and places enlarged bid/trick counters for every player on the felt outside their seat panels; all bid values are withheld until the human bid exists, after which completed bids appear normally; `TrickArea` renders the actual non-interactive face-up card at the dealer-facing edge through bidding, then parks it in the table's upper-left during playing/trick-result phases, with no visible “Trump: suit” copy, adding only a visual suit medallion when a revealed Wizard has chosen trump and keeping equivalent card/trump context in its accessible name; `src/App.tsx` consumes UI intents and routes them to `useWizardGame`
- Result/menu UI contract -> `GameTable` receives explicit round-continue, restart, and home callbacks from `src/App.tsx`; after its sound hooks run, round and match result phases replace the interactive table rather than overlaying it, preserve any storage warning inside the replacement main landmark, and use a single-column result layout at every responsive breakpoint; round results retain menu/score access and summarize each player with only name, signed round change, and cumulative total in descending cumulative-score order, using stable seat order for ties, while match results expose only their result actions; result headings or primary actions receive initial focus; unfinished restart/home requests use described confirmation dialogs, while completed matches may navigate immediately; `RoundSummary` and `ScoreSheet` read stored `roundScores`, and `MatchResult` uses engine `matchWinners` with stable seat-order tie breaking and competition ranks for its displayed standings
- Sound preference and lifecycle contract -> `src/audio/sounds.ts` alone reads and writes exact boolean text under `wizard-card-game/sound-enabled`; `GameMenu` exposes a stable-name pressed toggle, and `GameTable` emits card/trick/round presentation cues only after observed state transitions; the controller coalesces cues behind one suspended-context resume, schedules at most one only after a successful resume, invalidates pending cues when disabled or disposed, retries after failures, disposes its Web Audio context when disabled or unmounted, and never lets storage or Web Audio failures affect gameplay; the preference remains independent of `GameState` and `wizard-card-game/save-v1`
- Visual styling contract -> `src/components/` produces semantic class names and card data hooks; `TrickArea` always renders four player-owned trick slots in a cross (Ember left, Rowan top, Mira right, human bottom) and fills them by `PlayedCard.playerId`; the played-card/empty-slot dimensions and their cross container are approximately twice their original dimensions without changing the separate face-up trump card, while `src/styles/global.css`, `table.css`, `cards.css`, and `dialogs.css` consume those hooks in cascade order from `src/main.tsx`; cards inside `.human-hand` use a hand-only size override approximately twice the shared card size and retain full color/opacity even while disabled, while their native disabled state continues to enforce turn and follow-suit rules; fallback dialogs expose `data-fallback="true"` for viewport-centering when native modal APIs are unavailable; accessibility tests protect landmark, heading, focus, accessible-name/description, hidden-information, card ownership, card-face, result-surface, and table/dialog semantics without coupling to pixel values
- Package scripts and lockfile -> produced by project configuration; consumed by local verification and GitHub Actions
- Playwright configuration -> `PLAYWRIGHT_BASE_URL` selects an already-running server without starting one; when absent, Playwright starts Vite on a documented strict loopback port with strict-port binding; desktop and mobile Chromium projects consume the same public UI in one worker in every environment, and every runner process uses its own PID-scoped ignored output directory so concurrent invocations cannot delete each other's trace artifacts; isolated contexts clear `localStorage`, capture failure diagnostics, and write manual-review screenshots under ignored test output
- Vite base path -> produced by Vite configuration; consumed by production asset routing on GitHub Pages
- Vitest setup -> produced by test configuration; consumed by component tests for DOM cleanup and matcher extensions, while excluding the repository-local `.worktrees/` directory so sibling checkout tests cannot contaminate this project's suite
- Deployment workflow -> `.github/workflows/deploy.yml` runs on `main` pushes or manual dispatch and pins every third-party action to a reviewed full commit SHA; the `contents: read` build job installs the npm lockfile with Node 24, runs `npm run check`, installs Playwright Chromium system/browser dependencies, runs `npm run test:e2e`, verifies `dist/index.html`, and uploads `dist/`; only after that job succeeds, the dependent deploy job receives `pages: write` and `id-token: write`, configures Pages, and deploys the artifact through the protected `github-pages` environment; GitHub Pages consumes that artifact, while Vite's production base path makes its asset URLs valid at `/wizard-card-game/`

## 9. Known Fragilities / UNVERIFIED

- Browser storage can be unavailable or contain corrupt/old data; the application must recover by
  discarding only the invalid save and starting safely.
