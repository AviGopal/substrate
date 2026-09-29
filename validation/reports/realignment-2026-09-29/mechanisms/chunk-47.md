# Mechanism verdicts: chunk 47 (workbench)

Input: `classes/_mech_chunks/47.json`. It holds 1 collector item in area `workbench`, sourced from `git-mid`.
Verified read-only on 2026-09-29 against the host super-repo and node 1 (`substrate-live`).

**Deduplication:** nothing to merge. The chunk has one item. The same object also appears in other records under other names: the "react-renderer / workbench never ran" stack (memory-6 `codebase-bloat-fossils`, openspec-9 surface replacement) and "workbench / react-renderer / cloud-dashboard" (git-super-1:514). All of these name one fossil repo, and they are judged here together.

## Collector claims corrected by live evidence

- **"Still has a submodule gitlink" (git-mid:160) is stale.**
  - `git submodule status repos/workbench` fails with "pathspec did not match".
  - The gitlink was dropped in `b49942df` (2026-06-26, "drop 8 non-substrate submodules", 26 → 18 submodules).
  - `repos/workbench/` is now gitignored (`.gitignore:207`). It survives only as an untracked host directory, with HEAD `e045a2d`, dated 2026-05-24.
- **The "0 autonomous commits, no unit" claim is confirmed.**
  - There is no `/workspace/git/vessels/workbench` clone in substrate-live, and no systemd unit.
  - The `execution` table has no activity id containing `workbench`. The query returned an empty result.

## Verdict table

| # | mechanism | verdict | used now | live evidence (2026-09-29) | discoverable via / archive at |
|---|---|---|---|---|---|
| 1 | **workbench React app** (`repos/workbench`; first human/observer surface, Vite on port 3000; 213 commits from 04-22 to 05-24, all operator-authored) | fossil | no | **Code:** last commits `e045a2d` (05-24, useVariantScoresParallel → thompson_posterior), `4aabc33` and `ab3c381` (05-21, ias-executor-ts browser bundle). It has no live clone, no unit and no executions. **Superseded by:** `human-surface-vessel` (unit active, :8310), with its "onepage" single-viewport workbench layout at `human-surface-vessel/src/store.ts:612` (landed as 81f6394c). `stateful-ui-vessel` is also still active; openspec-9 shows that retirement FAILED. **Only code residue:** comments in live clones that name workbench as a consumer, none of them imports. They are `activity-api/src/routes/impulses.ts:1508,1625`, `activity-api/src/websocket/types.ts:91,160` (the one at :160 cites the non-existent `repos/workbench/src/hooks/useTrajectoryExecution.ts`), `activity-api/src/services/embedding-prior.ts:31`, `goal-host-vessel/src/index.ts:14410` and `ias-executor-ts/src/ports.ts:77,117`. **Doc residue:** the `docs/LIVE_DEVELOPMENT.md:49` table row (`workbench \| vite \| 3000`) and the connection-pattern text at :241 and :245; `docs/README.md:135` links `docs/architecture/WORKBENCH_CHAIN_UX_DESIGN.md`, a contract for a surface that is not in the fleet (docs-2:114). | **Archive:** tag the untracked host tree's HEAD `e045a2d` as `fossil/workbench-2026-05-24`, bundle it, and put a tombstone README plus the bundle pointer at `archive/fossils/workbench/`. Then remove the host `repos/workbench/` so it stops showing up as 25 stale `.md` files (vessel-docs-tooling:80). **Doc realignment** (docs-align loop, not a hand chore): replace the LIVE_DEVELOPMENT row and the "same as the workbench" wording with human-surface-vessel. Rewrite the live-clone comments to say "UI subscribers (human-surface-vessel)". This is cosmetic only; no behaviour depends on it. |

## What to keep from the fossil (content, not code)

`WORKBENCH_CHAIN_UX_DESIGN.md` carries surface-agnostic principles that docs-2 (:460–463) extracted as class principles:

- explanations come from the recorded decision state, not reconstructed from the outcome;
- rank by reach, not by frequency;
- never make the human speak internal language.

These are **keep-general as concepts, not as a mechanism**. Mint or confirm them as concept-db concepts attached to `human-surface-vessel` rendering, so that the drafter recalls them at prompt-build (the runtime reader). Then retitle the doc as a human-surface contract, or fold it into the human-surface docs. If the doc stays titled "workbench", it keeps describing a surface nobody runs.

## Class note (the recurring failure)

The human surface has been rebuilt at least four times:

1. workbench and react-renderer, never deployed (04–05);
2. stateful-ui-vessel on :8270;
3. human-surface-vessel on :8310 (08-07 onward);
4. the one-page layout (09-2x).

Each replacement left its predecessor partly alive:

- stateful-ui-vessel is still active;
- 248 escalations are pinned to :8270 (memory START HERE, 09-22);
- workbench comments and docs remain.

The workbench itself is harmless because nothing reads it. The recurring defect is **retirement without reader migration**. The detector that would catch this class is a "retired surface still named by a writer or doc" check: the fossil's name or port is grepped across live clones, docs and discovery rows. The workbench would give it a trivial positive-control fixture.
