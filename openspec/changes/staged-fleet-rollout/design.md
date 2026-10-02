## Decisions

### One ref: the super-repo's `fleet` branch is the manifest

The verified state is a single git ref, `fleet` in the super-repo. Each commit on it is an advance:
- its tree is the super-repo tree a canary ran;
- its gitlinks name the exact vessel revisions the canary ran with it.

`fleet` nodes converge the super-repo clone to that commit, and each vessel clone to the revision its gitlink names. Vessel repositories need no `fleet` branch.

This makes an advance atomic (qa review 3, item 3). With one ref per repository, two canaries advancing different repositories at once could leave `fleet` at a combination neither ran. With one ref, an advance is one push, and the super-repo's `fleet` history is the single compare-and-swap point. The branch has its own linear history: each advance commit's parent is the previous advance, not a `dev` commit.

### Authoring nodes are canaries (decided by the user, 2026-10-02)

Drafting and grounding read `/vessels`, the running tree. qa found the readers: `feature-compose.ts`, `gap-to-feature.ts`, `apply-proposal-as-patch.ts`, `author-producer.ts`, `fs-grep.ts`, `docs-align-tick.ts`. Meanwhile `vessel-mitosis-cutover` commits the result onto `dev`. A node that runs `fleet` and also authors would draft against code `dev` has moved past.

Two answers were possible:
- move every authoring reader to a `dev` worktree (6+ code paths, held consistent forever);
- or make every authoring node run `dev`.

The second was chosen: **a node that lands code is a canary.** gen-env enforces it (`f3596a2c`, correcting `ddbecca4`). What makes a node author is the landing switch, not a token: with `MITOSIS_DIRECT_PUSH` anything but `0`, the cutover still commits into the push clone, and `2` lands through host sync. So:
- **No channel:** `canary`, which is today's behaviour (every node follows `dev`). Nothing changes until a node opts in.
- **`fleet` or `hold`:** the node consumes. An unset `MITOSIS_DIRECT_PUSH` is set to `0`; an explicit `1` or `2` is refused.
- **The gap-store holder** (`GAP_STORE_ENDPOINT` empty) is refused on `fleet` or `hold` (qa item 4). It judges `dev` landings against its own clones, so it must run `dev`. Pointing `GAP_STORE_ENDPOINT` at an authoring node's gap store makes a node a non-holder.

