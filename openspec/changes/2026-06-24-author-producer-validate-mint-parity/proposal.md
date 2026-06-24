# author_producer validate↔mint parity (goal-derived input binding)

**Date:** 2026-06-24
**Vessel:** development-vessel
**Stage:** SPEC (VERIFY+DEBUG complete — see findings below)
**Operator decision:** "fix the generative root" (vs. a single entry producer) — broad leverage across every file-consuming shape.

## Problem (VERIFY + DEBUG)

Code-analysis goals dispatched to the substrate never reach the genuine producer. Live evidence (2026-06-24):

- Goal "examine discovery-vessel/src/index.ts, find top-3 risks" → goal-walk selects `learned-auto-bridge-problem-detection` → produces a `problem_detection` shape with **no analysis content** → reach-gate judges HOLLOW → β-penalised. The genuine producer (`analysis-vessel:8250`) works when handed `filePaths` directly (verified: found *"createServer is 218 lines (>80)" at discovery-vessel/src/index.ts:30*), but **no activity reaches it with the right input.**

**Root cause — validate↔mint divergence in `author_producer`** (`repos/development-vessel/src/resolvers/author-producer.ts`):
- `buildTestPointer` (lines 282–310) makes validation pass by extracting a concrete file path **from the goal text** (`fileFromGoal` regex) and filling `filePaths: [fileFromGoal]`.
- But the **minted** template (line 466) preserves the LLM's placeholder binding `filePaths: "{{source_code}}"`, binding from an input shape (`source_code`) that is **never in the pool** (and is file *content*, not a path array).
- So the pointer that **passed validation ≠ the pointer that is minted.** The minted bridge cannot run. The resolver's own stated invariant ("execute-path matches validate-path") is violated.

This is general: every file-consuming shape author_producer mints (`problem_detection`, `code_quality`, `source_code`, `cpg_query_result`, …) inherits the same dangling binding. It is why the rich operator-facing capability surface stays a set of disconnected islands while internal ticks dominate exercised topology.

## Change (DEV scope)

Fix the generative root so a minted bridge's runtime binding matches what validation proved works, for goal-derived primitive inputs.

1. **New deterministic resolver `goal_file_extract`** (`src/resolvers/goal-file-extract.ts`): given `{ goal }` (and/or a pool goal impulse), emit a `filePaths` impulse = the path-like tokens extracted from the goal text. Same extraction logic as `buildTestPointer.fileFromGoal`, generalized to return all matches (array). Deterministic, no LLM, no network. Output shape: `filePaths` (`{ shape: "filePaths", filePaths: string[] }`).
   - Three-place rule: resolver file + `discovery.shapes` entry in `config.ts` + dispatch `case` in `impulses.ts`.
   - Per-resolver test: `test/resolvers/goal-file-extract.test.ts`.

2. **author_producer mints a runnable bridge for goal-derived file fields.** After a config validates, detect fields that `buildTestPointer` resolved from the goal (file-shaped fields: `filePaths|paths|path|filePath|file`). For those, mint a **2-task bridge**:
   - task 1 `extract`: resolver `goal_file_extract`, binds `goal` from the goal impulse → produces `filePaths`.
   - task 2 `produce`: resolver `<shape>`, binds the file field from task 1's `filePaths` (`{{filePaths}}`) instead of `{{source_code}}`.
   - Non-file goal-derived fields and zero-input resolvers keep the existing single-task path.
   - `binds_from` in the returned body reflects the actual minted bindings (parity with what runs).

## Out of scope / future

- Non-file goal-derived primitives (free-text args filled from goal during validation) still bind via the LLM placeholder; generalize later if a second class appears.
- Reach-gate non-determinism and ribosome minting false-positive reaches (observed amplifiers) are tracked separately in substrateGap `operator-2026-06-24-hollow-bridge-shadows-genuine-producer`.

## DEV constraints discovered (must be honored by implementation)

Verified in `goal-host-vessel/src/index.ts` interpolation (`interpolateProxyValue` ~L1688, `buildImpulseSlots` ~L1677):

1. **Cross-task binding grammar is `{{impulse:<slot>}}`**, where `<slot>` = the upstream impulse's `metadata.outputImpulseKey`, and the substituted value is that impulse's `content`. Dotted `{{var.path}}` resolves only from per-step `variables`.
2. **Arrays/objects are `JSON.stringify`'d on substitution.** So `filePaths: "{{impulse:fp}}"` where the upstream content is `["/p"]` yields the literal string `'["/p"]'`, which analysis-vessel's `arr(pointer,"filePaths")` rejects. **Therefore:** `goal_file_extract` must expose the *primary path as a plain string* (and task 2 must wrap it: `filePaths: ["{{impulse:fp}}"]`), OR the produce-task field must be a string field — pick whichever the target resolver accepts. Validate per shape.
3. **VERIFIED (ias-executor-ts `src/engine.ts`):** multi-task threading works. The engine runs `tasks[]` in `dependencies` order; after a task resolves it stamps each output impulse with `metadata.outputImpulseKey = <slot>` where `<slot>` is the string the task declares in its `outputImpulses: ["<slot>"]` array (L599-612); a downstream task declaring `inputImpulses: ["<slot>"]` receives those impulses in its resolve context (L293-313), and the goal-host proxy's `buildImpulseSlots` keys them so `{{impulse:<slot>}}` resolves to the impulse `content`. Real precedent: `src/templates/lifecycle/slot-binding.json` (5-task template; task `select_or_produce` declares `outputImpulses:["select_or_produce_result"]`, consumed downstream via `{{impulse:select_or_produce_result}}`).

**Verified minted-template recipe** (2-task bridge for a file-consuming shape X):
```
task1 "extract": { resolver: "goal_file_extract", config:{ goal:"{{goal}}" },
                   inputShapes:["goal"], outputImpulses:["goal_files"], outputShapes:["filePaths"] }
task2 "produce": { resolver: "X", dependencies:["extract"], inputImpulses:["goal_files"],
                   config:{ type:"X", filePaths:["{{impulse:goal_files}}"] }, outputShapes:["X"] }
```
`goal_file_extract` must put the **primary path as a STRING** in its impulse `content` (constraint #2 — array would be JSON.stringify'd by the proxy); task2 wraps it `["{{impulse:goal_files}}"]` → a real `["/path"]` array. After implementation, restart **both** dev-vessel (new resolver) and goal-host (re-pull `/shapes` to register the `goal_file_extract` proxy).

These constraints are why this lands as a test-gated DEV cycle (per-resolver test for `goal_file_extract` + an integration test asserting a minted bridge actually REACHES), not a hot edit. The design fork is now closed; implementation is unblocked.

## Verification (VERIFY gate)

- `bun run lint` (tsc --noEmit + shape-dispatch-check) green; `bun test` green incl. the new per-resolver test.
- Live: re-mint `author_producer shape=problem_detection goal="…/index.ts…"` → minted template is 2-task; dispatch the analysis goal → goal-walk **REACHES** with real findings (line-cited problems) rather than HOLLOW.
- Regression: a zero-input shape still mints a single-task bridge.
