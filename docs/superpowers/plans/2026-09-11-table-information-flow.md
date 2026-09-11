# Table Information Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-unlimited:subagent-driven-development (recommended) or superpowers-unlimited:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify round summaries and correctly stage bid, human-stat, and revealed-card information.

**Architecture:** Derive presentation-only flags from the existing `GameState` inside `GameTable`. Extend focused component props for visibility/placement, then style those semantic states without changing game data.

**Tech Stack:** React, TypeScript, CSS, Vitest/Testing Library, Playwright

---

### Task 1: Simplify round summaries

**Files:**
- Modify: `src/components/Results.test.tsx`
- Modify: `src/components/RoundSummary.tsx`
- Modify: `src/styles/table.css`

- [ ] Add a failing test requiring only name, signed delta, and total in each player row.
- [ ] Run the targeted test and confirm the old bid/formula copy causes failure.
- [ ] Replace detailed scoring prose with compact delta and total markup.
- [ ] Run the targeted test and confirm it passes.

### Task 2: Stage bids and player counters

**Files:**
- Modify: `src/components/GameTable.test.tsx`
- Modify: `src/components/GameTable.tsx`
- Modify: `src/components/PlayerSeat.tsx`
- Modify: `src/styles/table.css`

- [ ] Add failing tests that hide every bid before the human bids and expose external human/opponent stats afterward.
- [ ] Run the targeted tests and confirm current rendering fails.
- [ ] Derive `bidsVisible`, pass visibility into every seat, and enable external stats for the human.
- [ ] Add the bottom-seat felt-counter position and run the targeted tests.

### Task 3: Move the face-up card after bidding

**Files:**
- Modify: `src/components/GameTable.test.tsx`
- Modify: `src/components/GameTable.tsx`
- Modify: `src/components/TrickArea.tsx`
- Modify: `src/styles/table.css`

- [ ] Add a failing phase-transition test for dealer-facing during bidding and upper-left during play/trick result.
- [ ] Run it and confirm the upper-left placement state is absent.
- [ ] Add an explicit reveal placement prop/class and responsive corner styling.
- [ ] Run the targeted test and confirm it passes.

### Task 4: Browser verification and publication

**Files:**
- Modify: `e2e/wizard.spec.ts`

- [ ] Add browser assertions for pre-human bid privacy, post-bid counters, corner reveal placement, and viewport containment.
- [ ] Run `npm run check` and the full Playwright suite.
- [ ] Inspect desktop, 390px, and 320px screenshots.
- [ ] Commit, merge to `main`, push, await GitHub Pages, and verify the live deployment.