Consequences:
- **A non-canary node has one tree per vessel, and it follows the manifest.** pull-sync converges each vessel clone to the revision the super-repo `fleet` commit names, instead of `origin/dev`. Its skip, last-good pin, unhealthy revert, marker, `DIST_RETRY` and owed-restart all already key on that one tree, so they stay mutually consistent. No two-tree split is needed.
- **The super-repo follows the same rule.** On a non-canary node, the super-repo clone (the glue layer, pull-sync's own self-update, and the reach-oracle source) converges to `fleet`. A fleet node therefore runs a pull-sync that canaries already ran.
- **Landing verification is a canary's job.** The gap sweep, `evidence_resolve` and check-first all run on authoring nodes, which run `dev`. The gap-store holder lands code (node 1 today), so it is a canary.
- **The hub stays on `fleet` by not authoring and not holding a gap store.** syzygy today lands code and holds its own gap store (a second store, separate from node 1's). Keeping it on `fleet` means setting its channel to `fleet`, which turns its landing off, and pointing `GAP_STORE_ENDPOINT` at an authoring node (task 3.7).

### The test gate runs on canaries only

`tracked_fail_names` decides "red on purpose" from the files one commit changed. A `fleet` delta spans many `dev` commits, so that per-commit reasoning doesn't apply there.
- **Canaries:** run the gate per `dev` commit, as today.
- **Non-canary nodes:** skip it. The revisions they receive were judged on canaries.
- **Test-only restart skip** (`afb2af1e`): it already classifies the clone's `PREV_GOOD..HEAD`. On a non-canary node that clone follows `fleet`, so it classifies the fleet delta with no change.

### A missing ref fails closed

If a node's channel ref does not exist on the remote (for example, `fleet` before task 2.1), pull-sync:
- converges nothing;
- records `ref_missing: true` in the convergence record;
- files one gap per window, not per tick.

`substrate-status` reports `channel_ref_missing` (`0263d724`). It never falls back to `dev`: a silent fallback would make every node a canary while status said `fleet`. Creating the refs (task 2.1) is ordered before pull-sync reads the channel (task 3).

### The convergence record

Each run, pull-sync writes `/workspace/.pull-sync/channel.json`: `{channel, ref, sha, at, ref_missing}`, with the super-repo SHA and a per-vessel `{vessel: sha}` map. `substrate-status` reads `enforced` from it: true only when it names the declared channel, its ref exists, and it is fresher than three pull-sync runs (`0263d724`, `e6335cd7`). It never infers enforcement from pull-sync's source.

### `hold` is a channel and a shaped override

As an install input, the channel is placement, legitimate bootstrap like `PROFILE` (law 1, law 11). Freezing a node for a drain or a rebuild is behaviour, though, so pull-sync also reads a time-limited `updateHold` impulse (`{node, until, reason}`). A hold impulse overrides any channel until it expires. It is visible in traces, and it does not need a recreate. Setting `hold` in `.env` remains available for a node that should never update.

**Open (qa item 2): freezing a canary.** `hold` is a consumer channel, so an authoring node cannot use it without stopping landing, and `updateHold` waits on §9.0 (task 4.2). Today the only way to stop a canary taking a bad landing is `MITOSIS_DIRECT_PUSH=0` plus a recreate, and that stops landing, not updating. This needs a decision; see `tasks.md` 2.4.

### Out of scope: masked but owned vessels on authoring nodes

qa traced `node2-compose-grounds-from-a-stale-runtime-mirror-of-a-masked-owned-vessel-so-edits-miss-their-anchor` to grounding reading `/vessels`. Masked push clones are already fetched (pull-sync fetches before the mask check), but a masked unit's `/vessels` copy is never refreshed. That happens on authoring nodes, which are canaries under this design, so the rollout neither causes nor fixes it. It stays its own gap. The likely repair is to mirror a masked owned vessel's source on canaries without restarting the unit, which is safe there because a canary runs `dev` anyway.

## Advancing

### What advancing judges, and where

Advancing runs on a canary node because that is where the change is already running. The judgement is the minimum that would have caught each incident in `proposal.md`:

1. **Levels:** the canary's `substrate-status --json`, with `live`, `seeded` and `served` passing and `usable` passing if it passed before.
2. **Across the constellation:** a known-answer goal dispatched from the canary whose producer is chosen by discovery on another node, reached and graded.
3. **No new failure class:** the journal's error classes in the settle window, compared with the window before convergence. One that's new and recurring (for example, a SurrealDB timeout class, or a fallback warning that fires every sweep) refuses advancing.

Each check is registered as a REALIGNMENT §2.1 expectation row with a must-fail control. A check that cannot fail is not a check. The advance verdict is written as a `goal_verification_label` (§2.2).

**The judgement touches nothing the learning loop grades.** The known-answer goal is a battery run (§2.5, §7.8). It needs the sandboxed run §2.5 specifies; today `run-isolated-verification.sh` is not on `origin/dev` and `sandboxedRun` does not exist. Task 5.2 depends on them and does not invent a store. Without them, advancing cannot run check 2 and so does not advance. That is deliberate: an advance without the cross-node check is the CI-shaped gap this change exists to close.

### What advancing moves

One commit on the super-repo's `fleet` branch:
- its tree is the super-repo revision the canary's convergence record showed running throughout the settle window;
- its gitlinks are the vessel revisions shown running alongside it.

It never moves the `dev` head at the time of advancing (law 12: what was observed, not what exists now). Because it is one push, a fetch never sees a partial advance.

**Mutual exclusion and abstaining are defined on the whole set.** An advance is allowed only if, for every repository, the observed revision is at or after the revision the current `fleet` commit names. If any repository is behind, the canary abstains (it is judging something older), and it re-judges after its next convergence. The push is a normal fast-forward of `fleet`'s own history, so a concurrent advance is rejected as non-fast-forward. The loser re-fetches and applies the same whole-set rule to the new `fleet` commit.

**Pushing `fleet` is its own grant.** The pushPolicy's landing scope covers `dev`. Advancing pushes `fleet`, which is a separate grant recorded in the policy, not implied by landing scope.

### What a failure records

A failed advance writes one fleet-wide gap (through the gap store's resolve) naming:
- the SHA range (`fleet`..observed set);
- the failing check;
- its evidence.

It does not guess which commit in the range caused it; narrowing it down is the gap's work. No settlement row is written: contained-self-development 8.4's reader does not exist (8.3 unbuilt, 8.4 deferred), and a row with no reader is an archive, not a record. When 8.4 has a reader, a settlement row is added in the same change that builds it.

### The no-canary watchdog

Advancing runs only on canaries, so it cannot notice that no canary exists. A `fleet` node knows its `behind` count (commits from its channel ref to `dev`). When `behind` exceeds a threshold for longer than a window, it files one gap ("fleet has not advanced in N hours, M commits behind"). `hold` nodes, and nodes under an active `updateHold`, are behind on purpose and do not file it.

### Builder and trust

- **Builder:** a change to `fleet_advance`, to the channel logic in pull-sync, or to the advance checks is a change to the judge of the substrate's own deployment. These are builder **(a)** (operator-authored; the lane may draft, not land), like discovery and identity in REALIGNMENT §2.4.
- **Precondition (REALIGNMENT §9.0):** development-vessel's resolve route is unauthenticated, and policy reads span peers. Three behavioural writes would go through it: the advance tuning values, `updateHold` impulses, and the `fleet` push grant. Each is read only after policy writes are authenticated. Until then, the tuning values are image constants, `updateHold` is not honoured (the `.env` `hold` channel still is), and the `fleet` grant is recorded by an operator.

## Open question: constellations the network does not have

Live advancing tests the constellation that exists (today: one hub, two peers, several spokes and surfaces). It cannot test "two peers, no hub" or "half the vessel set". Those need throwaway fleets, which in turn need a container engine available to a verification unit. That's a privilege the substrate does not have today, and granting it is a separate security decision. Until it is made, the constellation acceptance harness runs those shapes from CI, and advancing covers the live shape.

## Risks

- **Authoring concentrates on canaries.** Every node that lands code runs unverified `dev`, so a bad landing hits the authoring nodes first. That is the intent: they are the nodes best placed to notice and repair it, and they are not the hub.
- **The advancing check is too lenient.** Same failure class as a hollow reach. The must-fail controls, the CI witness and the gap triple measure it: a regression first seen after advancing is a gap in the advancing check.
