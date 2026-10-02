# Mechanism verdicts: chunk 50 (metric-collector-vessel)

Input: `classes/_mech_chunks/50.json` has one collector item, area `metric-collector-vessel`, from `git-small`.
Verified read-only on 2026-09-29 against node 1 (`substrate-live`) and node 2 (`compose2-live`).

**Deduplication:** nothing to dedupe. The chunk holds only one mechanism.

## Verdict

| Name | Location | Verdict | Used now | Evidence (live) |
|---|---|---|---|---|
| metric-collector-vessel (`metricSample`, `metricSample_write` producer) | `repos/metric-collector-vessel`; live clone `/workspace/git/vessels/metric-collector-vessel` at `6a93e22` | **fossil** (and **broken** as written) | no | See below |

### Evidence

- **The unit is off on both nodes.** On node 1, `metric-collector-vessel.service` is `disabled` and `inactive`, and its journal says `-- No entries --`. On node 2, `systemctl is-active` says `inactive`. The `self-recovery` watchdog reports `NOT INSTALLED: metric-collector-vessel (:8300)` (see `raw/timers-readers.md:30`). The hub registry does not list it (see `raw/vessel-docs-tooling.md:108`). Node 2 has no clone of it at all (see `raw/git-small.md:584`).
- **The resolver is an empty scaffold.** `src/routes/impulses.ts` has one line where the dispatch cases should be: `// TODO: Add cases for ["metricSample", "metricSample_write"]`. Its only branch is `default: return 400 unknown shape`. `src/config.ts` still advertises both shapes to discovery. So if the unit were started, it would advertise two shapes it cannot serve. That is the "advertised shapes == dispatch cases" invariant from `packages/shape-dispatch-check/` (see `raw/memory-5.md:247`). It also explains the earlier waste observation: "metric-collector-vessel 622 heartbeats/0 success" (`raw/memory-6.md:112`, 07-31).
- **Nothing reads its shapes.** `grep -rln metricSample` over `/workspace/git/vessels/*/src` and `super-repo/scripts` finds only the vessel's own `config.ts` and `impulses.ts`, plus the `vessels.manifest.json` description ("Substrate-authored sample collector (metricSample shapes; lift empirical test)"). The `execution` table (about 5 days, 150k-row cap) has no activity touching it. Every `%metric%` activity id belongs to the unrelated `activity_metrics` family, for example `satisfier:activity_metrics` 570 and `auto-bridge-activity_metrics` 121.
- **The only commits since the split are autonomous landings into a dead vessel.** They are `a885631` (08-21, PORT 8280→8300 via mitosis cutover, gap `route-edit-f79ac530`, which fixed the collision with light-dispatch) and `6a93e22` (09-07, "Add bun.lock file"). The gap store has only 4 `auto_draft_decision:cff0cr0v00jd:*` rows for "vessel-code-commit-and-push metric-collector-vessel", all closed by dispatch completion.
- **Why dead code keeps attracting work.** The vessel is still hardcoded as a live, self-editable target in three places:
  - the drafter prompt's vessel list in `development-vessel/src/seed/draft-gap-closing-activity.ts:162` ("ALL self-editable ... metric-collector-vessel");
  - `development-vessel/src/resolvers/activity-create-variant.ts:33`;
  - `goal-host-vessel/src/goal-file-resolution.ts:123`.

  It is also the worked example in three scaffold seeds: `complete-vessel-scaffold.ts:32`, `scaffold-and-publish-vessel.ts:48` and `vessel-repo-promote.ts:47`. So drafters can aim patches at it, and those patches "land" even though no unit runs the code.

  This is the `hollow-landing` / `codebase-bloat-fossils` pattern: a green landing on code with no runtime. The 08-25 operator audit already filed "metric-collector-vessel unmanaged" (`raw/memory-8.md:39`). That gap is not in the live store today. `a885631` "fixed" the vessel's port and nothing else, so the audit's point still stands.
- **Class history.** No class in `classes/*.json` names this vessel as a solution to anything. It was a "lift empirical test" scaffold from 06-15 (`0d694dd`, split from the super-repo), and it never got a resolver body.

### Disposition

- **Fossil.** No reader, no unit, no executions, and an empty dispatch. Nothing else needs a `metricSample` shape. Metrics needs are served elsewhere by the `activity_metrics` family, `autonomy-metrics.timer` and `coherence-metric.timer`. Reviving it would be a duplicate mint under law 3.
- **Where to archive.** Remove the vessel from `scripts/substrate/vessels.manifest.json` and from `scripts/substrate/units/metric-collector-vessel.service`. Drop the `repos/metric-collector-vessel` submodule. Keep the GitHub repo, archived read-only, as the historical record. In the fossil index, record it as "scaffold without dispatch; last SA landings a885631, 6a93e22".
- **Remove it from the editable-target lists** at the three sites above (`draft-gap-closing-activity.ts:162`, `activity-create-variant.ts:33`, `goal-file-resolution.ts:123`). Otherwise drafters keep aiming at it. The long-term fix is to derive these lists from the manifest plus running units instead of hardcoding them. Replace it as the scaffold-seed example with a vessel that is actually running (`relevance-sink-vessel` is the known bare reference).
- **Class-level lesson (law 6).** A detector should flag any vessel whose advertised discovery shapes have no dispatch case. That is `packages/shape-dispatch-check/`, run across all clones. A second detector should flag any landing into a repo that has no active unit on any node. Either one would have caught this without an operator.
