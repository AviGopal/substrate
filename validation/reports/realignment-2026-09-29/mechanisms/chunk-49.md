# Mechanisms, chunk 49 (area "cpg-inference-ts"): verdicts from live evidence

Source: `classes/_mech_chunks/49.json`, which holds 1 item from the `git-small` collector. I measured the evidence read-only on 2026-09-29 at about 05:25 UTC, against `substrate-live` (the live clones under `/workspace/git/vessels/*`, the `execution` table, the analysis-vessel unit and `/health`) and against raw shards `live-resolvers.md`, `node2-runtime.md` and `git-small.md`.

## 0. Dedupe

There is 1 item, so there is nothing to merge within this chunk. Two related names are **the same mechanism**:
- "cpg-inference-ts" (the library)
- analysis-vessel's CPG resolvers (`code_quality`, `code_annotation`, `problem_detection`, `cpg_query_result`)

The library has no surface of its own. Every runtime use goes through analysis-vessel. It is judged together with that consumer below.

**Correction to another shard.** `raw/live-resolvers.md:77` lists `cpg-inference-ts` as a "clone-only fossil (no unit running on hub)". That is a category error. It is a library, so it has no unit by design. It is linked as `"@avigopal/cpg-inference": "file:../cpg-inference-ts"` (`analysis-vessel/package.json:13`), and `node_modules/@avigopal/cpg-inference` resolves to it. "No unit" is not evidence of disuse (law: a negative is unattributed until a positive control shares its address).

## 1. Verdict table

| mechanism | where | verdict | used now | live evidence | discoverability / archive |
|---|---|---|---|---|---|
| cpg-inference-ts: a code property graph built with WASM tree-sitter (`GraphBuilder`, `CodePropertyGraph`, `NodeType`, `initParser`) | `/workspace/git/vessels/cpg-inference-ts` (HEAD `19f24a5`, 2026-06-23, "use WebAssembly tree-sitter for arm64 compatibility"); consumed by `analysis-vessel/src/index.ts:15` | **keep-general**, with one **broken** consumer path (below) | yes | analysis-vessel is `active`. Its `/health` advertises `source_code, error_log, problem_detection, code_quality, code_annotation, cpg_query_result`. `buildCPG()` (`index.ts:91`) backs `code_quality` (`:228`), `code_annotation` (`:260`) and problem detection (`:148`) for `.ts/.tsx/.js/.jsx/.py`. In the 5-day `execution` window: `auto-bridge-code_quality` ran 54 ok / 220 fail, last success **2026-09-29T05:23:34Z** (a boredom_autonomous, gap_generated dispatch whose output was `disc:code_quality_6pq8tq5l`, so it was served through discovery). `auto-bridge-problem_detection` ran 71 ok / 2,265 fail, last success 2026-09-29T05:09:17Z. The failures seen are upstream binding and LLM errors, for example "Task 'extract' requires shape 'goal'" (63), "Task 'produce' requires shape 'filePaths'" (57), and empty `llm_completion_dispatch` (8). None is a CPG error. | Already discoverable through analysis-vessel's registration (hub discovery: `analysis-vessel-local`, 6 shapes). It is listed as a self-editable vessel in `goal-host-vessel/src/goal-file-resolution.ts:108` and `development-vessel/src/resolvers/activity-create-variant.ts:32`, so edit goals can target it. Missing: a concept-db concept "structural code analysis = cpg_query_result / code_quality via analysis-vessel", so drafters and the walk reuse it instead of re-deriving the same thing with LLM reads (law 3). |
| `cpg_query_result` resolver path (analysis-vessel) | `analysis-vessel/src/index.ts:277-316`; discovery row `resolve_endpoint = http://localhost:8250/resolve` (**absolute**) | **broken** | no (0 successes) | `auto-bridge-cpg_query_result` has 23 of 23 failures, every one `"fetch() URL is invalid"`, from 2026-09-26T16:55Z to 2026-09-27T02:30Z. That is the signature of the endpoint-routing class: the resolve-URL joiner builds `endpoint + ABSOLUTE resolvePath`, which throws in `new URL()` (memory note 09-22 "the resolve-URL joiner overshot"; `classes/endpoint-routing.json`). The same absolute-row pattern appears on llm-resolver, local-tools, goal-host and human-surface (`live-resolvers.md` §1). `code_quality` succeeds on the same vessel, so the defect is in the calling path, not in the library. | Do not fix this in cpg-inference or analysis-vessel. It belongs to the one joiner class-fix in `endpoint-routing`: normalise absolute `resolve_endpoint` at the discovery or caller seam, then grep every call site. Falsifier: the next `auto-bridge-cpg_query_result` has no `"URL is invalid"` failures. |

## 2. Recurring-class notes (history that makes this "same reason again")

- **Deploy and sync drift (`sync-deploy-drift`).** The cpg-inference-ts build broke node 2's pull-sync for about 43 h. There were 241 ticks with `failed=1` from 09-26 12:56 to 09-28 08:00: `cpg-inference-ts: BUILD FAILED -- keeping live dist` 42 times (exit 127), plus `src converged but dist stale (last-good != 19f24a5ae3)` 174 times as a retry loop. It ended with `31f15baf fix(pull-sync): build declarations-only shared packages with their own build script` (`raw/node2-runtime.md:103`). Declarations-only shared libraries (this one and `ias-executor-ts`) are the class. The fix is at the pull-sync seam, which is the right place. What is still missing is a detector for "the same failing build re-run every tick". That retry loop is the "same issue recurring for the same reason" pattern.
- On node 2 the `repos/cpg-inference-ts` submodule is **uninitialized** (`node2-runtime.md:109`). Under law 11 this is acceptable only if analysis-vessel does not run there. If analysis-vessel does run on node 2, the library must come from the image or the clone and not the super-repo worktree. I did not verify which source node 2 uses.
- The library is dormant as code: no commit since 06-23. Its last autonomous or operator change was the WASM port. It has **not** been edited by the self-development loop, even though it is listed as self-editable. That is expected for a stable primitive, and it is not a fossil signal.

## 3. Summary

- `cpg-inference-ts` is **keep-general**. It is a live, general structural-analysis primitive at a shared seam. It serves `code_quality` and `problem_detection` through analysis-vessel today (last success 05:23Z on 09-29).
- Its `cpg_query_result` route is **broken**, but by the endpoint-routing joiner class ("fetch() URL is invalid", 23/23), not by the library. Fold that into the endpoint-routing class-fix rather than minting anything new.
- The shard entry calling it a "clone-only fossil" should be corrected.
