## 1. Channel as an install input (deployment lane)

- [x] 1.1 Add `SUBSTRATE_UPDATE_CHANNEL` (`canary` | `fleet` | `hold`, default `canary`) to the manifest's install inputs, and carry it in the installer (8ef21023).
- [x] 1.2 Make gen-env render it into `/etc/substrate/env` and refuse an unknown value, naming the three (8ef21023; placement and comment fixed in 0263d724).
- [x] 1.3 Make `substrate-status` report `channel`, plus `enforced`, `ref`, `sha`, `converged_at` and `ref_missing`, read from pull-sync's convergence record, never from its source (0263d724).
- [x] 1.4 Add a README § Installation usage row (8ef21023).

## 2. Refs exist before anything reads them (needs the user's approval: outward git action)

- [x] 2.1 Create the super-repo `fleet` branch (d4693d2b, a parentless commit). Its tree is that of super-repo 9f1ce189, which install acceptance run 37019710262 verified on both engines and promoted to `:dev`, gitlinks included. It is not `dev`'s tree with each vessel's `dev` head: three vessel heads (activity-api, goal-host, human-surface) had not been judged by anything, and `fleet` names only what was verified. No vessel repository needs a `fleet` branch.
- [ ] 2.2 Record the grant to push `fleet` in the pushPolicy, as its own scope, separate from landing scope.
- [ ] 2.3 Choose the first `fleet` nodes (everything else stays `canary`, today's behaviour). Proposed: syzygy, the hub.
- [x] 2.4 Decide how a canary is frozen: `updateHold` only, no `.env` freeze for canaries (user, 2026-10-02; until 4.2 lands, a canary has no freeze).

## 3. Converge to the channel (pull-sync; coordinator; builder (a))

- [x] 3.0 Authoring nodes are canaries: no channel means `canary`; `fleet`/`hold` turn landing off, refuse an explicit landing switch, and refuse the gap-store holder, a node that runs development-vessel without `GAP_STORE_ENDPOINT` (f3596a2c, correcting ddbecca4; holder detection fixed in the next commit).
- [x] 3.0b On `hold`, converge nothing: no vessel fetch, mirror or restart, no super-repo glue, units or fleet definitions, and no self-reinstall of pull-sync; log one line and write `channel.json` (ref `null`, live SHAs from last-good, else the image's baked revisions). Canary unchanged (`validation/scripts/pull-sync-hold-channel.test.sh`).
- [ ] 3.1 On a non-canary node, converge the super-repo clone to `origin/fleet`, and each vessel clone, detached, to the revision that commit's gitlink names (fetch by revision). Skip ancestry and divergence checks there. If any named revision cannot be fetched, converge nothing, keep last-good, record it and file one gap. Skip, last-good, revert, marker, `DIST_RETRY` and owed-restart keep keying on the one tree.
- [ ] 3.2 Run the check-first test gate, and the failing-test gap generator that rides on it, only on canaries.
- [ ] 3.3 On a missing channel ref, converge nothing, record `ref_missing`, and file one gap per window. Never fall back to `dev`.
- [ ] 3.4 Write `/workspace/.pull-sync/channel.json` each run (channel, ref, super-repo and per-vessel SHAs, at, ref_missing). Done for `hold` (3.0b); canary and fleet still write none, so status reports them "declared; not in effect" until 3.1.
- [ ] 3.5 Read a time-limited `updateHold` impulse that overrides the channel until it expires, on any node including canaries (after 4.2). It is the only way to freeze a canary.
- [ ] 3.6 On `fleet` nodes not under hold, file one gap when `behind` exceeds its threshold for longer than its window (the no-canary watchdog).
- [x] 3.8 Exclude a node whose landings are stopped from gap admission (gap-to-feature), so a consumer node drafts nothing (development-vessel 2e03692a: `admitActionableGaps` excludes all when `landingsStopped()`).
- [ ] 3.7 Set syzygy (the hub) to `fleet` (which turns its landing off) and point its `GAP_STORE_ENDPOINT` at an authoring node, after 2.1 and 3.1.

## 4. Preconditions for advancing (other owners)

- [ ] 4.1 REALIGNMENT §2.5: a sandboxed run exists (`run-isolated-verification.sh` on `origin/dev`, a `sandboxedRun` path that touches no graded store).
- [ ] 4.2 REALIGNMENT §9.0: development-vessel's policy writes are authenticated. Until then: advancing's tuning values are image constants, `updateHold` is not honoured, and the `fleet` push grant is recorded by an operator.

## 5. Advancing (development-vessel; builder (a))

- [ ] 5.1 Register the three checks (levels, cross-node known-answer goal, new failure class) as §2.1 expectation rows, each with a must-fail control.
- [ ] 5.2 Run the known-answer goal through the 4.1 sandbox: no graded store, no `goal_paths`, no template minting.
- [ ] 5.3 `fleet_advance`: push one super-repo `fleet` commit (observed super-repo tree, observed vessel gitlinks) as a fast-forward of `fleet`'s own history. Only if every observed revision is at or after the current `fleet` commit's; otherwise abstain. On a non-fast-forward rejection, re-fetch and re-apply that rule.
- [ ] 5.4 Write the verdict as a `goal_verification_label`.
- [ ] 5.5 On failure: one fleet-wide gap naming the SHA range, the failing check and its evidence. Leave `fleet` where it is. (No settlement row until 8.4 has a reader.)

## 6. Verification

- [ ] 6.1 Positive control: a harmless landing on `dev` reaches the canaries, is advanced, then reaches `fleet` nodes. Each node's `channel.json` shows the advanced SHA.
- [ ] 6.2 Negative control: a canary-only change that breaks a status level is refused, files a gap, and never reaches `fleet` nodes.
- [ ] 6.3 Unhealthy revert on a fleet node restores the previous `fleet` SHA, not a `dev` pin.
- [ ] 6.4 A node with an explicit landing switch, or the gap-store holder, is refused `fleet` at boot (image test in f3596a2c; repeat on a live node).
- [ ] 6.5 Missing-ref control: a node pointed at a nonexistent ref mirrors nothing and reports `channel_ref_missing`.
- [ ] 6.6 An `updateHold` impulse freezes the hub during a drain and expires on its own.
