# Wizard Card Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-unlimited:subagent-driven-development (recommended) or superpowers-unlimited:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build, test, publish, and deploy a polished 15-round Wizard game for one human and three random legal-move computer players.

**Architecture:** A pure TypeScript game engine owns every rule and state transition. React renders engine state and sends validated intents through an orchestration hook; Easy AI and browser persistence consume the same engine contracts. Vite builds a static GitHub Pages site with no backend.

**Tech Stack:** TypeScript 7, React 19, Vite 8, Vitest 5, Testing Library 16, Playwright 1.63, CSS, localStorage, GitHub Actions, GitHub Pages

---

## File Map

| Path | Responsibility |
|------|----------------|
| `package.json`, `package-lock.json` | Locked scripts and dependencies |
| `tsconfig*.json`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts` | TypeScript, build, unit test, and browser-test configuration |
| `index.html`, `src/main.tsx` | Browser entry point |
| `src/game/types.ts` | Shared domain contracts and discriminated actions |
| `src/game/deck.ts` | Deck creation, seeded randomizer, and shuffle |
| `src/game/rules.ts` | Led suit, legal cards, and trick winner |
| `src/game/scoring.ts` | Round scoring and standings |
| `src/game/state.ts` | Match setup and pure state transitions |
| `src/ai/easy.ts` | Uniform random selection from engine-provided actions |
| `src/storage/save.ts` | Versioned save validation, load, save, and clear |
| `src/app/useWizardGame.ts` | Human intents, timed computer turns, persistence, and presentation acknowledgements |
| `src/components/*.tsx` | Home, table, cards, controls, dialogs, summaries, and final result |
| `src/audio/sounds.ts` | Optional synthesized interface sounds with persisted mute preference |
| `src/styles/*.css` | Fantasy-tavern theme, responsive behavior, focus, and reduced motion |
| `src/test/setup.ts`, `src/**/*.test.ts(x)` | Unit and component tests |
| `e2e/wizard.spec.ts` | Seeded desktop/mobile full-flow and resume checks |
| `.github/workflows/deploy.yml` | Test, build, and GitHub Pages deployment |
| `README.md` | Local commands, rules summary, deployment, and attribution notice |

### Task 1: Bootstrap the typed application and test harness

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/test/setup.ts`
- Create: `.gitignore`

- [ ] **Step 1: Create package and compiler configuration**

Use an ESM package with scripts `dev`, `build`, `test`, `test:watch`, `test:e2e`, and `check`. Pin React 19.2.8, Vite 8.2.2, TypeScript 7.0.2, Vitest 5.0.0, Testing Library 16.3.3, and Playwright 1.63.0. The exact script contract is:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "check": "npm run test && npm run build"
  }
}
```

Configure strict TypeScript, `jsx: react-jsx`, `moduleResolution: Bundler`, and project references from `tsconfig.json` to the app and Node configs. Configure Vite with `base: '/wizard-card-game/'` in production and `/` during development.

- [ ] **Step 2: Add a smoke test before the first component**

Create `src/App.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('shows the game title', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /wizard/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the smoke test and verify failure**

Run: `npm install && npm test -- src/App.test.tsx`  
Expected: FAIL because `src/App.tsx` does not yet export `App`.

- [ ] **Step 4: Add the minimal application shell**

```tsx
export function App() {
  return <main><h1>Wizard</h1></main>;
}
```

Mount `<App />` under `React.StrictMode` from `src/main.tsx`, import `src/styles/global.css`, and configure `src/test/setup.ts` with `@testing-library/jest-dom/vitest` plus cleanup after each test.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- src/App.test.tsx && npm run build`  
Expected: one passing test and a successful `dist/` build.  
Commit: `chore: bootstrap Wizard web app`

### Task 2: Define domain types, deck creation, and deterministic shuffle

**Files:**
- Create: `src/game/types.ts`
- Create: `src/game/deck.ts`
- Create: `src/game/deck.test.ts`

- [ ] **Step 1: Write failing deck tests**

```ts
import { describe, expect, it } from 'vitest';
import { createDeck, createRng, shuffle } from './deck';

describe('Wizard deck', () => {
  it('contains 60 unique cards with four Wizards and four Jesters', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(60);
    expect(new Set(deck.map(card => card.id)).size).toBe(60);
    expect(deck.filter(card => card.kind === 'wizard')).toHaveLength(4);
    expect(deck.filter(card => card.kind === 'jester')).toHaveLength(4);
  });

  it('shuffles repeatably from the same seed without mutating the deck', () => {
    const deck = createDeck();
    const first = shuffle(deck, createRng(42));
    const second = shuffle(deck, createRng(42));
    expect(first.cards.map(card => card.id)).toEqual(second.cards.map(card => card.id));
    expect(deck.map(card => card.id)).toEqual(createDeck().map(card => card.id));
  });
});
```

- [ ] **Step 2: Run the tests and verify failure**

Run: `npm test -- src/game/deck.test.ts`  
Expected: FAIL because `deck.ts` does not exist.

- [ ] **Step 3: Implement the domain and deck API**

Define:

```ts
export const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'] as const;
export type Suit = typeof SUITS[number];
export type Rank = 2|3|4|5|6|7|8|9|10|11|12|13|14;
export type Card =
  | { id: string; kind: 'suited'; suit: Suit; rank: Rank }
  | { id: string; kind: 'wizard' }
  | { id: string; kind: 'jester' };
