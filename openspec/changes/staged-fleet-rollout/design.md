## Decisions

### Branches, not a release file

The advanced state is a git ref, `fleet`, per repository. It is not a manifest of revisions kept somewhere else. `pull-sync` already converges to `origin/$BRANCH`, along with its divergence and last-good handling, so a ref keeps that logic unchanged.

The cost is that one advance moves up to 19 refs (super-repo plus vessels), and those moves are not atomic. A node that fetches halfway through sees some repositories advanced and others not. Two things limit the harm:
- Advancing moves refs in dependency order: shared packages first, then vessels, then the super-repo.
- Each repository's `fleet` only ever fast-forwards to a revision that has already run on canaries, so a partial state is a mix of verified revisions, never an unverified one.

### Running revision vs development revision

Today one clone serves two purposes:
- it is the source `pull-sync` mirrors into `/vessels` (what runs);
- it is the base `vessel-mitosis-cutover` commits on before `git push origin dev` (what develops).

The rollout needs those to diverge on `fleet`-channel nodes. The clones stay on `dev`, and `pull-sync` mirrors `/vessels` from `git archive origin/<channel ref>` (or a worktree at that ref) instead of from the clone's working tree. Divergence handling, last-good pins and the test gate keep operating on the clone, unchanged. The mirror step is the only thing that reads the channel.

### Verification of landings always reads `dev`

The landing path judges `dev`, never a node's channel. The gap sweep closes landings as `landed_verified` by re-running a gap's class-2 check. That check, `evidence_resolve`, and pull-sync's check-first subtraction all evaluate at `origin/dev`, in the push clone or a worktree at that ref. A node on `fleet` or `hold` must not see a fresh landing as "absent", and must not judge it against the tree it happens to run. The gap-store holder (node 1 today) may be on any channel without changing what closure sees.

### What the lane grounds on vs what runs

Two sources, two rules:
- **Grounding** (the source a compose or edit reads and anchors on) follows the push clone: always `dev`.
- **Runtime** (`/vessels`, what the unit executes) follows the channel.

A vessel that a node owns for landing but has masked (it runs elsewhere) still gets its source mirrored from `dev` for grounding, with no restart. This absorbs the filed gap `node2-compose-grounds-from-a-stale-runtime-mirror-of-a-masked-owned-vessel-so-edits-miss-their-anchor`: node 2 owns activity-api's lane but never mirrored it because the unit is masked, and its edits failed with `anchor_not_found`.

### What advancing judges, and where

Advancing runs on a canary node because that is where the change is already running. The judgement is the minimum that would have caught each incident in `proposal.md`:

1. **Levels:** the canary's `substrate-status --json`, with `live`, `seeded` and `served` passing and `usable` passing if it passed before.
2. **Across the constellation:** a known-answer goal dispatched from the canary whose producer is chosen by discovery on another node, reached and graded.
3. **No new failure class:** the journal's error classes in the settle window, compared with the window before convergence. One that's new and recurring (for example, a SurrealDB timeout class, or a fallback warning that fires every sweep) refuses advancing.

**The judgement does not touch what the learning loop grades.** The known-answer goal is a battery run (REALIGNMENT §2.5, §7.8). Its traces, memory and gaps go to a sandboxed store, never the stores the loop grades. It feeds no `goal_paths` and mints no templates: on 10-01, acceptance runs minted two wrong templates on node 2 from a reach through an unreadable write, and they had to be retired.

**A failed advance leaves a settlement row** that the contained-self-development 8.4 reader can act on, as well as a gap. Revert stays 8.3/8.4's job; this change adds no second revert path.

The settle window is a tuning parameter (default 30 min). It is not an env constant, because when to advance is behaviour (law 1).

### Hold, and how a human sees it

`hold` exists for an operator who needs a node frozen while something runs: a drain, a rebuild, a demo. `substrate-status` reports:
- `channel`;
- `running` (the per-vessel revision, as today);
- `channel_head`;
- `behind` (commits between them).

That way a held or lagging node is visible, not silent.

## Open question: constellations the network does not have

Live advancing tests the constellation that exists (today: one hub, two peers, several spokes and surfaces). It cannot test "two peers, no hub" or "half the vessel set". Those need throwaway fleets, which in turn need a container engine available to a verification unit. That's a privilege the substrate does not have today, and granting it is a separate security decision. Until it is made, the constellation acceptance harness runs those shapes from CI, and advancing covers the live shape.

## Risks

- **A canary that is also the hub.** If the hub converges to `dev` first, a bad change hits the node everything depends on. The hub defaults to `fleet`, and canaries are leaf-ish nodes that still exercise cross-node paths.
- **No canary online.** `fleet` stops moving and every `fleet` node falls behind, while landings keep accumulating on `dev`. `substrate-status` on any node shows `behind` growing, and the advancing activity files a gap when no canary has reported within its window.
- **The advancing check is too lenient.** Same failure class as a hollow reach. The CI witness and the gap triple measure it: a regression first seen after advancing is a gap in the advancing check.
