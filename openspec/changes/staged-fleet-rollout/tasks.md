## 1. Channel as an install input (deployment lane)

- [x] 1.1 Add `SUBSTRATE_UPDATE_CHANNEL` (`canary` | `fleet` | `hold`, default `fleet`) to the manifest's install inputs, and carry it in the installer (8ef21023).
- [x] 1.2 Make gen-env render it into `/etc/substrate/env` and refuse an unknown value, naming the three (8ef21023; placement and comment fixed in 0263d724).
- [x] 1.3 Make `substrate-status` report `channel`, plus `enforced`, `ref`, `sha`, `converged_at` and `ref_missing`, read from pull-sync's convergence record, never from its source (0263d724).
- [x] 1.4 Add a README § Installation usage row (8ef21023).

## 2. Refs exist before anything reads them (needs the user's approval: outward git action)

- [ ] 2.1 Create a `fleet` branch at the current `dev` head in the super-repo and every vessel repository.
- [ ] 2.2 Record the grant to push `fleet` in the pushPolicy, as its own scope, separate from landing scope.
- [ ] 2.3 Choose the first canaries. Proposed: one spoke and node 1; the hub stays on `fleet`.

## 3. Converge to the channel (pull-sync; coordinator; builder (a))

- [x] 3.0 Authoring nodes are canaries: gen-env defaults a node that lands code to `canary` and refuses `fleet`/`hold` there (ddbecca4).
- [ ] 3.1 On a non-canary node, converge each vessel clone and the super-repo clone to `origin/<channel ref>` instead of `origin/dev`. Skip, last-good, revert, marker, `DIST_RETRY` and owed-restart are unchanged; they already key on that one tree.
- [ ] 3.2 Run the check-first test gate only on canaries.
- [ ] 3.3 On a missing channel ref, converge nothing, record `ref_missing`, and file one gap per window. Never fall back to `dev`.
- [ ] 3.4 Write `/workspace/.pull-sync/channel.json` each run (channel, ref, super-repo and per-vessel SHAs, at, ref_missing).
- [ ] 3.5 Read a time-limited `updateHold` impulse that overrides the channel until it expires (after 4.2).
- [ ] 3.6 On `fleet` nodes not under hold, file one gap when `behind` exceeds its threshold for longer than its window (the no-canary watchdog).
- [ ] 3.7 Set syzygy (the hub) to `fleet` with `MITOSIS_DIRECT_PUSH=0`, after 2.1.

## 4. Preconditions for advancing (other owners)

- [ ] 4.1 REALIGNMENT §2.5: a sandboxed run exists (`run-isolated-verification.sh` on `origin/dev`, a `sandboxedRun` path that touches no graded store).
- [ ] 4.2 REALIGNMENT §9.0: development-vessel's policy writes are authenticated. Until then: advancing's tuning values are image constants, `updateHold` is not honoured, and the `fleet` push grant is recorded by an operator.

## 5. Advancing (development-vessel; builder (a))

- [ ] 5.1 Register the three checks (levels, cross-node known-answer goal, new failure class) as §2.1 expectation rows, each with a must-fail control.
- [ ] 5.2 Run the known-answer goal through the 4.1 sandbox: no graded store, no `goal_paths`, no template minting.
- [ ] 5.3 `fleet_advance`: advance the exact per-repo SHA set observed running through the settle window, in dependency order, by fast-forward push only. On a non-fast-forward rejection, re-fetch and abstain if `fleet` is already at or past the observed set.
- [ ] 5.4 Write the verdict as a `goal_verification_label`.
- [ ] 5.5 On failure: one fleet-wide gap naming the SHA range, the failing check and its evidence. Leave `fleet` where it is. (No settlement row until 8.4 has a reader.)

## 6. Verification

- [ ] 6.1 Positive control: a harmless landing on `dev` reaches the canaries, is advanced, then reaches `fleet` nodes. Each node's `channel.json` shows the advanced SHA.
- [ ] 6.2 Negative control: a canary-only change that breaks a status level is refused, files a gap, and never reaches `fleet` nodes.
- [ ] 6.3 Unhealthy revert on a fleet node restores the previous `fleet` SHA, not a `dev` pin.
- [ ] 6.3b A node with a git token and `SUBSTRATE_UPDATE_CHANNEL=fleet` is refused at boot (done in ddbecca4's image test; repeat on a live node).
- [ ] 6.4 Missing-ref control: a node pointed at a nonexistent ref mirrors nothing and reports `channel_ref_missing`.
- [ ] 6.6 An `updateHold` impulse freezes the hub during a drain and expires on its own.