export interface RngState { value: number }
```

`createDeck()` maps all 13 ranks across four suits, then appends `wizard-1` through `wizard-4` and `jester-1` through `jester-4`. `createRng(seed)` normalizes a zero seed to a nonzero constant. `nextRandom(state)` uses a documented 32-bit Mulberry32 transition and returns `{ value, state }`. `shuffle(cards, state)` uses Fisher-Yates and returns `{ cards, rng }` without mutating input.

- [ ] **Step 4: Verify and commit**

Run: `npm test -- src/game/deck.test.ts`  
Expected: two passing tests.  
Commit: `feat: add deterministic Wizard deck`

### Task 3: Implement legal play and trick resolution

**Files:**
- Create: `src/game/rules.ts`
- Create: `src/game/rules.test.ts`

- [ ] **Step 1: Write table-driven failing tests**

Cover these exact cases with small card fixtures:

```ts
it.each([
  ['no lead allows all', [], ['h2', 's3', 'w1', 'j1']],
  ['must follow the first suited lead', ['h9'], ['h2', 'w1', 'j1']],
  ['a leading Jester does not establish suit', ['j1'], ['h2', 's3', 'w1', 'j2']],
  ['void in led suit allows all', ['h9'], ['s3', 'w1', 'j1']],
])('%s', (_name, trickIds, expectedIds) => {
  expect(legalCards(hand, cards(trickIds)).map(card => card.id)).toEqual(expectedIds);
});

