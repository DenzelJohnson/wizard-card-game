# Wizard online multiplayer v1

## Product contract

- A player can create or join a private Wizard room from the home screen.
- A room has exactly four game seats. The host selects two, three, or four human seats; computer
  opponents fill the remainder. Joining people receive the next available seat automatically.
- A short shareable room code connects players on their own devices.
- The host may start once every selected human seat is occupied. Leaving the host's browser ends
  its authority for this first release; a reconnection preserves the anonymous browser identity.
- During a game, every device sees the same public board and only its own hand. A member can act
  only for its seat. Computers retain the selected Easy or Medium decision strategy.

## Technical design

The game engine keeps its stable four internal seat IDs (`human`, `ember`, `rowan`, `mira`). An
online room maps one anonymous Supabase user to each human seat and marks the other seats as bots.
The room host is authoritative: it validates and reduces every action with the existing TypeScript
engine, drives computer and delay transitions, then atomically writes an incremented full state plus
one redacted state per human. Guests submit intents through an identity-checking database function;
the host receives the resulting private action row and guests subscribe only to their own redacted
state. This keeps other hands out of guest browsers and prevents a member from acting for another
seat without exposing server credentials.

## Data and security contract

`wizard_rooms` stores lobby/match configuration, `wizard_room_members` maps users to seats,
`wizard_game_states` stores the host-only complete state, `wizard_player_states` stores one
redacted view per human, and `wizard_actions` queues authenticated action intents for the host.
Every table has RLS enabled. Writes go through identity-checking RPCs;
members read only their room roster and their own state. Private Realtime topic authorization checks
the membership table. Public Realtime access is off.

The deployed client uses only the Supabase project URL and publishable key. The database password
and `service_role`/secret API keys are never copied into the repository or browser.

## Deliberate v1 limits

- The host browser must stay open during an active game. Host migration and server-authoritative
  action validation are later enhancements.
- Anonymous identity persists per browser profile; there is no named-account recovery or invite
  notification system.
- Private room codes are convenience identifiers, not passwords; RLS membership controls access.

## Sealed simultaneous bidding extension

Online bidding is a separate controller-level protocol layered on top of the unchanged sequential
game engine. During a bidding phase, every human seat receives the complete 0-to-round bid range
at the same time. Selecting a bid locks it permanently for the current room revision. The chosen
value is stored in the existing host-only `wizard_actions` queue and never appears in a redacted
player state. A member-facing RPC returns only whether that member has locked a bid, allowing a
reconnected player to recover the waiting state without exposing a value or another player's status.

Once the host sees a valid locked bid from every human seat, it independently generates each
computer bid from the dealt state (Easy uses the match RNG; Medium uses its hand-strength estimate),
then applies all four submitted values through the existing engine in canonical bidding order. That
produces one optimistic host commit where the phase changes to playing and all bids become visible
together. The solo controller continues to use the engine's normal one-seat-at-a-time bidding.

The table displays a concise locked/waiting status after the local selection. Until the atomic
commit arrives, it displays no bid counters for any seat. Separately, unavailable cards in the
human hand—including follow-suit violations—remain native disabled buttons and use strong
greyscale/dimming instead of the former full-colour disabled override.
