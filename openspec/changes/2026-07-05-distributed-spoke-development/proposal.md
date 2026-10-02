# Distributed spoke development: any spoke can develop, cutover works across locations

## Why

The fleet is splitting into **one hub (the shared brain)** and **many spokes (execution bodies)**. The hub owns what must be shared so learning compounds into one posterior — the trace store + Thompson learner (activity-api), the discovery fixed point, concept-db, the oracle corpus. A spoke owns stateless execution — goal-host, dev-vessel, local-tools, llm-resolver. The goal: **develop from any connected vessel that carries the self-edit body**, with the pieces it doesn't hold resolved elsewhere through discovery. Not all development in one place.

Two structural gaps block that today, both observed live on the hub (2026-07-05):

1. **A spoke is not self-sufficient for its own execution path.** The hub currently runs a 6-vessel fleet with **no producer for `shellResult`** (local-tools-vessel not deployed). `feature_compose` — the self-edit body — discovers its single tool endpoint via `discover("shellResult")` and parses every result in local-tools' flat response shape (`callTool(...).body.stdout` / `.body.content`). With zero producers it hard-fails at endpoint discovery (`tools=false`) on *every* edit-intent goal, before drafting. Pointing it at dev-vessel does not help: dev-vessel returns `{success, shape, body}`, not the flat shape feature_compose reads. **`local-tools` is location-stateful — it edits the very checkout being developed — so it must be co-located with `feature_compose` on any location that develops (and only there, not everywhere).**

2. **There is no cross-location cutover.** The mitosis cutover (`repos/development-vessel/src/resolvers/vessel-mitosis-cutover.ts`) commits→pushes `origin/dev`→mirrors staged files into the local `/vessels/<v>` runtime→restarts the local systemd unit. It only converges a vessel **on the same machine as the editor**, and it is *initiated by* `feature_compose` landing a change — so when feature_compose is down (gap 1), nothing can deploy the fix for it either (a bootstrap deadlock). A vessel running where it cannot be edited via feature_compose has no convergence path except operator host access. obsidian-vessel already shows the alternate: it is deployed by **host mount**, not by in-place authoring.

The transport half of "route everything through discovery" is already an active slice — see [`2026-07-04-single-transport-story`](../2026-07-04-single-transport-story/proposal.md) (discovery registration is the single reachability description; loopback is the degenerate case). This change is the **development-and-deploy** half: spoke self-sufficiency for the execution path, and a cutover that converges a vessel wherever it runs.

## What changes (idiomatic under existing primitives — no new tiers)

1. **Placement follows data locality — the existing "resolvers live where data lives" principle made precise — NOT "everything everywhere."** Where a resolver must run, and what duplicating it *means*, is fixed by where its data lives:
   - **location-stateful** — output bound to state local to the machine: `local-tools` (edits *this* location's repo checkout), `obsidian` (this vault). MUST run where that state is; a second copy serves *different content*, not a replica.
   - **location-independent (stateless)** — output is a pure function of the request: `llm_completion`. Runs anywhere, resolved via discovery; a second copy is a load-balanced *replica* of the same content. A development location needs one **reachable**, not a local one.
   - **shared singleton** — state that must converge to one place: the trace store + Thompson posterior + oracle (activity-api). Exactly one, on the hub; a second forks the brain.
   - **both** — e.g. a warm-cache resolver (stateless contract, benefits from local state): placement optimises for locality, duplication still means replicas.

   A location is **development-capable** iff it locally runs the resolvers whose data is local to *its* development — `feature_compose` **and** `local-tools` on the same checkout (`local-tools` is location-stateful: it edits the files that checkout holds). `llm_completion` need only be reachable, not local. When a development-capable location lacks a *location-stateful* producer its execution path needs, that is a producer-less-consumed-shape gap the existing `advertised_shape_coverage_scan` detector files — "which location has what" is advertised-shape differences a detector reads, never an operator manifest. The concrete instance now: the hub advertises `feature_compose` but has no local `local-tools` → restore it there (and only there — not on every location).

2. **Cutover converges a vessel wherever it runs — two deploy modes, one reach-gate.**
   - **Self-edit-in-place** (editor spoke owns the vessel repo + runtime): today's mitosis cutover, unchanged.
   - **Pull-from-upstream** (the vessel runs where feature_compose cannot edit it): landing a change is "push to `origin/dev`"; convergence is the running location **pulling `origin/dev` + restarting its unit**, driven by a deploy signal rather than local file-mirroring. obsidian-vessel's host-mount deploy is the precedent for "converge by an alternate mechanism."
   - Both modes end at the same gate: `interface_deploy_reach_check` scores the post-deploy vessel `healthy | unscored_absent | regressed`, with rollback+β on regression. A cutover is "done" only when scored, never when the unit merely restarts.

3. **Cross-spoke repo ownership prevents shared-branch races.** Intra-spoke contention is already handled (compose-lock BUSY guard + durable dispatch records with honest interruption). Inter-spoke contention on the *same* repo/branch is not: two spokes editing the same vessel and pushing `origin/dev` collide. Each spoke is scoped to the vessels it owns (or works in branch/worktree isolation), so two spokes never race the same compose lock and branch.

## Non-goals

- **Not "everything everywhere."** Location-independent resolvers (`llm_completion`) are resolved via discovery, not replicated onto every location; only location-stateful producers (`local-tools` on the checkout it edits) must be co-located, and the shared singleton (activity-api) stays single. Uniform full replication erases the hub/spoke distinction. Not every location is development-capable, and that is the point.
- Not implementing the libp2p overlay or removing loopback defaults — that is [`2026-07-04-single-transport-story`](../2026-07-04-single-transport-story/proposal.md). This change assumes reachability is described by discovery registration and consumes it.
- Not rewriting feature_compose's result-parsing to speak dev-vessel's `{success, shape, body}` envelope. The tool belt is local-tools; co-deploy it. (Unifying the resolver response envelope fleet-wide is a separate slice if ever wanted.)
- No change to the host contract: a spoke is still `docker run <image>` + env + volumes; which units a spoke enables is its composition, read back through discovery.
- Not a new auth/identity scheme: cross-location convergence rides the existing federation-transport / discovery reachability.
