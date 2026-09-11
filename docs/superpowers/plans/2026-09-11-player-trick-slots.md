# Player Trick Slots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-unlimited:subagent-driven-development (recommended) or superpowers-unlimited:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the four current-trick cards in persistent player-aligned slots forming a cross.

**Architecture:** Keep `GameState.currentTrick` unchanged. `TrickArea` maps plays by player ID and renders every player once with a stable seat-position class; CSS owns the cross geometry and responsive scaling.

**Tech Stack:** React, TypeScript, CSS, Vitest/Testing Library, Playwright

---

### Task 1: Establish the rendering contract

**Files:**
- Modify: `src/components/GameTable.test.tsx`
- Modify: `src/components/TrickArea.tsx`

- [ ] Add a component test expecting four named slots, `left/top/right/bottom` position classes, empty-state labels, and played cards assigned by player ID.
- [ ] Run the targeted test and confirm it fails because the persistent slot structure does not exist.
- [ ] Change `TrickArea` to index plays by player ID and render all players in stable slot positions.
- [ ] Run the targeted component test and confirm it passes.

### Task 2: Form the responsive cross

**Files:**
- Modify: `src/styles/table.css`
- Modify: `e2e/wizard.spec.ts`

- [ ] Add browser assertions for four slot bounding boxes forming the requested cross without overflow.
- [ ] Run the targeted browser test and confirm the old clustered layout fails.
- [ ] Replace the two-column play grid with player-positioned slot geometry and responsive sizes.
- [ ] Run desktop and mobile browser checks and inspect screenshots for card, label, heading, and face-up-card separation.

### Task 3: Verify and publish

**Files:**
- Verify: all changed source, tests, and documentation

- [ ] Run `npm run check`.
- [ ] Run `npm run test:e2e` against the production build.
- [ ] Review the diff and repository status.
- [ ] Commit, merge to `main`, push, wait for GitHub Pages, and verify the public deployment.