it.each([
  ['first Wizard wins', ['w1', 'w2', 's14', 's13'], 'w1'],
  ['highest trump wins', ['h14', 's2', 's10', 'h13'], 's10'],
  ['highest led suit wins', ['h9', 'h14', 'c14', 'h2'], 'h14'],
  ['first Jester wins an all-Jester trick', ['j2', 'j1', 'j3', 'j4'], 'j2'],
])('%s', (_name, trickIds, winnerId) => {
  expect(winningPlay(plays(trickIds), 'spades').card.id).toBe(winnerId);
});
```

Add a dedicated Jester-then-Wizard test asserting that no led suit is established and later normal cards are unrestricted.

- [ ] **Step 2: Verify failure**

Run: `npm test -- src/game/rules.test.ts`  
Expected: FAIL because rule functions are missing.

- [ ] **Step 3: Implement rules as pure functions**

Export exactly:

```ts
export interface Play { playerId: string; card: Card }
export function ledSuit(plays: readonly Play[]): Suit | null;
export function legalCards(hand: readonly Card[], plays: readonly Play[]): Card[];
export function winningPlay(plays: readonly Play[], trump: Suit | null): Play;
```

`legalCards` always includes specials, requires normal cards of `ledSuit` when present, and returns a fresh array. `winningPlay` applies first Wizard, highest trump, highest led suit, then first Jester precedence. Throw a descriptive error only for an empty trick.

- [ ] **Step 4: Verify and commit**

Run: `npm test -- src/game/rules.test.ts`  
Expected: all rules cases pass.  
Commit: `feat: enforce Wizard trick rules`

### Task 4: Implement scoring and the complete match state machine

**Files:**
- Create: `src/game/scoring.ts`
- Create: `src/game/scoring.test.ts`
- Create: `src/game/state.ts`
- Create: `src/game/state.test.ts`
- Modify: `src/game/types.ts`

- [ ] **Step 1: Write failing scoring tests**

```ts
it.each([
  [0, 0, 20], [1, 1, 30], [5, 5, 70],
  [0, 2, -20], [4, 2, -20], [2, 3, -10],
])('scores bid %i with %i tricks as %i', (bid, tricks, expected) => {
  expect(scoreRound(bid, tricks)).toBe(expected);
});
```

- [ ] **Step 2: Write failing state-transition tests**

Test `createMatch(42)` creates four players and round 1; `dealRound` deals one unique card each; Wizard up-card enters `choose-trump`; suited/Jester up-cards enter `bidding`; bids proceed left of dealer through dealer; only an active player's legal card can be played; the fourth play enters `trick-result`; acknowledging 15 completed tricks scores round 15 and enters `match-result`; dealer rotates every round; tied highest scores return shared winners.

- [ ] **Step 3: Verify failure**

Run: `npm test -- src/game/scoring.test.ts src/game/state.test.ts`  
Expected: FAIL because state and scoring modules are missing.

- [ ] **Step 4: Define the explicit state contract**

Use stable player IDs `human`, `ember`, `rowan`, `mira` and this phase union:

```ts
export type GamePhase =
  | 'round-setup' | 'choose-trump' | 'bidding' | 'playing'
  | 'trick-result' | 'round-result' | 'match-result';

export type GameAction =
  | { type: 'DEAL_ROUND' }
  | { type: 'CHOOSE_TRUMP'; playerId: string; suit: Suit }
  | { type: 'PLACE_BID'; playerId: string; bid: number }
  | { type: 'PLAY_CARD'; playerId: string; cardId: string }
  | { type: 'ACKNOWLEDGE_TRICK' }
  | { type: 'ACKNOWLEDGE_ROUND' };
```

`GameState` includes `schemaVersion: 1`, match/round/dealer/active IDs, `rng`, shuffled deck remainder, hands, trump/up-card, ordered bids, current and completed tricks, per-round trick counts, total scores, round rows, and a bounded event message list.

- [ ] **Step 5: Implement minimal pure transitions**

Implement `scoreRound`, `createMatch`, `reduceGame`, `legalActions`, and `matchWinners`. Reject actions whose phase, player, bid, suit, or card is invalid by returning the unchanged state. Use immutable updates. Deal round N cards per seat, reveal trump only when cards remain, and clear per-round collections before bidding.

- [ ] **Step 6: Verify all engine tests and commit**

Run: `npm test -- src/game`  
Expected: all deck, rule, scoring, and state tests pass.  
Commit: `feat: add complete Wizard match engine`

### Task 5: Add random Easy opponents

**Files:**
- Create: `src/ai/easy.ts`
- Create: `src/ai/easy.test.ts`

- [ ] **Step 1: Write failing legality and determinism tests**

```ts
it('returns one engine-provided legal action for the active computer', () => {
  const state = computerTurnFixture();
  const choices = legalActions(state);
  const result = chooseEasyAction(state);
  expect(choices).toContainEqual(result.action);
});

