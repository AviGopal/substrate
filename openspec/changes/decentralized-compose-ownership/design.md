## Context

A landing is a pipeline in one development-vessel process: pick → draft → verify →
semantic gate → cutover (commit, push, self-restart when the landed repo is its own).
That process serves `feature_compose` for every repo, and its own repo is the one it
lands most, so its cutovers restart the process that holds every other compose. The
evidence for the numbers behind this design is in
`validation/reports/acceleration-baseline/COMPOSER-SELF-RESTART-2026-09-24.md`: nearly
every composer restart in the measured window was its own cutover, most landings targeted
its own repo, and both autonomous lane slots were busy when it restarted.

Three mechanisms already exist and are reused rather than minted:

- **Peer discovery.** `forwardToPeers` in discovery-vessel merges producers from
  `PEER_DISCOVERY_ENDPOINTS`; `PEER_FANOUT_MODE` defaults to `union`, so a remote
  producer is merged even when a local one exists. Peer rows are qualified
  `<vesselId>@<substrate>`, so two nodes' development-vessels do not collide as long as
  the nodes have distinct substrate names.
- **Transport ingress.** A remote row's `endpoint` is the local federation transport's
  HTTP ingress, dialled over libp2p; goal-host's plain `fetch` in the edit-intent path
  reaches it without change.
- **Owner pin.** `pickSatisfierProducer` (goal-host) filters to rows whose
  `distribution_policy` is `stateful_data_owner_pin` before scoring, and discovery echoes
  that field from the registration (`distribution_policy` in discovery-vessel
  `registry.ts`).

What does not exist: any statement of which node owns which repo, a picker that respects
it, a producer choice keyed on the edit target, and a ledger that knows which node
observed a check.

## Goals / Non-Goals

**Goals:** a composer's self-landing never interrupts another node's composes; two
composers never push the same repo; every attempt names the node that made it; the class
(composer restart draining foreign work) is detected without an operator.

**Non-Goals:** cross-node check routing (a node snapshots only what runs on it — see
Decisions); changing the compose cap, the drafter, or the cutover; zero-downtime
replacement of a composer; changing how the causal-attempt-ledger acceptance harness
runs (it stays single-node until check routing exists).

## Decisions

