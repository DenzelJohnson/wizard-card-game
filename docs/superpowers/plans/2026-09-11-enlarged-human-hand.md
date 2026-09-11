# Enlarged Human Hand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-unlimited:subagent-driven-development (recommended) or superpowers-unlimited:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Double the visual size of cards in the human hand and show disabled hand cards at full color and opacity.

**Architecture:** Use CSS custom-property overrides scoped beneath `.human-hand`, preserving the shared `PlayingCard` component and all engine-driven disabled behavior. Browser tests will verify rendered dimensions and computed styles because these requirements are presentation contracts rather than React data contracts.

**Tech Stack:** React, TypeScript, CSS, Playwright, Vitest, Vite

---

### Task 1: Add the failing browser regression

**Files:**
- Modify: `e2e/wizard.spec.ts`

- [ ] Add a desktop-only test that starts a seeded Easy match and stops at the human bidding phase where every hand card is disabled.
- [ ] Measure the first hand card and require an inline size of at least 150 CSS pixels.
- [ ] Require its computed opacity to equal `1` and filter to equal `none`, while also asserting its native `disabled` property remains true.
- [ ] Run the focused Playwright test against the unchanged UI and confirm it fails on the existing smaller, faded card.

### Task 2: Enlarge the human hand

**Files:**
- Modify: `src/styles/table.css`

- [ ] Set `.human-hand > .playing-card` to a responsive card width approximately twice the current shared size.
- [ ] Increase the hand panel padding and proportional card overlap for desktop and mobile layouts.
- [ ] Add a scoped `.human-hand .playing-card--disabled:disabled` rule that restores `filter: none` and `opacity: 1` without changing `disabled` behavior.
- [ ] Run the focused Playwright test and confirm it passes.

### Task 3: Verify and publish

**Files:**
- Test: `e2e/wizard.spec.ts`
- Verify: `src/styles/table.css`

- [ ] Run `npm run check` and the full Playwright suite.
- [ ] Capture and inspect the hand at desktop, 390px mobile, and a later-round 320px layout.
- [ ] Commit, fast-forward merge to `main`, rerun verification, push, wait for GitHub Pages, and verify the live card dimensions and full-opacity disabled state.