it('returns the same choice and next RNG state for the same state', () => {
  const state = computerTurnFixture();
  expect(chooseEasyAction(state)).toEqual(chooseEasyAction(state));
});
```

Add fixtures for bidding, Wizard trump selection, and card play. Assert human turns and result phases return `null`.

- [ ] **Step 2: Verify failure**

Run: `npm test -- src/ai/easy.test.ts`  
Expected: FAIL because `chooseEasyAction` is missing.

- [ ] **Step 3: Implement uniform legal selection**

```ts
export function chooseEasyAction(
  state: GameState,
): { action: GameAction; rng: RngState } | null
```

Read choices only from `legalActions(state)`, consume one random number, choose index `Math.floor(value * choices.length)`, and return the advanced RNG with the action. Never inspect card strength, bids, scores, or likely winners.

- [ ] **Step 4: Verify and commit**

Run: `npm test -- src/ai/easy.test.ts src/game`  
Expected: all tests pass.  
Commit: `feat: add random legal Easy opponents`

### Task 6: Add resilient browser save and resume

**Files:**
- Create: `src/storage/save.ts`
- Create: `src/storage/save.test.ts`

- [ ] **Step 1: Write failing persistence tests**

Test round-trip save/load, absent record, invalid JSON, wrong schema version, missing cards, duplicate card IDs, a storage getter that throws, a storage setter that throws, and clearing the record. Use an injected `StorageLike` fake rather than global localStorage.

```ts
expect(saveGame(storage, state)).toEqual({ ok: true });
expect(loadGame(storage)).toEqual({ ok: true, state });
expect(loadGame(storageWith('{broken'))).toEqual({ ok: false, reason: 'invalid' });
```

- [ ] **Step 2: Verify failure**

Run: `npm test -- src/storage/save.test.ts`  
Expected: FAIL because persistence functions are missing.

- [ ] **Step 3: Implement the versioned save boundary**

Export `SAVE_KEY = 'wizard-card-game/save-v1'`, `loadGame`, `saveGame`, and `clearGame`. Validate every field needed by the engine, known player/card IDs, 60-card uniqueness across all locations, legal phase values, integer score/bid/trick fields, and RNG state. Return tagged results rather than throwing. Treat `match-result` as non-resumable.

- [ ] **Step 4: Verify and commit**

Run: `npm test -- src/storage/save.test.ts src/game`  
Expected: all tests pass.  
Commit: `feat: persist resumable matches safely`

### Task 7: Build the orchestration hook

**Files:**
- Create: `src/app/useWizardGame.ts`
- Create: `src/app/useWizardGame.test.tsx`

- [ ] **Step 1: Write failing hook tests with fake timers**

Test that the hook loads a valid save, exposes `hasSavedGame`, starts a seeded new match, saves accepted human actions, schedules exactly one computer action, advances result phases after a visible delay, cancels timers on unmount, clears a save when abandoned, and continues in memory while exposing a storage warning after a save error.

- [ ] **Step 2: Verify failure**

Run: `npm test -- src/app/useWizardGame.test.tsx`  
Expected: FAIL because the hook is missing.

- [ ] **Step 3: Implement the controller API**

```ts
export interface WizardGameController {
  screen: 'home' | 'game';
  state: GameState | null;
  hasSavedGame: boolean;
  storageWarning: boolean;
  legalActions: GameAction[];
  startGame(seed?: number): void;
  continueGame(): void;
  dispatchHuman(action: GameAction): void;
  abandonGame(): void;
}
```

Use one reducer-backed state owner. Drive Easy turns from an effect only when the active player is not human. Use 450 ms for computer decisions and 900 ms for trick acknowledgement, reduced to zero when the media query prefers reduced motion. Persist each accepted transition.

- [ ] **Step 4: Verify and commit**

Run: `npm test -- src/app/useWizardGame.test.tsx`  
Expected: hook tests pass without pending-timer warnings.  
Commit: `feat: orchestrate human and computer turns`

### Task 8: Build the home screen and core game table

**Files:**
- Modify: `src/App.tsx`
- Create: `src/components/HomeScreen.tsx`
- Create: `src/components/GameTable.tsx`
- Create: `src/components/PlayerSeat.tsx`
- Create: `src/components/PlayingCard.tsx`
- Create: `src/components/BidPanel.tsx`
- Create: `src/components/TrumpPanel.tsx`
- Create: `src/components/TrickArea.tsx`
- Create: `src/components/HomeScreen.test.tsx`
- Create: `src/components/GameTable.test.tsx`

- [ ] **Step 1: Write failing home tests**

Assert Easy starts a game, Hard has `disabled` and `aria-describedby` pointing to a Beta explanation, Continue appears only with a valid save, and starting over with a save opens a confirmation dialog.

- [ ] **Step 2: Write failing table tests**

Assert four named seats render, opponents show backs/counts but not card faces, trump/dealer/active labels render, legal cards are buttons, illegal cards are disabled, bids 0 through round number render only on a human bid turn, and four trump suit choices render only on a human dealer choice.

- [ ] **Step 3: Verify failure**

Run: `npm test -- src/components/HomeScreen.test.tsx src/components/GameTable.test.tsx`  
Expected: FAIL because the components are missing.

- [ ] **Step 4: Implement accessible screens from controller state**

`App` owns `useWizardGame` and swaps home/game screens. `PlayingCard` receives `{ card, playable, onPlay, faceDown }`, uses a real `<button>` for playable human cards, and renders rank plus suit text/symbol. `GameTable` derives no rules itself: it matches cards against controller-provided legal `PLAY_CARD` actions and emits the selected action. All phase prompts use an `aria-live="polite"` status element.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- src/components src/App.test.tsx`  
Expected: home and table tests pass.  
Commit: `feat: build Wizard home and game table`

