## Decisions

### Branches, not a release file

The promoted state is a git ref, `fleet`, per repository. It is not a manifest of revisions kept somewhere else. `pull-sync` already converges to `origin/$BRANCH`, along with its divergence and last-good handling, so a ref keeps that logic unchanged.

The cost is that a promotion moves up to 19 refs (super-repo plus vessels), and those moves are not atomic. A node that fetches halfway through sees some repositories promoted and others not. Two things limit the harm:
- Promotion moves refs in dependency order: shared packages first, then vessels, then the super-repo.
- Each repository's `fleet` only ever fast-forwards to a revision that has already run on canaries, so a partial state is a mix of verified revisions, never an unverified one.

### Running revision vs development revision

Today one clone serves two purposes:
- it is the source `pull-sync` mirrors into `/vessels` (what runs);
- it is the base `vessel-mitosis-cutover` commits on before `git push origin dev` (what develops).

The rollout needs those to diverge on `fleet`-channel nodes. The clones stay on `dev`, and `pull-sync` mirrors `/vessels` from `git archive origin/<channel ref>` (or a worktree at that ref) instead of from the clone's working tree. Divergence handling, last-good pins and the test gate keep operating on the clone, unchanged. The mirror step is the only thing that reads the channel.

### What promotion judges, and where

Promotion runs on a canary node because that is where the change is already running. The judgement is the minimum that would have caught each incident in `proposal.md`:

1. **Levels:** the canary's `substrate-status --json`, with `live`, `seeded` and `served` passing and `usable` passing if it passed before.
2. **Across the constellation:** a known-answer goal dispatched from the canary whose producer is chosen by discovery on another node, reached and graded.
3. **No new failure class:** the journal's error classes in the settle window, compared with the window before convergence. One that's new and recurring (for example, a SurrealDB timeout class, or a fallback warning that fires every sweep) refuses promotion.

The settle window is a tuning parameter (default 30 min). It is not an env constant, because when to promote is behaviour (law 1).

### Hold, and how a human sees it

`hold` exists for an operator who needs a node frozen while something runs: a drain, a rebuild, a demo. `substrate-status` reports:
- `channel`;
- `running` (the per-vessel revision, as today);
- `channel_head`;
- `behind` (commits between them).

That way a held or lagging node is visible, not silent.

## Open question: constellations the network does not have

Live promotion tests the constellation that exists (today: one hub, two peers, several spokes and surfaces). It cannot test "two peers, no hub" or "half the vessel set". Those need throwaway fleets, which in turn need a container engine available to a verification unit. That's a privilege the substrate does not have today, and granting it is a separate security decision. Until it is made, the constellation acceptance harness runs those shapes from CI, and promotion covers the live shape.

## Risks

- **A canary that is also the hub.** If the hub converges to `dev` first, a bad change hits the node everything depends on. The hub defaults to `fleet`, and canaries are leaf-ish nodes that still exercise cross-node paths.
- **No canary online.** `fleet` stops moving and every `fleet` node falls behind, while landings keep accumulating on `dev`. `substrate-status` on any node shows `behind` growing, and the promotion activity files a gap when no canary has reported within its window.
- **The promotion check is too lenient.** Same failure class as a hollow reach. The CI witness and the gap triple measure it: a regression first seen after promotion is a gap in the promotion check.
