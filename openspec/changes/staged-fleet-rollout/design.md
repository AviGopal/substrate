## Decisions

### Branches, not a release file

The verified state is a git ref, `fleet`, per repository. It is not a manifest of revisions kept somewhere else. A ref keeps git's own fetch, ancestry and fast-forward semantics. The cost is that one advance moves up to 19 refs (super-repo plus vessels), and those moves are not atomic; see "What advancing moves" for why that is safe.

### Two trees per vessel on a fleet node: the clone develops, the runtime source runs

Today one tree per vessel does everything. `pull-sync` keeps the push clone on `origin/dev`, then:
- skips a vessel when the clone's content hash equals `/vessels/<v>` (`:887`);
- mirrors the clone into `/vessels`;
- pins last-good to the clone's HEAD (`:893`, `:1748`, `:1875`) and reverts to it when a vessel comes up unhealthy.

The marker, `DIST_RETRY` and the owed-restart record all key on that one tree. If the clone stays on `dev` but `/vessels` follows `fleet`, every one of those comparisons is between the wrong pair:
- the skip never fires;
- an unhealthy revert would restore a `dev` pin onto a `fleet` node.

So on a node whose channel is not `canary`, `pull-sync` keeps two trees per vessel:
- **The push clone** is unchanged: on `dev`, fetched, rebased and pushed as today. Grounding, composing, check-first and closure read it.
- **The runtime source** is a worktree at `origin/<channel ref>` under `/workspace/.pull-sync/runtime/<v>`. It is the only tree mirrored into `/vessels`.

Every runtime-side comparison moves to the runtime source:
- the skip compares runtime-source hash to `/vessels`;
- last-good records the runtime source's SHA, per channel;
- an unhealthy revert restores the previous runtime-source SHA;
- the marker, `DIST_RETRY` and owed-restart are keyed on `(channel, runtime SHA)`.

On a `canary` node the runtime source *is* the clone, so today's code path is unchanged there.

The super-repo glue layer follows the same rule. Scripts, the federation wrapper and pull-sync's own self-update converge to the channel's ref. A fleet node therefore runs a pull-sync that canaries have already run.

### The test gate runs on canaries only

`tracked_fail_names` (`:116`) decides "red on purpose" from the files one commit changed. A `fleet` delta spans many `dev` commits, so that per-commit reasoning doesn't apply there.
- **Canaries:** run the gate exactly as today, per `dev` commit.
- **Fleet and hold nodes:** do not run it. The revisions they receive were judged on canaries, and re-judging a multi-commit delta with per-commit logic would produce false regressions.
- **Test-only restart skip** (`afb2af1e`): on fleet nodes it classifies the mirrored ref's delta (previous runtime SHA to new runtime SHA), not the clone's `PREV_GOOD..HEAD`.

### Verification of landings always reads `dev`

The landing path judges `dev`, never a node's channel. The gap sweep closes landings as `landed_verified` by re-running a gap's class-2 check. That check, `evidence_resolve`, and the check-first subtraction all evaluate in the push clone, which is on `dev` on every node. A node on `fleet` or `hold` must not see a fresh landing as "absent", and must not judge it against the tree it happens to run. The gap-store holder (node 1 today) may be on any channel without changing what closure sees.

### Masked but owned vessels: fetch the clone, never mirror

`pull-sync` skips a vessel whose unit is masked before it even fetches (`:888`), so the push clone of a vessel this node lands for, but runs elsewhere, goes stale. That is the cause of `node2-compose-grounds-from-a-stale-runtime-mirror-of-a-masked-owned-vessel-so-edits-miss-their-anchor`.

The fix is to fetch and fast-forward that vessel's push clone, so the lane grounds on current `dev`. Nothing is mirrored into `/vessels`. A `dev` tree in `/vessels` on a fleet node would run unverified code the moment the unit is unmasked.

### A missing ref fails closed

If a node's channel ref does not exist on the remote (for example, `fleet` before task 4.1), `pull-sync`:
- mirrors nothing;
- records `ref_missing: true` in `/workspace/.pull-sync/channel.json`;
- files one gap per tick window, not per tick.

`substrate-status` reports `channel_ref_missing`. It never falls back to `dev`: a silent fallback would make every node a canary while status said `fleet`. Task 4.1 (creating the refs) is therefore ordered before task 2 deploys.

### The convergence record

Each tick, `pull-sync` writes `/workspace/.pull-sync/channel.json`: `{channel, ref, sha, at, ref_missing}`, with the super-repo's runtime SHA and a per-vessel `{vessel: sha}` map. `substrate-status` reads `enforced` from this record (`0263d724`): true only when it names the declared channel and the ref exists. It never infers enforcement from pull-sync's source.

### `hold` is a channel and a shaped override