### Task 9: Add scoring, help, settings, and result interfaces

**Files:**
- Create: `src/components/ScoreSheet.tsx`
- Create: `src/components/RoundSummary.tsx`
- Create: `src/components/MatchResult.tsx`
- Create: `src/components/GameMenu.tsx`
- Create: `src/components/RulesDialog.tsx`
- Create: `src/audio/sounds.ts`
- Create: `src/audio/sounds.test.ts`
- Create: `src/components/Results.test.tsx`
- Modify: `src/components/GameTable.tsx`

- [ ] **Step 1: Write failing result and dialog tests**

Assert each round row displays round, trump, bid, tricks, delta, and cumulative score; round summary spells out exact/missed calculations; shared winners are all announced; Escape and close buttons dismiss dialogs; focus returns to the opener; restart and return-home actions require confirmation during a live match. Test that sound defaults off, can be enabled after a user gesture, stores only the mute preference, and never throws when `AudioContext` is unavailable.

- [ ] **Step 2: Verify failure**

Run: `npm test -- src/components/Results.test.tsx`  
Expected: FAIL because result components are missing.

- [ ] **Step 3: Implement the remaining UI states**

Use native `<dialog>` where supported with a controlled fallback wrapper in tests. `ScoreSheet` uses a captioned table and horizontal overflow on small screens. `RoundSummary` renders the formula from stored round rows, never recalculating domain results. `MatchResult` reads `matchWinners(state)`. `RulesDialog` provides concise original prose for objective, trump, bidding, legal play, special cards, and scoring. `GameMenu` includes score sheet, rules, sound, restart, and home actions. Implement short card, trick-win, and round-result tones with the Web Audio API after user opt-in; persist `wizard-card-game/sound-enabled` independently from the match save and degrade silently when audio is unavailable.

- [ ] **Step 4: Verify and commit**

Run: `npm test -- src/components`  
Expected: all component tests pass.  
Commit: `feat: add score and game result experiences`

### Task 10: Apply the fantasy-tavern visual system and accessibility polish

**Files:**
- Create: `src/styles/global.css`
- Create: `src/styles/table.css`
- Create: `src/styles/cards.css`
- Create: `src/styles/dialogs.css`
- Modify: `src/main.tsx`
- Modify: all visual components from Tasks 8–9

- [ ] **Step 1: Add a structural accessibility test before styling**

Test one `main` landmark, one current-status live region, heading hierarchy, accessible names for every card button, non-color trump labels, no positive `tabIndex`, and disabled Hard mode.

- [ ] **Step 2: Verify the test exposes missing semantics**

Run: `npm test -- src/components/GameTable.test.tsx src/components/HomeScreen.test.tsx`  
Expected: FAIL on at least the newly asserted missing landmark/status labels.

- [ ] **Step 3: Implement theme tokens and responsive layouts**

Define color, spacing, radius, shadow, type, and timing custom properties under `:root`. Use layered CSS gradients for candlelit wood and parchment so no external imagery is required. Use CSS grid for four table seats, a centered trick, and bottom hand. At `max-width: 720px`, reduce ornament, overlap cards with negative inline margins, preserve minimum 44 px controls, and allow horizontal hand scrolling. Hearts/diamonds use burgundy red; clubs/spades use near-black; every suit also shows a symbol and text label.

