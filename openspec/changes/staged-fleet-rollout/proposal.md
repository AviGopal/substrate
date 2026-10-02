## Why

Every landing on `origin/dev` reaches every node within minutes. `substrate-pull-sync` converges each vessel's clone to `origin/dev` and restarts the vessel, on every node, with nothing between "it landed" and "every node runs it". Measured on 2026-10-01/02:

- A retention change that a human had decided to approve went live on the public hub before the approval was given, because the landing itself was the deployment.
- Five test-only and fix commits in 90 minutes each restarted activity-api on every node. Each restart killed the hub's retention sweep partway through, and the hub was the node least able to afford it.
- A fix whose read had a 1.5 s deadline was correct on node 1 and silently skipped its work on the saturated hub. Nothing measured it on that node before every node ran it.

The substrate develops itself, so the same thing that lands a change has to decide where that change runs next. A CI gate cannot do this. CI judges a published image, and by then every node already runs the change from git. A regression that CI catches has already reached the fleet.

## What Changes

- **Two refs per repository: `dev` (where landings go) and `fleet` (what most nodes run).** Landings keep pushing to `dev` exactly as today. `fleet` only ever fast-forwards, and only to a `dev` revision that passed verification.
- **Every node declares an update channel: `SUBSTRATE_UPDATE_CHANNEL`.** It's an install input, set in `.env`, carried by the installer and reported by `substrate-status`. It has three values:
  - `canary`: converge to `dev`. These nodes run a change first.
  - `fleet`, the default: converge to `fleet`.
  - `hold`: converge to nothing. The node keeps what it runs and reports how far behind it is.
- **Advancing is an activity the substrate runs, not a human step and not CI.** On a canary node, after it converges to a `dev` revision, the activity waits a settle window, then judges the change across the live constellation:
  - the canary's own `substrate-status` levels;
  - a known-answer goal dispatched from the canary that reaches across nodes;
  - no new failure class in the canary's journal compared with before the change.

  If all of that passes, it fast-forwards `fleet` to that revision in each repository it covered, and writes the verdict as a trace. If it fails, it files a gap that names the revision and its evidence, and `fleet` does not move.
- **A landing node's clones stay on `dev`, whatever its channel.** `vessel-mitosis-cutover` builds commits on the clone's HEAD and pushes them to `origin dev`, so clones that converged to `fleet` would build landings on the wrong base. On non-canary nodes, pull-sync keeps two trees per vessel (`design.md`): the push clone on `dev` for developing, grounding and closure, and a runtime source at the channel's ref that is the only thing mirrored into `/vessels`. Every runtime comparison (skip, last-good, revert) moves to the runtime source.
- **The human interface is one value.** Changing a node's channel is a single `.env` line followed by the install command. `substrate-status` shows the channel, the revision the node runs, the head of the channel's ref, and the gap between them.

## What This Does Not Change

- The autonomy criterion is unchanged: a substrate-authored commit on `origin/dev` still counts the moment it lands. Advancing to `fleet` is a separate, later fact.
- CI install acceptance stays as an outside witness on published images. If it ever catches something advancing let through, that's a gap in the advancing check.
- Constellations the live network does not have (no hub, half a vessel set) are out of scope here. They need sandboxed fleets, which is a separate decision (see `design.md`).

## Prior Attempts, and What Differs

| Attempt | Why it did not hold |
|---|---|
| `2026-05-23-substrate-self-deployment` (canary regressions, `revert-self-deployed-change`) | 0 of 36 tasks. Its safety was a post-merge revert. REALIGNMENT §7 (R1-12) counts it among five unbuilt revert specifications, superseded by contained-self-development 8.3/8.4. |
| contained-self-development 8.3/8.4 (settlement-triggered lane revert) | The carried revert path. Still a revert *after* every node runs the change. |
| `self_fact_reconcile` (development-vessel) | Already a canary-shaped positive control: it checks a live fact on a node after convergence. It judges facts, not deployments. Advancing reuses this pattern as its §2.1 rows rather than minting a new judge. |
| Post-land suite, pull-sync `TEST REGRESSION` | Per-commit test evidence after landing. They run on every node at once, so they detect a regression only once it is everywhere; their output never reached settlement (REALIGNMENT §7). Advancing keeps them on canaries, where a regression stays local. |

What differs: nothing here reverts. A change reaches `fleet` nodes only after it is judged on canaries, so the default for a bad change is "it never left the canaries", not "it is undone everywhere". This complements 8.3/8.4 rather than replacing it: revert still matters for a change that passed the canary judgement and was wrong anyway.

Naming: "advance" is used for moving the `fleet` ref, because "promotion" already means the pushPolicy's evidence-cited widening of landing scope (`gen-env.sh`, `pushPolicy.promotion`).

## Impact

- `scripts/substrate/gen-env.sh`, `docker-compose.yml` (manifest input), `substrate-install.sh` and `substrate-status.sh`: the channel input and its reporting (deployment lane).
- `scripts/substrate/substrate-pull-sync.sh`: converge `/vessels` to the channel's ref while keeping push clones on `dev`. This is the coordinator's file.
- development-vessel: a `fleet_advance` activity and its producer shape (code; goes through the landing path).
- Git remotes: a `fleet` branch per repository, created once at `dev`'s current head. That's an outward action, done once with the user's approval.