As an install input, the channel is placement, legitimate bootstrap like `PROFILE` (law 1, law 11). Freezing a node for a drain or a rebuild is behaviour, though, so `pull-sync` also reads a time-limited `updateHold` impulse (`{node, until, reason}`). A hold impulse overrides any channel until it expires. It is visible in traces, and it does not need a recreate. Setting `hold` in `.env` remains available for a node that should never update.

## Advancing

### What advancing judges, and where

Advancing runs on a canary node because that is where the change is already running. The judgement is the minimum that would have caught each incident in `proposal.md`:

1. **Levels:** the canary's `substrate-status --json`, with `live`, `seeded` and `served` passing and `usable` passing if it passed before.
2. **Across the constellation:** a known-answer goal dispatched from the canary whose producer is chosen by discovery on another node, reached and graded.
3. **No new failure class:** the journal's error classes in the settle window, compared with the window before convergence. One that's new and recurring (for example, a SurrealDB timeout class, or a fallback warning that fires every sweep) refuses advancing.

Each check is registered as a REALIGNMENT §2.1 expectation row with a must-fail control. A check that cannot fail is not a check. The advance verdict is written as a `goal_verification_label`, the same channel every other verdict uses (§2.2).

**The judgement touches nothing the learning loop grades.** The known-answer goal is a battery run (§2.5, §7.8). It needs the sandboxed run that §2.5 specifies: today `run-isolated-verification.sh` is not on `origin/dev` and `sandboxedRun` does not exist. Task 3.5 depends on them and does not invent a store. Until they exist, advancing cannot run check 2 and so cannot advance. That is deliberate: an advance without the cross-node check is the CI-shaped gap this change exists to close.

### What advancing moves

It moves the exact per-repository SHA set the canary's convergence record showed running throughout the settle window. It never moves the `dev` head at the time of advancing (law 12: what was observed, not what exists now). Refs move in dependency order: shared packages, then vessels, then the super-repo. Each `fleet` only fast-forwards to a SHA that ran on the canary, so a fetch that lands mid-advance sees a mix of SHAs the canary ran together or ran earlier. It never sees an unverified one.

**One advance at a time.** Two canaries could judge different `dev` revisions concurrently. Advancing takes a lease (the existing lease mechanism, `/leases`), so only the holder moves refs, and a canary whose observed set is older than `fleet` already is abstains.

**Canaries need push scope for `fleet`.** The pushPolicy's landing scope covers `dev`. Advancing pushes `fleet`, which is a separate grant recorded in the policy, not implied by landing scope.

### What a failure records

A failed advance names the SHA range (`fleet`..observed set), the failing check and its evidence. It does not guess which commit in the range caused it; narrowing it down is the gap's work.
- **Gap:** written through the gap store's resolve, so it is fleet-wide.
- **Settlement:** contained-self-development 8.4's reader does not exist yet (8.3 unbuilt, 8.4 deferred), and settlement rows are per-node JSONL, so a canary that is not the gap-store holder writes rows nobody reads. Until 8.4 has a reader, the gap is the record, and the settlement row is written to the gap-store holder through the same resolve.

### The no-canary watchdog runs everywhere

Advancing runs only on canaries, so it cannot notice that no canary exists. Every non-canary node's `pull-sync` already knows its `behind` count: commits from its channel ref to `dev`. When `behind` exceeds a tuning threshold for longer than a tuning window, it files one gap ("fleet has not advanced in N hours, M commits behind").

### Builder and trust

- **Builder:** a change to `fleet_advance`, to the channel logic in `pull-sync`, or to the advance checks is a change to the judge of the substrate's own deployment. These are builder **(a)** (operator-authored; the lane may draft, not land), like discovery and identity in REALIGNMENT §2.4.
- **Precondition (REALIGNMENT §9.0):** development-vessel's resolve route is unauthenticated, and policy reads span peers. So the settle window and failure-class tolerance (tuning parameters) could be set by a peer. Advancing reads them only after policy writes are authenticated. Until then, they are constants in the image, deliberately, and listed as such.

## Open question: constellations the network does not have

Live advancing tests the constellation that exists (today: one hub, two peers, several spokes and surfaces). It cannot test "two peers, no hub" or "half the vessel set". Those need throwaway fleets, which in turn need a container engine available to a verification unit. That's a privilege the substrate does not have today, and granting it is a separate security decision. Until it is made, the constellation acceptance harness runs those shapes from CI, and advancing covers the live shape.

## Risks

- **A canary that is also the hub.** If the hub converges to `dev` first, a bad change hits the node everything depends on. The hub defaults to `fleet`, and canaries are leaf-ish nodes that still exercise cross-node paths.
- **The advancing check is too lenient.** Same failure class as a hollow reach. The must-fail controls, the CI witness and the gap triple measure it: a regression first seen after advancing is a gap in the advancing check.
- **Two trees per vessel cost disk and fetch time** on fleet nodes. A worktree shares the clone's object store, so the cost is one checkout per vessel, not one clone.
