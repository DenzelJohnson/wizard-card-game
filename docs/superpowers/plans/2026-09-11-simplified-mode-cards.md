# Simplified Mode Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-unlimited:subagent-driven-development (recommended) or superpowers-unlimited:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show only Easy, Medium, and the Hard/Beta/Locked state inside the home-screen difficulty cards.

**Architecture:** Keep the existing `HomeScreen` callbacks and difficulty values unchanged. Remove presentation-only child elements and obsolete accessibility-description wiring, then delete CSS selectors that no longer have producers.

**Tech Stack:** React, TypeScript, CSS, Vitest, Testing Library, Playwright

---

### Task 1: Lock the simplified card contract with a failing test

**Files:**
- Modify: `src/components/HomeScreen.test.tsx`

- [ ] Replace description assertions with exact card text assertions: Easy has `Easy`, Medium has `Medium`, and Hard has `HardBetaLocked` after whitespace normalization.
- [ ] Assert the removed descriptions, action taglines, suit icons, and grid-level Beta note are absent.
- [ ] Run `npm test -- src/components/HomeScreen.test.tsx` and confirm failure on the existing extra content.

### Task 2: Simplify the rendered cards

**Files:**
- Modify: `src/components/HomeScreen.tsx`
- Modify: `src/styles/global.css`

- [ ] Remove description ID constants and `aria-describedby` attributes from mode cards.
- [ ] Remove suit icons, descriptions, Easy/Medium CTA spans, Hard teaser copy, and the separate Hard note.
- [ ] Keep the Hard `aria-label`, Beta badge, and visible Locked span; add a focused locked-status class if needed.
- [ ] Remove CSS rules whose class names no longer have markup producers.
- [ ] Run `npm test -- src/components/HomeScreen.test.tsx` and confirm all HomeScreen tests pass.

### Task 3: Verify and publish

**Files:**
- Test: `src/components/HomeScreen.test.tsx`
- Test: `e2e/wizard.spec.ts`

- [ ] Run `npm run check` and confirm all unit tests and the production build pass.
- [ ] Run `npm run test:e2e` against an isolated local server and confirm desktop/mobile browser coverage passes.
- [ ] Commit, fast-forward merge to `main`, push, wait for the GitHub Pages workflow, and verify the published mode-card text.
