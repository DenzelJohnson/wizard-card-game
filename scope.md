# Project Scope - Wizard Card Game

> Single source of truth for this project's moving parts and how they depend on each other.
> Maintained with the `scope-and-impact-analysis` workflow. Update this file in the same change
> that alters any part below.

_Last updated: 2026-09-05 by Codex_

## 1. Overview

Wizard Card Game is a browser-based, four-player implementation of the standard 60-card Wizard
trick-taking game. One human plays against three computer opponents. The first release provides
Easy mode, where computers choose uniformly at random from legal actions, while Hard mode appears
as a disabled beta option. The application is fully client-side, saves an in-progress match in the
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
| `src/game/` | Pure rules engine, stable card domain types, deck generation, deterministic RNG, game transitions, legal actions, trick resolution, and scoring | Game actions and deterministic RNG interface | `Card`/`RngState` values and versioned `GameState` values |
| `src/ai/` | Easy-mode computer decisions | Legal actions from `src/game/` | Selected legal action |
| `src/storage/` | Validate, load, save, and clear resumable matches through tagged, non-throwing results | Versioned `GameState`; injected `StorageLike` browser storage | `wizard-card-game/save-v1` JSON record |
| `src/components/` | Accessible home, table, bidding, score, help, and result interfaces | View model and legal actions | User intents/actions |
| `src/app/` | Application orchestration and phase progression | Engine, AI, storage, UI intents | State updates and persistence requests |
| `src/styles/` | Fantasy-tavern visual system, responsive layout, motion preferences | Component class names and tokens | Rendered presentation |
| `tests/` | Unit, integration, and end-to-end verification | Public engine/UI contracts | Test reports only |
| Root package and tool configuration | ESM runtime, TypeScript project references, Vite build base, and test harness | Source files and package scripts | Development, build, unit-test, and browser-test commands |

## 4. Databases

None.

## 5. Spreadsheets

None.

## 6. External Services, Web Apps & Accounts

| Service | Purpose | Auth / account | Used by |
|---------|---------|----------------|---------|
| GitHub | Public source repository `DenzelJohnson/wizard-card-game` | User's authenticated GitHub account | Git and repository administration |
| GitHub Pages | Static hosting for the playable game | Repository Pages configuration | Deployment workflow |
| GitHub Actions | Build, test, and deploy the static site | Repository-scoped workflow token | `.github/workflows/deploy.yml` |

No third-party runtime API, analytics, database, or paid service is in scope.

## 7. Automations

| Automation | Trigger / schedule | Reads | Writes | Assumptions it makes |
|------------|--------------------|-------|--------|----------------------|
| GitHub Pages deployment | Push to `main` and manual dispatch | Repository source, lockfile, test/build scripts | GitHub Pages artifact and deployment | Node version and package scripts match project configuration; Vite base path matches repository name |

No scheduled, local, or external automation exists in the empty starting repository.

## 8. Dependency Map

- `GameState` and action contracts -> produced by `src/game/`; consumed by `src/app/`, `src/ai/`, `src/storage/`, `src/components/`, and tests
- `Card`, `RngState`, deck creation, and seeded shuffle contracts -> produced by `src/game/types.ts` and `src/game/deck.ts`; consumed by game-state logic, AI, storage validation, and unit tests
- Legal-action contract -> produced by `src/game/`; consumed by human UI controls, Easy AI, and tests
- Persisted-save schema/version -> `src/storage/save.ts` writes complete schema-v1 `GameState` JSON to `wizard-card-game/save-v1`; the same module validates structural fields, canonical card partitions, and phase-dependent action-order/readiness invariants before loading it, and planned `src/app/useWizardGame.ts` consumes `LoadResult` / `WriteResult` to resume or surface unavailable storage without exceptions
- `StorageLike` boundary -> implemented by injected browser `localStorage` in planned app orchestration and in-memory test fakes; only `getItem`, `setItem`, and `removeItem` are required
- Save lifecycle -> resumable phases are persisted; `match-result` clears the resumable record; invalid/nonresumable loads attempt cleanup; explicit clear reports storage removal failures
- UI intent contract -> produced by `src/components/`; consumed by `src/app/`
- Package scripts and lockfile -> produced by project configuration; consumed by local verification and GitHub Actions
- Vite base path -> produced by Vite configuration; consumed by production asset routing on GitHub Pages
- Vitest setup -> produced by test configuration; consumed by component tests for DOM cleanup and matcher extensions
- Deployment workflow -> reads repository source and build configuration; writes the GitHub Pages deployment

## 9. Known Fragilities / UNVERIFIED

- GitHub Pages must be enabled for workflow-based deployment after repository creation; this will
  be verified during publishing.
- Browser storage can be unavailable or contain corrupt/old data; the application must recover by
  discarding only the invalid save and starting safely.
- Direct navigation and asset URLs must work beneath `/wizard-card-game/`, not only at `/`.
