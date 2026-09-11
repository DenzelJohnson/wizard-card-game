# Medium AI and Table Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-unlimited:subagent-driven-development (recommended) or superpowers-unlimited:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a strong rule-based Medium mode plus dealer-aware reveal placement, paced card plays, sorted human cards, and revised opponent statistics.

**Architecture:** Extend the persisted difficulty union while preserving schema v1 compatibility. Keep strategy in a focused `src/ai/medium.ts`, select it only in the controller, and keep sorting/presentation as pure UI helpers so engine state remains authoritative.

**Tech Stack:** React 19, TypeScript, Vitest/Testing Library, Playwright, CSS, Vite

---

### Task 1: Difficulty contract and Medium home entry

**Files:** `src/game/types.ts`, `src/game/state.ts`, `src/storage/save.ts`, `src/components/HomeScreen.tsx`, `src/App.tsx`, and their tests.

- [ ] Add failing tests proving `createMatch(seed, 'medium')`, schema-v1 Medium save/load, Easy/Medium home callbacks, and restart retention.
- [ ] Run the focused tests and confirm failures are caused by the missing Medium contract.
- [ ] Add `Difficulty = 'easy' | 'medium'`, make match creation and controller start difficulty-aware, accept both values in save validation, and wire the Medium button.
- [ ] Run the focused tests until green and commit the contract slice.

### Task 2: Rule-based Medium strategy

**Files:** create `src/ai/medium.ts` and `src/ai/medium.test.ts`; modify `src/app/useWizardGame.ts` and its tests.

- [ ] Write fixture-driven failing tests for strong-suit trump choice, strength-based bidding, economical winning, bid-protection losing, legal-action-only output, deterministic ties, and unchanged RNG.
- [ ] Run `npx vitest run src/ai/medium.test.ts src/app/useWizardGame.test.tsx` and confirm expected RED failures.
- [ ] Implement pure scoring helpers and `chooseMediumAction(state)`, always selecting from `legalActions(state)`.
- [ ] Route computer decisions by `state.difficulty`, preserving Easy RNG consumption while Medium leaves RNG unchanged.
- [ ] Run the focused AI/controller suite until green and commit.

### Task 3: Card-play pacing

**Files:** `src/app/useWizardGame.ts`, `src/app/useWizardGame.test.tsx`.

- [ ] Add failing fake-timer tests proving computer plays wait 700 ms, bidding retains 450 ms, and reduced motion reduces both to zero.
- [ ] Add `computerPlayMs` timing injection and select it only for `playing` decisions.
- [ ] Run controller tests until green and commit.

### Task 4: Sorted human hand

**Files:** `src/components/GameTable.tsx`, `src/components/GameTable.test.tsx`.

- [ ] Add a failing DOM-order test for Spades, Hearts, Clubs, Diamonds descending, then Wizards and Jesters.
- [ ] Implement and export a non-mutating `sortHandForDisplay` comparator helper and render the sorted copy.
- [ ] Verify UI tests and commit.

### Task 5: Dealer-relative reveal and opponent statistics

**Files:** `src/components/GameTable.tsx`, `src/components/TrickArea.tsx`, `src/components/PlayerSeat.tsx`, `src/styles/table.css`, and component/accessibility tests.

- [ ] Add failing tests for dealer-position classes, external opponent Bid/Tricks counters, absent visible card counts, retained accessible counts, and dealer marker hook.
- [ ] Pass dealer seat position to `TrickArea`, apply positional modifier classes, split opponent score from round counters, and remove the visible count badge.
- [ ] Add responsive CSS for four reveal positions, enlarged dealer badge, and felt counters at desktop/phone breakpoints.
- [ ] Run component/accessibility tests until green and commit.

### Task 6: End-to-end and deployment verification

**Files:** `e2e/wizard.spec.ts` and documentation only if a test contract needs recording.

- [ ] Add a Medium browser path that begins a match and confirms its persisted difficulty without exposing hidden hands.
- [ ] Run `npm run check` and the complete Playwright suite against a skill-launched local server.
- [ ] Visually inspect desktop, 390 px, and 320 px tables for reveal/card/counter placement and horizontal containment.
- [ ] Merge the feature branch, rerun verification on `main`, push, wait for GitHub Pages, and verify the live site.
