## 1. Channel as an install input (deployment lane)

- [x] 1.1 Add `SUBSTRATE_UPDATE_CHANNEL` (`canary` | `fleet` | `hold`, default `fleet`) to the manifest's install inputs, and carry it in the installer (8ef21023).
- [x] 1.2 Make gen-env render it into `/etc/substrate/env` and refuse an unknown value, naming the three (8ef21023; placement and comment fixed in 0263d724).
- [x] 1.3 Make `substrate-status` report `channel`, plus `enforced`, `ref`, `sha`, `converged_at` and `ref_missing`, read from pull-sync's convergence record, never from its source (0263d724).
- [x] 1.4 Add a README § Installation usage row (8ef21023).

## 2. Refs exist before anything reads them (needs the user's approval: outward git action)

- [ ] 2.1 Create a `fleet` branch at the current `dev` head in the super-repo and every vessel repository.
- [ ] 2.2 Record the grant to push `fleet` in the pushPolicy, as its own scope, separate from landing scope.
- [ ] 2.3 Choose the first canaries. Proposed: one spoke and node 1; the hub stays on `fleet`.

## 3. Two trees per vessel (pull-sync; coordinator; builder (a))

- [ ] 3.1 On non-canary nodes, keep a runtime-source worktree per vessel at `origin/<channel ref>` and mirror only it. The push clone is unchanged (on `dev`).
- [ ] 3.2 Move the skip comparison, last-good pin, unhealthy revert, marker, `DIST_RETRY` and owed-restart to the runtime source, keyed on `(channel, runtime SHA)`.
- [ ] 3.3 Make the super-repo glue layer (including pull-sync's self-update) follow the channel's ref.
- [ ] 3.4 Run the check-first test gate only on canaries. On other nodes, the test-only restart skip classifies the runtime delta (previous to new runtime SHA).
- [ ] 3.5 For masked but owned vessels, fetch and fast-forward the push clone, and mirror nothing (absorbs `node2-compose-grounds-from-a-stale-runtime-mirror-of-a-masked-owned-vessel-so-edits-miss-their-anchor`).
- [ ] 3.6 On a missing channel ref, mirror nothing, record `ref_missing`, and file one gap per window. Never fall back to `dev`.
- [ ] 3.7 Write `/workspace/.pull-sync/channel.json` each tick (channel, ref, super-repo and per-vessel runtime SHAs, at, ref_missing).
- [ ] 3.8 Read a time-limited `updateHold` impulse that overrides the channel until it expires.
- [ ] 3.9 On non-canary nodes, file one gap when `behind` exceeds its threshold for longer than its window (the no-canary watchdog).

## 4. Preconditions for advancing (other owners)

- [ ] 4.1 REALIGNMENT §2.5: a sandboxed run exists (`run-isolated-verification.sh` on `origin/dev`, a `sandboxedRun` path that touches no graded store).
- [ ] 4.2 REALIGNMENT §9.0: development-vessel's policy writes are authenticated. Until then, advancing's tuning values are image constants.

## 5. Advancing (development-vessel; builder (a))

- [ ] 5.1 Register the three checks (levels, cross-node known-answer goal, new failure class) as §2.1 expectation rows, each with a must-fail control.
- [ ] 5.2 Run the known-answer goal through the 4.1 sandbox: no graded store, no `goal_paths`, no template minting.
- [ ] 5.3 `fleet_advance`: take the lease, then advance the exact per-repo SHA set observed running through the settle window, in dependency order, only by fast-forward. Abstain if `fleet` is already ahead.
- [ ] 5.4 Write the verdict as a `goal_verification_label`.
- [ ] 5.5 On failure: one fleet-wide gap naming the SHA range, the failing check and its evidence, plus a settlement row on the gap-store holder. Leave `fleet` where it is.

## 6. Verification

- [ ] 6.1 Positive control: a harmless landing on `dev` reaches the canaries, is advanced, then reaches `fleet` nodes. Each node's `channel.json` shows the advanced SHA.
- [ ] 6.2 Negative control: a canary-only change that breaks a status level is refused, files a gap, and never reaches `fleet` nodes.
- [ ] 6.3 Unhealthy revert on a fleet node restores the previous runtime SHA, not a `dev` pin.
- [ ] 6.4 Missing-ref control: a node pointed at a nonexistent ref mirrors nothing and reports `channel_ref_missing`.
- [ ] 6.5 A masked owned vessel's push clone follows `dev` while `/vessels` for it is untouched.
- [ ] 6.6 An `updateHold` impulse freezes the hub during a drain and expires on its own.