- [ ] **Step 4: Implement cards and motion safely**

Use semantic text and CSS pseudo-elements for original Wizard/Jester faces. Animate card entrance, legal hover lift, active-seat glow, and trick winner with transform/opacity only. Under `@media (prefers-reduced-motion: reduce)`, set animation/transition durations to `0.01ms` and disable smooth scrolling.

- [ ] **Step 5: Verify and commit**

Run: `npm run check`  
Expected: all unit/component tests pass and production build succeeds.  
Commit: `feat: style the fantasy tavern experience`

### Task 11: Add browser-level match, resume, and responsive verification

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/wizard.spec.ts`
- Modify: `src/app/useWizardGame.ts`
- Modify: `src/components/GameTable.tsx`

- [ ] **Step 1: Add deterministic test entry support**

In development/test builds only, accept `?seed=<integer>` when starting a match and add stable `data-testid` values for phase, round, active player, and legal cards. Production behavior without the parameter uses `crypto.getRandomValues`.

- [ ] **Step 2: Write the failing browser flows**

Create Playwright tests that start Easy with seed 42, repeatedly choose the first enabled human bid/suit/card, and assert reaching round 15 then the final standings; refresh during bidding and during a partial trick and assert the exact round/phase/card counts resume; repeat the critical first-round flow at 390×844; assert Hard cannot receive focus or clicks.

- [ ] **Step 3: Run and diagnose failures**

Launch the application only through `$run-local-host`, then run: `npm run test:e2e`  
Expected: initial failures identify any missing stable controls or phase timing.

- [ ] **Step 4: Make only the changes required by the browser flows**

Keep test helpers outside production domain logic. Fix transition timing, focus, layout overflow, or resume rendering at the owning module. Do not add strategic AI or alternate rules.

- [ ] **Step 5: Verify and commit**

Run: `npm run check && npm run test:e2e`  
Expected: all tests pass at configured desktop and mobile projects.  
Commit: `test: cover complete and resumable matches`

### Task 12: Document, publish, deploy, and verify

**Files:**
- Create: `.github/workflows/deploy.yml`
- Create: `README.md`
- Modify: `scope.md` only if final paths/contracts differ from its current map

- [ ] **Step 1: Add the deployment workflow**

Use `actions/checkout`, `actions/setup-node` with Node 24 and npm cache, `npm ci`, `npm run check`, `npm run test:e2e` when browser dependencies are available, `npm run build`, `actions/configure-pages`, `actions/upload-pages-artifact` with `dist`, and `actions/deploy-pages`. Grant only `contents: read`, `pages: write`, and `id-token: write`; serialize deployments with a `pages` concurrency group.

- [ ] **Step 2: Write project documentation**

Document requirements, `npm ci`, the mandatory `$run-local-host` process for local serving, test/build commands, full rules summary, save behavior, accessibility controls, project structure, Pages URL, and a fan-project notice. State that Wizard is associated with its respective rights holders and that the repository contains no copied commercial artwork.

- [ ] **Step 3: Run final local verification**

Run: `npm ci && npm run check && npm run test:e2e && git diff --check && git status --short`  
Expected: clean install, all tests/build pass, no whitespace errors, and only intended files are tracked/untracked.

- [ ] **Step 4: Create and push the public repository**

Switch GitHub CLI to `DenzelJohnson`, create `DenzelJohnson/wizard-card-game` as public with this directory as source, set `origin`, and push `main`. Verify the remote URL and default branch before changing Pages settings.

- [ ] **Step 5: Enable and verify GitHub Pages**

Configure Pages to deploy through GitHub Actions, push the workflow, and wait for the deployment check. Verify the repository URL and the live site at `https://denzeljohnson.github.io/wizard-card-game/`, including direct asset loads and a fresh Easy match.

- [ ] **Step 6: Final commit and handoff**

Commit documentation/workflow changes as `docs: add deployment and project guide`. Report the local path, repository URL, Pages URL, exact verification results, and any GitHub-side warning that remains.
