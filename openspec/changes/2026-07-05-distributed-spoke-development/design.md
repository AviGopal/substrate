# Design: distributed spoke development

## The observed state (2026-07-05, hub `138.197.116.56`)

Discovery `registry/stats`: 6 live vessels, all healthy, **all registered with loopback endpoints**:

| vessel | shapes | serves (execution-path) |
|---|---|---|
| activity-api-local (`127.0.0.1:8080`) | 56 | trace store, Thompson, oracle — the shared brain |
| development-vessel-local (`localhost:8090`) | 198 | `fs_read/fs_write/fs_edit/patch_with_tools/http_fetch`, `feature_compose` |
| llm-resolver-vessel (`127.0.0.1:8220`) | 2 | `llm_completion` |
| concept-db-local (`127.0.0.1:8260`) | 16 | concept graph |
| goal-host-vessel (`127.0.0.1:8210`) | 2 | `goal_execution` |
| ribosome-vessel (`127.0.0.1:8240`) | 0 | template extraction (WS client) |

`vesselCapability shellResult` → **0 producers** (stable). local-tools-vessel is absent. Only `:18080` (activity-api), `:18100` (discovery), `:18210` (goal-host) are externally mapped; dev-vessel / llm-resolver / concept-db / local-tools are loopback-only.

Result: every edit-intent dispatch dies with `endpoint discovery failed (llm=true, tools=false)`. Non-edit resolve/satisfier goals reach fine (`advertised_shape_coverage_scan` reached=True). So the **brain is healthy; the self-edit body is missing its tool belt.**

## Why local-tools, not dev-vessel, is the tool belt

`feature_compose` (`repos/development-vessel/src/resolvers/feature-compose.ts`):
- L1033: `const toolsEndpoint = await discover("shellResult")` — single endpoint for shell **and** all fs ops.
- L851/L863/L1122/L1148/L1223…: reads `callTool(...).body.stdout`, `.body.content` — i.e. the tool's HTTP response has `stdout`/`content` at top level. That is **local-tools' flat format** (`{shape, stdout, exit_code, content}`).
- dev-vessel's `/v2/impulses/resolve` returns `{success, shape, body:{...}}` (`src/routes/impulses.ts:826`). `.body.stdout` = undefined against dev-vessel. Its `fs_read` is likewise nested.

So dev-vessel serving `shellResult` in its native envelope would still fail feature_compose's parser, and its fs resolvers already don't match. The correct, lowest-risk unblock is to **run local-tools-vessel** — the canonical flat shell+fs surface feature_compose was written against — co-located with feature_compose.

**The self-edit spoke bundle:** `goal-host` (dispatch) + `dev-vessel` (feature_compose + gap loop) + `local-tools` (tool belt) + a reachable `llm_completion`. A spoke advertising `feature_compose` without this bundle is an incomplete composition.

## Deploy / cutover deadlock

`vessel-mitosis-cutover.ts`: hard-resets a push clone to `origin/dev` (best-effort `git fetch`, "in-container this may fail"), applies mitosis-staged files, `git push origin dev`, mirrors staged files → local `/vessels/<v>`, restarts the local unit. Two properties matter here:
1. It converges only the **local** runtime — no path to a runtime on another machine.
2. It is **initiated by feature_compose** landing a change. feature_compose is down ⇒ no cutover can be triggered to restore it. Only operator host access (or an out-of-band pull) breaks the loop.

Pull-from-upstream mode closes both: the running location owns a "pull `origin/dev` + restart my unit + score via `interface_deploy_reach_check`" step it can execute on a deploy signal, independent of whether an editor is co-located. This is a generalization of the existing best-effort `fetch origin/dev`, promoted from a pre-step of the local cutover to a first-class convergence mode a remote runtime performs on itself. obsidian-vessel's host-mount deploy is the existing "converge by an alternate mechanism" precedent.

## Invariant, expressed as detection (no manifest)

`advertised_shape_coverage_scan` already enumerates consumed shapes with no live producer on a machine. Extend its consumer set so that a spoke advertising `feature_compose` is checked for the self-edit bundle's shapes (`shellResult`, `fs_*`, `patch_with_tools`, `llm_completion`). A violation files a `substrateGap` naming the missing producer and the spoke — the same class that already drives the gap→feature loop. Differences between spokes stay expressed as advertised-shape differences a detector reads, never a per-host manifest an operator keeps.

## Boundaries

- **Reachability**: consumed from discovery registration per `2026-07-04-single-transport-story`; this change does not re-specify transport. Cross-machine resolves ride the federation egress (goal-host `peerEndpoint` / `libp2p_multiaddr`), never loopback.
- **One brain**: all spokes write traces, Thompson α/β, and `goal_verification_labels` to the hub. A spoke never runs its own activity-api.
- **Ownership**: each spoke scoped to the vessels it owns (or branch/worktree isolation) so inter-spoke pushes to `origin/dev` don't race. Intra-spoke contention already covered by the BUSY guard + durable dispatch records.

## Verification

- Coverage detector flags a `feature_compose` spoke missing `shellResult` as a filed gap (reproduce on the current hub; it should name local-tools).
- With local-tools co-deployed, an edit-intent dispatch passes endpoint discovery and reaches the drafter (re-run the 2026-07-05 four-capability tutoring set — currently untestable upstream).
- A pull-from-upstream cutover converges a vessel on a second location and is scored `healthy` by `interface_deploy_reach_check`; a regressed deploy rolls back with a β-penalty.
