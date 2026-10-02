## Context

A compose is judged by several readers that need the *current* text of the target file:
the anchor supplier (to offer verified-unique locators), the vacuous gate's reference
check, the non-termination and dead-store simulations, and the co-located test finder.
The edit itself is applied in the push clone. Two roots exist on the box:

| root | what it holds | who advances it |
|---|---|---|
| `/workspace/git/vessels/<v>` (push clone) | the vessel at its own HEAD, where composes apply and cutovers push | every cutover |
| `/workspace/git/super-repo/repos/<v>` (submodule checkout) | the vessel at the gitlink the super-repo last recorded | operator pull-sync only |

The readers use the second root. A gate that reads a file the edit was not applied to is
a gate on a different program; whether it fails open or closed is incidental.

## Goals / Non-Goals

Goals: every compose reader sees the file the plan is applied to; the super-repo's view
of a vessel follows the vessel's pushes without an operator; a vessel owes at most one
restart at a time; refusals the lane cannot learn from become refusals it can.

Non-goals: moving the restart script out of a template literal (a separate change if the
anchor supplier, once engaged, still cannot land on that file); changing the vacuous,
non-termination or dead-store rules themselves; zero-downtime restarts.

## Decisions

- **Clone wins, super-repo falls back.** `targetFileOnDisk(tf)` returns the clone path
  when it exists, else the super-repo path. In-tree vessels (human-surface, clock,
  relevance-sink) have no clone and keep working unchanged. The helper landed
  function-scoped inside `resolveFeatureComposeUncapped`; all four read sites are inside
  that function, so no hoist is required.
- **Gitlink advance is part of the cutover, not a timer.** The cutover already knows the
  pushed sha and the vessel name; a timer would reintroduce the lag it removes. The
  advance is `git -C super-repo update-index --cacheinfo 160000,<sha>,repos/<v>` plus a
  commit and push under the substrate identity, recorded in the cutover's operations,
  and refused (not retried) when the super-repo working tree is dirty.
- **Owed-restart check reads systemd, not a marker file.** The truth about a pending
  restart is the transient unit; marker files have already been observed to lie (a slot
  file is not a held slot). `systemctl list-units --all --plain --no-legend
  mitosis-self-restart-*` is the source; any error means "not owed" so the caller
  schedules as today (fail open toward the current behaviour).
- **The call site is the command array, not the result.** Skipping the spawn is done by
  substituting the command (`_owedBy ? ["/bin/true"] : [sysdRun, …]`) so `proc` keeps its
  type and the existing `exitCode`/`stderr` reads compile unchanged.

## Risks / Trade-offs

- The gitlink commit is a super-repo commit authored by the substrate on every vessel
  landing; noisy, but every one is attributable and reversible. Batching would
  reintroduce lag.
- Coalescing means the second landing's code waits for the first unit's quiesce; the
  first unit restarts the vessel onto the clone's HEAD, which already includes the
  second landing, so nothing is lost.
- Until the anchor supplier engages on `vessel-mitosis-cutover.ts`, the restart-coalescing
  edit is the hardest landing here; it is sequenced after the reader fix for that reason.

## Open Questions

- Whether the anchor supplier, once fed the clone, produces usable anchors for a sixty-line
  quoted script. The falsifier on task 1.2 answers it either way.
