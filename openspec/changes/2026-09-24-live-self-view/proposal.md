## Why

The substrate reasons about a stale copy of itself. A compose applies and stages its
plan in the push clone (`MITOSIS_PUSH_CLONE_DIR`, `/workspace/git/vessels/<vessel>`),
but the gates that judge that plan read the target file through
`REPO_ROOT ?? WORKSPACE_ROOT ?? /workspace/git/super-repo` + `repos/<vessel>/…` — the
super-repo's submodule checkout. Nothing in the loop advances a gitlink after a cutover
pushes, so that checkout ages until an operator runs pull-sync. Measured on 2026-09-24
at 11:35Z: development-vessel's gitlink 100 commits (3 days) behind its clone,
activity-api 22, local-tools 2, goal-host 1, ias-executor 1, all others 0.

What that one fact produced, each measured:

- **A correct one-line edit was refused as vacuous** (11:28Z, 11:30Z): guard 2 of the
  vacuous gate asked whether the bound name is referenced "anywhere in the target file",
  read the stale copy, found zero references, and failed closed. The clone used the name
  on the next line. After `20a668b` re-pointed guard 2 at the clone, the identical op was
  admitted (12:08:42Z).
- **The non-termination and dead-store simulations are inert** on any file that changed
  after the gitlink date: `current.includes(oldS)` is false against the stale copy and
  both skip with "cannot simulate → do not refuse".
- **The verified-unique anchor supplier never engages** on such files: it runs inside the
  block that reads site A. Zero of seven composes on `vessel-mitosis-cutover.ts` since
  10:00Z received supplied anchors; all twelve drafts on that file anchored into a
  sixty-line template literal and broke the build (TS1005/TS1128).
- **Downstream, every landing still schedules its own self-restart**: eleven landings
  produced eighteen restarts, six pairs within sixty seconds; at 12:04Z two
  `mitosis-self-restart-development-vessel-*` units were `active running` at once, both
  polling `/health` for `in_flight == 0` while one compose held the count at 1. For
  that whole window every long-running dispatch was refused as draining.

The consumer-facing symptom that started the trace — a reconcile family sampler that
reported `1 member(s)` for a family of four — turned out to have a second, independent
producer defect (the template list's cached first page was an unordered set sliced
without a sort, `55cd36d`) and is closed; it is recorded here only as the entry point.

## What Changes

- **One target-file resolver for every compose reader.** All readers of a target file
  inside `feature-compose.ts` SHALL resolve `repos/<vessel>/<rest>` through one helper
  that prefers the push clone when it exists and falls back to the super-repo copy (the
  in-tree vessels have no clone). Guard 2 is done (`20a668b`); the anchor-band centring,
  the non-termination/dead-store simulation and the co-located test discovery follow.
- **Gitlink sync is substrate work.** After a cutover pushes a vessel, the super-repo
  gitlink for that vessel SHALL be advanced to the pushed sha, graded by the lag it leaves
  behind. The operator pull-sync script stays as the bootstrap-tier fallback.
- **Owed restarts coalesce.** A cutover SHALL NOT schedule a second self-restart unit
  for a vessel that already has one active or waiting; it records
  `self-restart already owed by <unit>` in its operations instead.
- **Lane hygiene the traces demand.** A scope-stage refusal SHALL record a failure lesson
  (today it records none, so the loop cannot narrow on it); a narrowed or recommit child
  of a spec the judge refuses deterministically SHALL inherit that verdict rather than
  re-run it.

## Capabilities

### New Capabilities
- `target-file-resolution`: compose readers see the file the edit is applied to.
- `gitlink-sync`: the super-repo's view of a vessel follows the vessel's own pushes.
- `restart-coalescing`: at most one owed self-restart per vessel.

### Modified Capabilities
- `lane-hygiene`: scope-stage refusals leave lessons; deterministic refusals propagate to
  children.

## Impact

Files: `repos/development-vessel/src/resolvers/feature-compose.ts` (three read sites),
`repos/development-vessel/src/resolvers/vessel-mitosis-cutover.ts` (restart scheduling
and gitlink advance), `repos/development-vessel/src/resolvers/gap-to-feature.ts`
(lesson on scope refusal, child inheritance). No schema changes. No new endpoints.

Evidence and timestamps: `validation/reports/form-learning/REUSE-AUDIT-AND-APPROACH.md`
(sections from 11:28Z on 2026-09-24) and the gap records named in tasks.md.
