## Why

One development-vessel composes for every repo in the fleet and is also the repo it
edits most, so a large share of its landings are landings on itself; each one restarts
the composer and interrupts every other compose it had in flight, while the global
`change_window` lease serialises the rest. The composer is a single node in a system
designed to be distributed: discovery already merges peer producers and honours an
owner pin, but nothing declares which node owns which repo, so a second composer would
race the first to the same `origin/dev`. This change gives repo ownership a runtime
observable, routes composes to the owner, and separates the composer from the repos it
lands so a self-landing on one node never drains the other.

## What Changes

- **Ownership is the push-clone set.** A node owns exactly the repos for which it holds
  a push clone under the mitosis clone directory (`CLONE_DIR` in `setup-git-push.sh`,
  selected at boot by `SUBSTRATE_PUSH_VESSELS`). No new store: the observable already
  exists, is bootstrap-tier by definition (identity of a node), and the picker reads it
  at use time. `gap-to-feature`'s admission SHALL skip a gap whose target vessel has no
  push clone on this node, discriminating on the clone directory and not on
  `vesselDirExists`, which reads the image layer and is true on every node.
- **Ownership is a shape.** development-vessel SHALL serve `composeOwnership`
  (`{ node, owned_repos }`), advertised through discovery like any shape. goal-host's
  early edit-intent path SHALL resolve it on each `feature_compose` row when more than
  one exists and choose the producer whose `owned_repos` contains the edit target's
  vessel, falling back to `pickSatisfierProducer`'s existing order when no row claims it.
  (Discovery's row projection is not changed: discovery-vessel is protected from
  autonomous cutovers.)
- **Attempts record the node.** `registerAttempt` SHALL stamp `attemptIntent` with the
  composing node's substrate name, and a check the node cannot observe (a target vessel
  that does not run on it) SHALL settle `unknown` with a detail naming the reason, never
  `pass`.
- **A second compute node.** Operator tier: bring up a `compute`-profile container in the
  same org as a discovery peer of the existing node (not a direct registrant: the
  development-vessel unit hardcodes `VESSEL_ID`, and a direct registration would
  overwrite the first node's row), peered to the same hub, with
  `SUBSTRATE_PUSH_VESSELS` naming the repos it owns — the most-edited repos,
  including development-vessel itself, so the first node's composer never lands on its
  own code through its own cutover.
- **A detector for the class.** A scheduled sweep SHALL count composer restarts whose
  attribution is a cutover on a repo the node does not own, or that drained a compose for
  a repo it does not own, and file a gap when the count is non-zero.

## Capabilities

### New Capabilities
- `compose-ownership`: which node composes and lands for which repo, read from the push
  clone set at pick time.
- `owner-pinned-compose-routing`: goal-host and discovery route an edit-intent compose to
  the owning node.
- `attempt-node-attribution`: the causal attempt ledger records the composing node and
  settles unobservable checks honestly.
- `composer-interruption-detector`: a sweep that files a gap when a composer restart
  interrupts work it did not own.

### Modified Capabilities

(none — `openspec/specs/` holds no prior capability for these behaviours)

## Impact

- `repos/development-vessel/src/resolvers/gap-to-feature.ts` (`admitActionableGaps`,
  `identifyVessel`), `repos/goal-host-vessel/src/index.ts` (early edit-intent producer
  choice), `repos/development-vessel/src/resolvers/attempt-register.ts`
  (`registerAttempt`), `repos/development-vessel/src/resolvers/attempt-checks.ts`
  (`evaluateChecks`), `repos/development-vessel/src/routes/impulses.ts` and `src/config.ts`
  (`composeOwnership`), one new sweep resolver in development-vessel.
- Operator tier: `scripts/substrate/setup-git-push.sh` is unchanged (it already reads
  `SUBSTRATE_PUSH_VESSELS`); a second container's `.env`; README § Installation is the
  only source of launch commands.
- Shapes consumed: `vesselCapability`, `composeOwnership`,
  `goal`, `substrateGap`. Shapes produced: `attemptIntent` (new `node` field),
  `composerInterruptionReport`, `substrateGap_write`.
- Precondition: the resumable-landings change's age-deferred pull-sync restart, so that a
  composer's own code update (arriving by pull-sync, not by its cutover) parks or finishes
  in-flight composes before restarting.
- Falsifier for the change as a whole: with both nodes up, land a change to the first
  node's development-vessel while the second node has a compose in flight; the second
  node's compose completes and pushes, and its restart-attribution log shows no entry
  from the first node's cutover. Negative control before the change: the same experiment
  on one node drains the in-flight compose.
