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
| `src/game/` | Pure rules engine, stable card domain types, deck generation, deterministic RNG, game transitions, legal actions, trick resolution, scoring, and semantic `GameState` validation | Game actions and deterministic RNG interface | `Card`/`RngState` values, versioned `GameState` values, and game-validity results |
| `src/ai/` | Easy-mode computer decisions | Legal actions from `src/game/` | Selected legal action |
| `src/storage/` | Structurally parse, load, save, and clear resumable matches through tagged, non-throwing results | Versioned `GameState`, game-owned semantic validation, and injected `StorageLike` browser storage | `wizard-card-game/save-v1` JSON record |
| `src/components/` | Accessible home and core table interfaces, with focused seat, card, bidding, trump, and trick renderers; later tasks add score, help, and result interfaces | `GameState` display data and controller-provided legal actions | Typed `GameAction` user intents only |
| `src/app/` | Application orchestration and phase progression through `useWizardGame`, whose stable controller exposes home/game navigation, resume status, storage warnings, readonly engine legal actions, human dispatch, explicit round acknowledgement, and abandon controls | Engine, AI, storage, secure/fallback seed sources, motion/timing preferences, UI intents | State updates and persistence requests |
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
- Persisted-save schema/version -> `src/storage/save.ts` writes complete schema-v1 `GameState` JSON to `wizard-card-game/save-v1`, validates its JSON/key/type/card structure, and delegates phase/trick/score invariants to `src/game/validation.ts`; `src/app/useWizardGame.ts` consumes `LoadResult` / `WriteResult` to resume or surface unavailable storage without exceptions
- Wizard controller contract -> `src/app/useWizardGame.ts` is the sole live-state owner and returns a memoized controller with readonly legal actions plus start, continue, human dispatch, explicit round acknowledgement, and abandon commands; injected storage, seed, timing, and motion dependencies are captured on initial mount; `src/App.tsx` selects the home or game screen, and `src/components/` renders controller state and emits typed intents while the hook alone schedules round setup, Easy computer turns, and trick acknowledgement
- Semantic `GameState` validity -> produced by `src/game/validation.ts` using canonical card ownership, existing legal-card/winner/scoring rules, phase readiness, turn order, and cumulative score history; consumed by `src/storage/save.ts` before returning a resumable state
- Round/seat progression helpers -> `MAX_ROUNDS` and `nextPlayerId` are produced by `src/game/state.ts`; consumed by engine transitions, semantic validation, and structural round bounds
- `StorageLike` boundary -> implemented by injected browser `localStorage` in app orchestration and in-memory test fakes; only `getItem`, `setItem`, and `removeItem` are required
- Save lifecycle -> resumable phases are persisted; `match-result` clears the resumable record; invalid/nonresumable loads attempt cleanup; explicit clear reports storage removal failures
- Core UI intent contract -> `HomeScreen` receives save/warning flags and start/continue callbacks; `GameTable` receives `GameState`, readonly controller-provided legal actions, one `GameAction` callback, and an optional storage-warning flag rendered inside its main landmark, derives control availability only by exact action matching, distinguishes decision actors from a resolved trick winner without recomputing rules, and delegates display-only data/callbacks to focused child components; `src/App.tsx` consumes these intents and routes them to `useWizardGame`
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
