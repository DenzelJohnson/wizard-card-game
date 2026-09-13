# Online multiplayer implementation plan

1. Add the Supabase client dependency and typed multiplayer contracts. Add failing unit tests for
   room configuration, seat allocation, action ownership, and host-only state commits.
2. Create the Supabase schema and RLS/private Realtime policies; enable anonymous auth and disable
   public Realtime. Verify no write policy permits a non-host to alter a game.
3. Extend engine/controller ownership so a match declares computer-controlled seats while local
   solo behavior remains unchanged. Update Easy/Medium decisions to use the supplied bot seats.
4. Build the anonymous identity, create/join lobby, private channel, row subscription, and
   host-authoritative online controller. Keep local persistence isolated from online rooms.
5. Adapt the game UI to take a local seat and room member names, render only that member's hand,
   and send actions to the controller. Add a concise lobby/create/join experience on Home.
6. Run unit, production-build, browser, and Supabase policy checks. Commit, push, and verify the
   GitHub Pages deployment.
