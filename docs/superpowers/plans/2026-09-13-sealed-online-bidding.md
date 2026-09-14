# Sealed Online Bidding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-unlimited:subagent-driven-development (recommended) or superpowers-unlimited:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make online bids simultaneous and hidden until every player has locked one, while visually greying unavailable hand cards.

**Architecture:** Keep `src/game/` and solo play sequential. Add an online-only sealed-bid batch helper that combines final human queue entries with independently generated bot bids, then reduces the existing engine in canonical order in one host commit. A new authenticated Supabase RPC exposes only the caller's own lock boolean; the value remains host-only in `wizard_actions`.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, Playwright, Supabase Postgres/RLS/RPC, Vite.

---

### Task 1: Specify and test the sealed batch transition

**Files:**
- Create: `src/multiplayer/sealedBidding.ts`
- Create: `src/multiplayer/sealedBidding.test.ts`
- Modify: `src/ai/medium.ts`

- [ ] **Step 1: Write failing sealed-bid unit tests**

```ts
it('waits until every human seat has submitted one valid bid', () => {
  expect(sealedBidState(bidding, [{ type: 'PLACE_BID', playerId: 'human', bid: 1 }], members)).toBeNull();
});

it('commits every human and bot bid together in canonical order', () => {
  const next = sealedBidState(bidding, humanSubmissions, members);
  expect(next?.phase).toBe('playing');
  expect(next?.bids.map(({ playerId }) => playerId)).toEqual(['human', 'ember', 'rowan', 'mira']);
});

it('does not let Easy bot bids observe hidden human values', () => {
  expect(botBidsFor(firstState, ['rowan', 'mira']).bids).toEqual(botBidsFor(secondState, ['rowan', 'mira']).bids);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- src/multiplayer/sealedBidding.test.ts`

Expected: FAIL because `sealedBidding.ts` does not yet exist.

- [ ] **Step 3: Implement the smallest batch helper**

```ts
export function sealedBidState(state: GameState, submissions: readonly GameAction[], members: readonly RoomMember[]): GameState | null {
  const humanBids = bidsForEveryHumanSeat(state, submissions, members);
  if (humanBids === null) return null;
  const { bids: botBids, rng } = botBidsFor(state, botSeatsForHumanCount(members.length));
  return commitBidsInTurnOrder({ ...state, rng }, { ...humanBids, ...botBids });
}
```

Export a narrow Medium hand-estimate helper rather than duplicating its existing bid logic. Easy consumes one RNG draw per bot and Medium consumes none.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npm test -- src/multiplayer/sealedBidding.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the tested helper**

```bash
git add src/multiplayer/sealedBidding.ts src/multiplayer/sealedBidding.test.ts src/ai/medium.ts
git commit -m "feat: batch simultaneous online bids"
```

### Task 2: Secure final bid submission and lock recovery

**Files:**
- Create: Supabase migration with `supabase migration new sealed_online_bidding`
- Modify: `src/multiplayer/backend.ts`
- Modify: `src/multiplayer/backend.test.ts`

- [ ] **Step 1: Write failing backend contract tests**

```ts
it('asks the bid-lock RPC only for the current room revision', async () => {
  await expect(backend.hasBidLock('room-1', 4)).resolves.toBe(false);
  expect(client.rpc).toHaveBeenCalledWith('has_wizard_bid_lock', {
    p_room_id: 'room-1', p_expected_revision: 4,
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- src/multiplayer/backend.test.ts`

Expected: FAIL because `hasBidLock` is not part of `OnlineBackend`.

- [ ] **Step 3: Add the RPC migration and typed backend call**

The migration must:

```sql
create or replace function public.has_wizard_bid_lock(p_room_id uuid, p_expected_revision bigint)
returns boolean
language sql security definer set search_path = ''
as $$
  select exists (
    select 1 from public.wizard_actions action
    join public.wizard_room_members member
      on member.room_id = action.room_id and member.user_id = action.user_id
    where action.room_id = p_room_id
      and action.user_id = (select auth.uid())
      and action.expected_revision = p_expected_revision
      and action.action ->> 'type' = 'PLACE_BID'
  );
$$;
```

Validate membership/current phase in the function. Replace `submit_wizard_action` so `PLACE_BID`
does not require the engine's current active seat and rejects a duplicate same-revision bid; retain
turn ownership and replace-on-conflict behavior for all non-bid actions. Revoke public/anon execute
and grant only `authenticated` on the new RPC.

- [ ] **Step 4: Run focused tests and apply/verify the migration**

Run: `npm test -- src/multiplayer/backend.test.ts`

Expected: PASS.

Then use the authenticated Supabase SQL Editor to apply the migration, verify the new function
exists, and verify a member cannot obtain another member's bid value through REST/RPC.

