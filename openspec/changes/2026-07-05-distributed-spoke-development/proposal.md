# Distributed spoke development: any spoke can develop, cutover works across locations

## Why

The fleet is splitting into **one hub (the shared brain)** and **many spokes (execution bodies)**. The hub owns what must be shared so learning compounds into one posterior — the trace store + Thompson learner (activity-api), the discovery fixed point, concept-db, the oracle corpus. A spoke owns stateless execution — goal-host, dev-vessel, local-tools, llm-resolver. The goal: **develop from any connected vessel that carries the self-edit body**, with the pieces it doesn't hold resolved elsewhere through discovery. Not all development in one place.

Two structural gaps block that today, both observed live on the hub (2026-07-05):

1. **A spoke is not self-sufficient for its own execution path.** The hub currently runs a 6-vessel fleet with **no producer for `shellResult`** (local-tools-vessel not deployed). `feature_compose` — the self-edit body — discovers its single tool endpoint via `discover("shellResult")` and parses every result in local-tools' flat response shape (`callTool(...).body.stdout` / `.body.content`). With zero producers it hard-fails at endpoint discovery (`tools=false`) on *every* edit-intent goal, before drafting. Pointing it at dev-vessel does not help: dev-vessel returns `{success, shape, body}`, not the flat shape feature_compose reads. **The self-edit body's tool belt (local-tools' flat shell+fs surface) must be co-deployed with feature_compose on any spoke that develops.**

2. **There is no cross-location cutover.** The mitosis cutover (`repos/development-vessel/src/resolvers/vessel-mitosis-cutover.ts`) commits→pushes `origin/dev`→mirrors staged files into the local `/vessels/<v>` runtime→restarts the local systemd unit. It only converges a vessel **on the same machine as the editor**, and it is *initiated by* `feature_compose` landing a change — so when feature_compose is down (gap 1), nothing can deploy the fix for it either (a bootstrap deadlock). A vessel running where it cannot be edited via feature_compose has no convergence path except operator host access. obsidian-vessel already shows the alternate: it is deployed by **host mount**, not by in-place authoring.

The transport half of "route everything through discovery" is already an active slice — see [`2026-07-04-single-transport-story`](../2026-07-04-single-transport-story/proposal.md) (discovery registration is the single reachability description; loopback is the degenerate case). This change is the **development-and-deploy** half: spoke self-sufficiency for the execution path, and a cutover that converges a vessel wherever it runs.

## What changes (idiomatic under existing primitives — no new tiers)

1. **Spoke self-sufficiency is a coverage invariant, not a manifest.** A spoke that advertises `feature_compose` MUST have a live local producer for every shape its execution path consumes — `shellResult` + the `fs_*` / `patch_with_tools` family (local-tools' flat surface) and a reachable `llm_completion`. When it does not, that is exactly a producer-less-consumed-shape gap: the existing `advertised_shape_coverage_scan` detector flags it and files a `substrateGap`. "Which spoke has what" is never an operator-maintained list — it is advertised-shape differences the detector reads. The concrete instance now: restore local-tools-vessel on the hub.

2. **Cutover converges a vessel wherever it runs — two deploy modes, one reach-gate.**
   - **Self-edit-in-place** (editor spoke owns the vessel repo + runtime): today's mitosis cutover, unchanged.
   - **Pull-from-upstream** (the vessel runs where feature_compose cannot edit it): landing a change is "push to `origin/dev`"; convergence is the running location **pulling `origin/dev` + restarting its unit**, driven by a deploy signal rather than local file-mirroring. obsidian-vessel's host-mount deploy is the precedent for "converge by an alternate mechanism."
   - Both modes end at the same gate: `interface_deploy_reach_check` scores the post-deploy vessel `healthy | unscored_absent | regressed`, with rollback+β on regression. A cutover is "done" only when scored, never when the unit merely restarts.

3. **Cross-spoke repo ownership prevents shared-branch races.** Intra-spoke contention is already handled (compose-lock BUSY guard + durable dispatch records with honest interruption). Inter-spoke contention on the *same* repo/branch is not: two spokes editing the same vessel and pushing `origin/dev` collide. Each spoke is scoped to the vessels it owns (or works in branch/worktree isolation), so two spokes never race the same compose lock and branch.

## Non-goals

- Not implementing the libp2p overlay or removing loopback defaults — that is [`2026-07-04-single-transport-story`](../2026-07-04-single-transport-story/proposal.md). This change assumes reachability is described by discovery registration and consumes it.
- Not rewriting feature_compose's result-parsing to speak dev-vessel's `{success, shape, body}` envelope. The tool belt is local-tools; co-deploy it. (Unifying the resolver response envelope fleet-wide is a separate slice if ever wanted.)
- No change to the host contract: a spoke is still `docker run <image>` + env + volumes; which units a spoke enables is its composition, read back through discovery.
- Not a new auth/identity scheme: cross-location convergence rides the existing federation-transport / discovery reachability.