**Ownership = push clone presence, not a new shape.** The mitosis push clones under
`CLONE_DIR` are created at boot from `SUBSTRATE_PUSH_VESSELS`. A node that holds a push
clone for a repo can land it; one that does not cannot. Reading that directory at pick
time is law-3 reuse: the observable already exists, is per-node by construction, and is
bootstrap-tier (a node's identity) rather than a behavioural env var. Alternative
considered: a `composeOwnership` impulse in the pool — rejected because it would be a
second source of truth that can disagree with the clone set, and the clone set is what
actually decides whether a push can succeed.

**Ownership is the declared push set, intersected with the clones present.** The first
design used clone presence alone. That conflates two roles of one directory: the push clones
are also where `substrate-pull-sync` converges each live vessel from, so a node that removed
a clone to stop owning a repo would also stop receiving that repo's updates, including the
ones the owning node lands. `ownedVessels()` therefore reads `SUBSTRATE_PUSH_VESSELS` (a
boot-time placement fact, carried by gen-env and the manifest) and owns the declared repos it
also has a clone for; when the setting is absent it falls back to every present clone, so a
single node is unchanged. A node keeps clones it does not own, for pulling.

**Ownership gates autonomous picks, not directed work.** `ownedVessels()` is consulted only by
the picker's admission (the auto-pick branch of `gap_to_feature`), the `composeOwnership` shape
and the interruption sweep. A targeted `gap_id` dispatch bypasses admission by design, and an
edit-intent goal from goal-host goes straight to `feature_compose`, which does not consult
ownership; the cutover and push scope do not either. So until directed work is routed to the
owner (4.5), a non-owning node still lands directed composes for a repo it does not own, and two
nodes can land the same repo; the cutover's freshness gate is the only guard in that window.

**Discriminate on the clone directory, never on the image layer.** `vesselDirExists` in
`gap-to-feature.ts` checks the runtime source tree, which the image ships on every node;
it says "this vessel's source exists here", not "this node owns it". The admission check
reads `CLONE_DIR/<vessel>/.git`.

**Pin plus attribute, not pin alone.** `pickSatisfierProducer` pins all owner rows and
then scores; with two owner rows it would pick by priority, not by repo. The edit-intent
path in goal-host therefore reads `owned_repos` on each row and selects the one that
claims the edit target's vessel; only when no row claims it does the existing pick apply.
Alternative considered: one owner row per repo (register `feature_compose:<repo>`) —
rejected because it multiplies registry rows and the walk's shape vocabulary for a
routing concern.

**Which repos the second node owns.** The most-edited repos, including
development-vessel itself, so that the first node's composer never restarts through its
own cutover. The second node's composer does still restart itself when it lands
development-vessel — the cutover restarts the local vessel it landed — but that restart
interrupts only the second node's lane, whose other work is limited to the repos it
owns, and parking bounds what is lost. The first node receives the same code through
pull-sync's age-deferred path (resumable-landings 2.2), which waits out its in-flight
composes instead of draining them. Ownership is changed by editing
`SUBSTRATE_PUSH_VESSELS` and rebooting that node; the picker and the discovery row
follow the clone set at use time.

**The second node is a peer, not a direct registrant.** The development-vessel unit
hardcodes `VESSEL_ID=development-vessel-local`, and the registry keys rows by `vesselId`;
a second node that registered straight into the first node's discovery
(`DISCOVERY_ENDPOINT` pointing at it, the spoke contract) would overwrite the first
node's composer row. The verified path is peering: the second node runs
`PROFILE=compute`, which includes its own discovery and federation transport; the
transport mirrors its vessels to peers as `<vesselId>@<name>`, which the registry's
duplicate check treats as distinct base names behind one peer. Each node lists the other
in `PEER_DISCOVERY_ENDPOINTS` alongside the hub the org already joins, shares
`FEDERATION_SIGNING_SECRET` (peer auth is HMAC), and sets `SUBSTRATE_ADVERTISE_HOST` so
its advertised endpoint is non-loopback (a peer row is only merged when it is dialable:
a multiaddr, or a non-loopback endpoint). Shapes the second node does not serve (identity,
traces, models) resolve through its own discovery's peer forwarding to the first node,
which is the same forwarding that already answers `feature_compose` from the hub. The
first node needs no profile change; adding the second node to its
`PEER_DISCOVERY_ENDPOINTS` takes a discovery-vessel restart, because the unit loads that
value from its `EnvironmentFile` at process start (discovery reads `process.env` at use
time, but the environment is fixed until the process restarts).

**Ownership is a shape each composer serves, not a field on the discovery row.**
The first design echoed `owned_repos` through discovery's `vesselCapability`
projection. That cannot land autonomously: discovery-vessel and identity-vessel are in
`PROTECTED_VESSELS` in `vessel-mitosis-cutover.ts`, and every cutover on them is refused
unconditionally (the routing fixed point and the auth validator change only through an
authorized operator path). Instead development-vessel serves a `composeOwnership` shape
(`{ node, owned_repos }`, read from the clone set at use time), advertised like any other
shape so it resolves through the federation transport for remote rows. goal-host's
edit-intent path resolves it on each `feature_compose` row when there is more than one
row, with a short timeout, and routes to the single claimant. With one row nothing is
fetched. This is law 1 (behaviour steered by a shape read at use time) and needs no
registration-level `distribution_policy` pin, which would have pinned every shape
development-vessel serves. Cost: one extra resolve per candidate row per edit goal.

**Check locality is recorded, not faked.** `evaluateChecks` runs `systemd_units` in
process via `resolveSystemdUnitHealthObserver`; no vessel serves it as a routable shape.
A composer landing a repo whose vessel does not run on its node cannot observe that
vessel's units. It records the check `unknown` with detail `target not resident on
<node>` and the settlement is `unresolved` for that check — honest and cheap. Routing
the check to the target's node is follow-up work and is why the acceptance harness stays
single-node.

**Detector reads attribution, not restarts.** The vessel already writes a
restart-attribution line naming the requester and what was in flight. The sweep pairs
that with the clone set: a cutover on a repo the node does not own, or a drained compose
whose target the node does not own, is the class. A restart count alone would flag
ordinary self-updates.

**What moves with a repo's ownership.** Two things key on a repo's clone path on its
owning node. The causal attempt ledger records `attemptIntent.repo` as the clone path (for
example `/workspace/git/vessels/development-vessel`), and the landing hook records the repo
top level, so when a repo's clone leaves a node, that node's later landings on other repos
are unaffected, and landings on the moved repo appear under the owning node's path, with
per-repo aggregates such as unaccounted landings starting fresh there. Any harness or check
that reads a repo's landings (the ledger's graded runs land a canary fixture in
development-vessel) must run against the owning node's clone. Moving development-vessel to
the second node therefore moves where those checks run.

**What does not move: selection state.** Rhythm registries, rhythm posteriors, boredom
queues and operator pauses (`operator_pause` records) live in each node's own volumes,
and nothing replicates them. A pause or a re-baseline written on one node does not exist
on another: a second node keeps draining a rhythm the first node paused, and credits it
with its own un-rebaselined posterior. Until selection state is a shared or forwarded
shape the way the gap store is (4.0d), an operator pause is node-local, so pausing
across the network means writing it on every node.

**The shared gap store has no cross-node claim.** Admission and compose slots are
per-node. Two nodes can take the same gap from the one store at the same time: the
owner through an autonomous pick, and any node through a directed `pointer.gap_id`
compose, which bypasses the ownership filter by design. This has been observed: the
owner picked a gap and failed its baseline, and 2.5 minutes later the other node
composed the same gap as directed work and landed it on a repo it does not own. If both
had passed, the freshness gate would have refused or rebased the second push, so
nothing would have been clobbered, but one compose's work would have been wasted. Directed gap work is now placed on the owner (task 4.6): a node forwards a targeted gap
whose repo it does not own to the owning node's composer, so both paths into a repo's
gaps end on one node, where compose slots and cooldowns apply. A claim written to the
shared store at admission would still be needed if one repo ever had two owners.

**Routing covers only the early edit-intent path.** Goal-host routes the pre-walk
edit-intent compose by ownership (2.2), but the compose it issues after a walk still goes
to its configured development-vessel. A goal whose early compose ran on the owner can
therefore be composed a second time on the dispatching node. That node's double-compose
guard looks for its own compose report, not the owner's, and has double-applied a
landing. A git probe for the landed commit now covers this, but every compose call site
should route the same way the early route does.

**The pick lease does not gate every autonomous path.** `autonomous_pick` gates the
picker's own passes. The event-driven gap-compose nudge, boredom's pool dispatches and
rhythm drains start work without reading it. With picks held, a node still spends on
floor walks: one siteless gap family cost about $3.8/h through the nudge, and a held
second node kept running pool and rhythm walks. Holding a node therefore means holding
each of these paths, until they read one shaped hold.

**Containment records bind a node only through discovery.** The autonomy scope and the spend
envelope are read as the newest record across every pool producer discovery lists, so a
record written on one node binds both. A complete read that finds no record means no scope
and no cap, and a node remembers having seen a record only until it restarts. A composer
restarts on its own landings, so if the node holding the records ever drops out of its
discovery, it reopens without containment. Until the readers treat a missing peer row as
unreadable, or read from a pinned holder, each composer keeps a copy of both records in its
own pool, and every change is written to every copy.

## Follow-up (not part of this change)

**Per-repo cutover leases.** Maintenance leases are named, but the cutover still takes a
single `cutover` lease covering every repo on a node, so one node cuts over one repo at a
time even when two composes target different repos. Naming it `cutover-<repo>` would let
different repos cut over in parallel; only a landing on the composer's own repo restarts
the composer. Falsifier: two cutovers on different repos overlap in time and both push.
This multiplies throughput within a node, while this change separates nodes. It is
independent and belongs in its own change.

## Risks / Trade-offs

- [Two nodes both hold a clone for the same repo by misconfiguration] → the admission
  check is necessary but not sufficient; the cutover's freshness gate already refuses a
  stale base, so the second push rebases or refuses rather than clobbering. The detector
  files a gap when two nodes' capability rows claim the same repo.
- [The second node's composer restarts on its own development-vessel landings] →
  bounded by parking; measured by the same restart-attribution sweep, split by node.
- [Remote producer reached through the transport is slower or times out] → the
  edit-intent fetch already has `EDIT_INTENT_COMPOSE_TIMEOUT_MS`; the falsifier includes
  a timing row so a regression is visible.
- [Ledger attempts from the second node settle `unresolved` on `systemd_units` for
  hub-only vessels] → by design; the second node owns repos whose vessels it also runs,
  so the common case is observable.
- [A falsifier that moves a push clone aside breaks every reader of that directory on
  the node — the cutover's push, and any acceptance harness reading landings from it] →
  run clone-mutating falsifiers only on the second node, or against a scratch
  `VESSELS_CLONE_ROOT`; never on the first node while anything reads its clones.
- [`journalctl`/`systemctl` from inside the vessel process returning nothing on a
  permission failure would read as a quiet hour or a resident target] → the sweep
  reports `lines_read` so empty ≠ quiet, and the non-resident check reuses the access
  path `resolveSystemdUnitHealthObserver` already exercises (`Bun.spawn` of `systemctl
  show`), which is proven to return data on the node.
- [Recreating or restarting the first node loses operator drop-ins and interrupts the
  causal-attempt-ledger acceptance sequence] → nothing in this change touches the first
  node until that sequence has finished; the first node's only change is a config edit
  that takes effect at its next planned boot.

## Migration Plan

1. Land the picker admission and discovery-row tasks on the existing node; with a single
   node owning everything they are no-ops (verified by the negative control).
2. Land the goal-host producer choice; with one owner row it selects as before.
2a. Land `composeOwnership` (serve, advertise) and the per-row resolve in goal-host.
3. Land the ledger node stamp and the `unknown`-on-non-resident rule.
4. Bring up the second node as a peer with `SUBSTRATE_PUSH_VESSELS` for its repos.
   **Accepted transition state:** until the first node's next planned boot both nodes
   hold clones for those repos, so both rows claim them; the duplicate-owner gap is
   expected and is the check that its detection works, and routing keeps preferring the
   first node (local row scores higher), so no directed compose reaches the second node
   yet. The window is bounded by that boot, which is scheduled after any acceptance
   sequence running on the first node has finished (its harness reads the first node's
   clone directory).
5. At that boot remove the repos from the first node's `SUBSTRATE_PUSH_VESSELS`; the
   duplicate-owner gap closes on its next check. Run the change-level falsifier; then
   land the detector and let it run a day.

Rollback: stop the second node; restore the first node's `SUBSTRATE_PUSH_VESSELS`. The
code changes are inert with one owner.