- [ ] **Step 5: Commit the transport/security change**

```bash
git add supabase/migrations src/multiplayer/backend.ts src/multiplayer/backend.test.ts
git commit -m "feat: secure sealed online bid submissions"
```

### Task 3: Connect simultaneous bidding to the online controller

**Files:**
- Modify: `src/app/useOnlineGame.ts`
- Modify: `src/app/useOnlineGame.test.tsx`
- Modify: `src/multiplayer/types.ts`

- [ ] **Step 1: Write failing controller tests**

```ts
it('offers every bid to a local online player independent of engine active seat', async () => {
  expect(result.current.legalActions).toContainEqual({ type: 'PLACE_BID', playerId: 'ember', bid: 1 });
});

it('locks a submitted online bid and commits no state until every human bid is queued', async () => {
  act(() => result.current.dispatch({ type: 'PLACE_BID', playerId: 'human', bid: 1 }));
  await waitFor(() => expect(result.current.bidLocked).toBe(true));
  expect(commitState).not.toHaveBeenCalledWith('room-1', 2, expect.objectContaining({ bids: expect.any(Array) }), expect.anything());
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- src/app/useOnlineGame.test.tsx`

Expected: FAIL because the controller still exposes only active-seat bids and has no `bidLocked` state.

- [ ] **Step 3: Implement online-only submission and host batching**

Add `bidLocked` to `OnlineGameController`. During an online bidding phase, expose 0 through
`state.round` for the local seat until its lock is true. Submit host and guest bids through the
same RPC path. On a successful submit set local lock state; on error clear it. Refresh the boolean
on join/reconnect. In the host reconciliation path, process a complete valid bid batch before
ordinary queued actions. Exclude the old one-at-a-time bot scheduler from bidding, but leave its
choose-trump, playing, trick, and round behavior intact.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npm test -- src/app/useOnlineGame.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the controller change**

```bash
git add src/app/useOnlineGame.ts src/app/useOnlineGame.test.tsx src/multiplayer/types.ts
git commit -m "feat: collect online bids simultaneously"
```

### Task 4: Render the locked state and grey unavailable cards

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/GameTable.tsx`
- Modify: `src/components/BidPanel.tsx`
- Modify: `src/components/GameTable.test.tsx`
- Modify: `src/styles/table.css`

- [ ] **Step 1: Write failing UI tests**

```tsx
it('replaces online bid buttons with a waiting status once the bid is locked', () => {
  render(<GameTable {...props} onlineBidLocked />);
  expect(screen.getByRole('status')).toHaveTextContent('Bid locked');
  expect(screen.queryByRole('button', { name: /^Bid / })).not.toBeInTheDocument();
});

it('marks an illegal follow-suit card as disabled for the grey hand treatment', () => {
  expect(screen.getByRole('button', { name: /Ace of Spades — must follow suit/ })).toHaveClass('playing-card--disabled');
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- src/components/GameTable.test.tsx`

Expected: FAIL because `onlineBidLocked` and its status are absent.

- [ ] **Step 3: Implement the waiting status and visual rule**

Pass `online.bidLocked` from `App` to `GameTable`. Keep the existing solo BidPanel untouched;
when an online bid is locked, replace only the options with a polite live status. Remove the
human-hand override that forced disabled cards back to full colour and apply strong greyscale,
brightness reduction, and opacity to `.human-hand .playing-card--disabled:disabled`.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npm test -- src/components/GameTable.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the UI change**

```bash
git add src/App.tsx src/components/GameTable.tsx src/components/BidPanel.tsx src/components/GameTable.test.tsx src/styles/table.css
git commit -m "feat: show sealed bid waiting state"
```

### Task 5: Verify, document, and publish

**Files:**
- Modify: `README.md`
- Modify: `scope.md`
- Modify: `docs/superpowers/specs/2026-09-13-online-multiplayer-design.md`

- [ ] **Step 1: Update user-facing online rules**

State that online bids are sealed and reveal together, while solo bidding remains sequential.

- [ ] **Step 2: Run all verification**

Run:

```bash
npm test
npm run check
npm run test:e2e
```

Expected: all commands pass. Use the project local-host workflow for a manual two-browser online
round: both humans see bid buttons concurrently, both lock without seeing any values, bots choose
without a visible bid, and all bids appear only with the playing phase. Confirm a wrong-suit card
is visibly greyed and remains disabled.

- [ ] **Step 3: Commit and publish**

```bash
git add README.md scope.md docs/superpowers/specs/2026-09-13-online-multiplayer-design.md
git commit -m "docs: describe sealed online bidding"
git push origin main
```

Expected: GitHub Actions deploys the verified build to GitHub Pages.
