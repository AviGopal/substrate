# Mechanism verdicts: chunk 48 (analysis-vessel)

Input: `classes/_mech_chunks/48.json`. It holds 1 collector item (`resolve-file-path`), sourced from `raw/git-small.md`.
Verified read-only on 2026-09-29 against node 1 (`substrate-live`):

- **Code:** the live clone `/workspace/git/vessels/analysis-vessel`, whose HEAD is `afb6955`. The file's history is `5a890c3` then `afb6955`, both on 08-09. `f6af48e` precedes them.
- **Unit:** `analysis-vessel` is `active`.
- **Execution table:** 4,670 rows whose `activity_id` contains `problem_detection`.

**Deduplication:** within this chunk there is nothing to dedupe. Across areas, it is the same mechanism as local-tools `mapPath` (see below).

## resolve-file-path (analysis-vessel `src/resolve-file-path.ts`)

**Verdict: merge-into, with a shared repo-path mapping primitive as the target.** The canonical form should be this module's pure `resolveFilePathPlan`, because it is the more complete of the two. It is not a fossil: it is live and used today.

**What it is.** `resolveFilePathPlan(rawPath, workspaceRoot)` is the pure half of path resolution: it touches no filesystem.
- A path of the form `repos/<v>/<rest>` or `/repos/<v>/<rest>` becomes the ordered candidates `/vessels/<v>/<rest>` and then `${WORKSPACE_ROOT}/git/vessels/<v>/<rest>`.
- A bare relative path is anchored to `WORKSPACE_ROOT` instead of cwd.
- An absolute path passes through unchanged.

`index.ts:50-64` imports the module, and `resolveFilePath` probes the candidates. `readFile` (`index.ts:66`) is called by the `problem_detection`, `source_code` and `error_log` handlers (`index.ts:206, 313, 339`).

**Used now: yes.**
- `problem_detection` is one of the heaviest live shapes. `raw/live-resolvers.md:108` records 4,281 runs at a 10% ok rate. `auto-bridge-problem_detection` went from 63/68 ok after goal-host `5ca51be` (09-28) to 64 ok / 5 fail after 14:00 (`raw/live-activities.md:35`, `raw/live-resolvers.md:154`).
- Its low historical success is attributed to the goal-host resolve-URL joiner, not to this path mapper.

**Problems it solved** (`raw/git-small.md:159,193,235`, `raw/memory-8.md:226`):
- `5a890c3` removed a dead candidate, `${WORKSPACE_ROOT}/repos/...`, because `/workspace/repos` does not exist. It also made bare paths stop resolving against the vessel's own cwd, which had produced ENOENT. The walk then confabulated filenames from those ENOENTs.
- `afb6955` moved the logic out of `index.ts` so that the test imports it rather than mirroring it. The lesson recorded there: "a test that re-implements its subject is worse than no test".

**Duplicate: local-tools `mapPath`.**
- **Location and history:** `/workspace/git/vessels/local-tools-vessel/src/index.ts:31`, commits `2aaa834`, `44375c6` and `7a38f37`. It solves the same class, fixed on the same day (08-09).
- **The two copies have already diverged.** `mapPath` rewrites `repos/<v>/` only to `${RUNTIME_ROOT}` (`MITOSIS_RUNTIME_DIR ?? /vessels`, line 24). It has no `/workspace/git/vessels` fallback and no handling for a leading `/repos/`. The analysis version probes both roots and ignores `MITOSIS_RUNTIME_DIR`.
- **Consequence:** the same `repos/...` pointer can resolve to different files, or ENOENT in one vessel and not the other. This matters during mitosis overlays, and for vessels outside `/vessels` such as the plain-file resident vessels (see the memory note on authorability).
- **The class extends beyond these two.** Other ad-hoc `/vessels/${…}` builders exist in:
  - development-vessel `source-code-analysis.ts`, `feature-compose.ts`, `author-producer.ts`, `vessel-mitosis-*.ts`, `activity-create-variant.ts` and `vessel-health-report.ts`;
  - goal-host `index.ts`.

  So "where does `repos/<v>/…` live at runtime" is answered in at least three vessels, in slightly different ways. Goal-host `55f0ee1` is the same information-starvation class from the prompt side (`raw/memory-8.md:226`).

**Why merge rather than keep-specific.** This is the "same issue recurring for the same reason" pattern:
- The path fix was made twice on 08-09, in two vessels, independently.
- The copies have since drifted.
- No shared seam owns the mapping.

The general capability is a single rule, or better a resolver shape, that maps a repo-relative pointer to runtime candidates. It should be:
- aware of `MITOSIS_RUNTIME_DIR` and of mitosis overlays;
- ordered as `/vessels` first, then the `git/vessels` clone.

By law 1 the mapping is behavioural and belongs at the fixed point. The same root-cause pattern shows up in `raw/live-resolvers.md:154`: discovery stores `resolve_endpoint` in 3 formats, nobody normalizes it, and call sites get patched one at a time.

**Discoverability once kept or merged.**
1. **Short term.** Hoist `resolveFilePathPlan`, together with its test, into a shared TS package: `packages/` already carries `vessel-discovery-client` and `test-helpers`. Have local-tools `mapPath` and the development-vessel builders call it. Keep `MITOSIS_RUNTIME_DIR` as the first root.
2. **Class grain.** Record a concept in concept-db named something like "repo-relative pointer to runtime path: one mapper, ordered candidates, never cwd". The drafter will then recall it when a gap's `edit_site` touches file reads in any vessel.
3. **Optional.** Expose it as a thin deterministic resolver shape (e.g. `repoPathResolution`) on local-tools, which owns filesystem access by data locality. Walks and other nodes could then resolve it over discovery or p2p instead of re-deriving it.

**Detector for the class (law 6).** Add a conformance check under `packages/shape-dispatch-check` or `evidence-aliasing-check` style. It would flag any new `` `/vessels/${` `` template literal outside the shared mapper, which turns the next drift into a detected gap.

**Nothing to archive:** there is no fossil in this chunk.

| name | location | verdict | used_now | target |
|---|---|---|---|---|
| resolve-file-path (`resolveFilePathPlan`) | analysis-vessel `src/resolve-file-path.ts` (live HEAD `afb6955`) | merge-into | yes | a shared repo-path mapper in `packages/` (canonical form = this plan). Absorbs local-tools `mapPath` (`index.ts:31`) and the ad-hoc `/vessels/${…}` builders in development-vessel and goal-host. |
