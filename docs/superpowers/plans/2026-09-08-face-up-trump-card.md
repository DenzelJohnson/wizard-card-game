# Face-Up Trump Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-unlimited:subagent-driven-development (recommended) or superpowers-unlimited:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the normal top-left gameplay status panel and render the actual revealed up card on the central felt without visible trump prose.

**Architecture:** `GameTable` remains responsible for selecting state passed to children, while `TrickArea` becomes the single presentation owner for the reveal and current trick. Existing `PlayingCard` markup is reused; a wrapper supplies an accessible summary and a Wizard-only resolved-suit medallion. CSS keeps the reveal distinct from current-trick cards across desktop and narrow layouts.

**Tech Stack:** React 19, TypeScript 7, CSS, Vitest, Testing Library, Playwright

---

### Task 1: Specify the new table presentation

**Files:**
- Modify: `src/components/GameTable.test.tsx`
- Modify: `src/components/Accessibility.test.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Replace text-panel assertions with revealed-card assertions**

Add assertions equivalent to:

```tsx
expect(screen.queryByText('Round 3 of 15')).not.toBeInTheDocument();
expect(screen.queryByRole('status')).not.toBeInTheDocument();
expect(screen.queryByText(/Trump:/)).not.toBeInTheDocument();
expect(screen.getByRole('img', { name: 'Ten of Hearts' })).toBeInTheDocument();
expect(screen.getByLabelText('Face-up card: Ten of Hearts. Hearts are trump.')).toBeInTheDocument();
```

Add focused cases for a Wizard before and after trump selection, a Jester/no-trump reveal, and
round 15 with no reveal. Assert the resolved Wizard suit medallion by a stable class/data hook and
verify it contains only the suit symbol visually.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```sh
npx vitest run src/components/GameTable.test.tsx src/components/Accessibility.test.tsx src/App.test.tsx
```

Expected: FAIL because the old text status/trump panel still renders and `TrickArea` does not yet
render the reveal.

### Task 2: Move the reveal onto the felt

**Files:**
- Modify: `src/components/GameTable.tsx`
- Modify: `src/components/TrickArea.tsx`
- Modify: `src/styles/table.css`

- [ ] **Step 1: Change the `TrickArea` contract**

Extend its props with the exact state values:

```ts
readonly revealedUpCard: Card | null;
readonly trump: Suit | null;
readonly dealerChoosingTrump: boolean;
```

Render a reveal wrapper only when a card exists. Use `PlayingCard` with `playable={false}`. Give
the wrapper an accessible name derived from the card and trump state. Render:

```tsx
{revealedUpCard.kind === 'wizard' && trump !== null && !dealerChoosingTrump ? (
  <span className="face-up-card__trump-suit" aria-hidden="true">
    {suitSymbol(trump)}
  </span>
) : null}
```

- [ ] **Step 2: Remove the normal status/trump block from `GameTable`**

Keep `<h1 id="game-table-heading" className="sr-only">Wizard game table</h1>` directly under the
gameplay `<main>`. Render the existing storage warning in a status-area wrapper only on failure.
Delete `TrumpDisplay`, `upCardContext`, and `phasePrompt`, then pass the reveal/trump values into
`TrickArea`.

- [ ] **Step 3: Restyle the grid and central reveal**

Keep the desktop `status` grid area unoccupied in normal play. Remove obsolete trump/status text
rules, retain a warning-only status style, and add `.face-up-card` positioning plus a small
Wizard-suit medallion. At 390 px and 320 px, size/overlap the reveal so the trick and controls stay
contained and the human hand keeps horizontal scrolling.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the Task 1 command. Expected: all focused tests pass.

- [ ] **Step 5: Run the complete local gate**

Run:

```sh
npm run check
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 npm run test:e2e
git diff --check
```

Expected: 221+ unit/component tests pass, production build succeeds, all applicable browser tests
pass, and no whitespace errors are reported.

### Task 3: Inspect and deploy

**Files:**
- Modify: `docs/superpowers/plans/2026-09-08-face-up-trump-card.md` only for checkbox progress

- [ ] **Step 1: Inspect desktop and mobile screenshots**

Start/reuse the local server only through `$run-local-host`. Capture desktop and 390 px gameplay
with a face-up card and confirm the top-left cell is empty, the reveal is on the felt, a Wizard
medallion is legible, and no table content clips at 320 px.

- [ ] **Step 2: Commit and push**

Commit the coordinated production/test/style changes, then push `main` so the existing protected
GitHub Pages workflow runs.

- [ ] **Step 3: Verify production**

Wait for the GitHub Actions deployment to succeed. Open
`https://denzeljohnson.github.io/wizard-card-game/`, start a fresh Easy game, and confirm the live
central reveal plus empty normal top-left area.
