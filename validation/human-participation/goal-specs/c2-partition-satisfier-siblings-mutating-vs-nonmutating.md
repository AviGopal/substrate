# C-2 — partition the walk's satisfier siblings into mutating and non-mutating

Change `repos/goal-host-vessel/src/index.ts` so the ACTION-THEN-READ satisfier branch drops
mutating sibling shapes before the LLM picker runs, unless the walk's own terminal shapes
declare a write.

Dispatch only AFTER C-1 lands. C-2 is a narrowing, not a proof.

## 2. Current behaviour (read 2026-09-20; line numbers verified, drifts noted)

- `index.ts:8856-8858` builds the sibling set with no write/read distinction:
  ```ts
  const live = await liveShapes();
  const siblings = [...live].filter((s) => s !== shape && (shapeEndpointMap.get(s)?.endpoint === ep.endpoint));
  if (siblings.length === 0) return null;
  ```
- `index.ts:8877` `let action = await llmPickProducingAction(shape, siblings);` — an LLM picks any
  sibling as the "producing action" (retry at `:8890` re-uses the same unfiltered `siblings`).
- `index.ts:8884` invokes it: `let actionResult = await rawResolve(action.shape, actionEp.endpoint, actionEp.resolvePath, action.args);`
  (assignment said `:8883`; actual is `:8884`.)
- The mutating classification exists but only elsewhere:
  - `index.ts:4886` `const writeShapes = [...new Set(targetShapes)].filter((s) => /(_write|_create_write)$/.test(s));`
  - `index.ts:5354` `if (canonicalShape.endsWith("_write") || canonicalShape.startsWith("obsidian:") || /^(fs_|code[A-Z]|file[A-Z])/.test(canonicalShape)) {`
  - `index.ts:5402` `if (shape.endsWith("_write") || shape.startsWith("obsidian:") || /^(fs_|code[A-Z]|file[A-Z])/.test(shape)) { ... return null; }`
  - **Drift:** the guard is `startsWith("obsidian:")`, not `startsWith("obsidian:write")` as the
    assignment stated; `:4886` is `/(_write|_create_write)$/` only. The two true duplicates are
    `:5354` and `:5402`.
- `index.ts:9283` `const SATISFIER_FORBIDDEN_FS_WRITE = new Set(["fileEditResult", "fileWriteResult", "fs_edit", "fs_write"]);`
  is consulted ONLY in the shape-SELECTION branch (`:9284`, `:9324`). The destructive
  ACTION-THEN-READ branch never asks. That is producer/consumer divergence.
- Declared terminals are already in scope in the same function: `index.ts:6811`
  `const terminalShapes = new Set<string>(opts.terminalOutputShapes ?? []);`

**Live consequence (goal-host journal, window 2026-09-19T07:34:48Z → 2026-09-20T07:36:18Z,
206 `satisfier action` invocations):** `uiQuestion_write` was invoked as a producing action for
read targets 9 times — `uiFeedback` ×5, `interactorObservation` ×3, `interactorAssertion` ×1
(all 05:24:01Z–06:18:55Z); plus `memoryNote_write` → target `uiPanel_write` ×1 (09-19T23:00:35Z).
71 of the 206 actions (34%) are mutating under the predicate below
(`fs_write` 30, `memoryNote_write` 18, `fileWriteResult` 14, `uiQuestion_write` 9).

## 3. Required behaviour

1. **Extract** a module-scope predicate (exported, so a unit test can import it):
   ```ts
   export function isMutatingShape(s: string): boolean
   ```
   true iff `/(_write|_create_write)$/.test(s)` OR `s.startsWith("obsidian:write")` OR
   `/^(fs_|code[A-Z]|file[A-Z])/.test(s)` OR s ∈ {`fileEditResult`,`fileWriteResult`,`fs_edit`,`fs_write`}.
2. **Extract** a module-scope, exported, pure partition function:
   ```ts
   export function partitionSatisfierSiblings(siblings: string[], terminals: string[]):
     { eligible: string[]; refused: string[]; reason: string | null }
   ```
   Semantics, fully determined (do not reinterpret):
   - `refused` = every sibling in `{fileEditResult,fileWriteResult,fs_edit,fs_write}` — dropped
     **unconditionally**, regardless of terminals (`:9276-9282` documents why: fs writes are
     advertised-not-applied and can never produce a creditable reach).
   - `writesDeclared` = `terminals.some(isMutatingShape)`. Coarse gate by design: if any terminal
     is mutating, all remaining mutating siblings stay eligible; otherwise every remaining
     mutating sibling is added to `refused`.
   - `eligible` = siblings not in `refused`, order preserved.
   - `reason` = null when `refused` is empty; otherwise a human-readable string naming the refused
     shapes and whether terminals declared a write.
3. **Wire it** immediately after `:8857`: replace `siblings` with the partition's `eligible` for
   BOTH picker calls (`:8877` and the retry at `:8890`). When `refused.length > 0`, emit it through
   the existing `tap(...)` (defined `:6778`) so the refusal is visible in the walk log. When
   `eligible.length === 0`, `return null` so the walk falls through to bridge/escalate.

## 4. What must NOT change

- `index.ts:9283-9326` stays **byte-identical**, including its local
  `SATISFIER_FORBIDDEN_FS_WRITE`. The assignment's "one definition" and "byte-identical" collide;
  byte-identical wins. The new module-scope predicate therefore carries its own copy of the four
  fs shapes, and that duplication is deliberate — do not dedupe `:9283`.
- `:4886`, `:5354`, `:5402` unchanged (call sites may later be migrated; not in this goal).
- `llmPickProducingAction` (`:7576`) signature and body unchanged.
- The soft-refusal/retry/re-read logic at `:8859-8920` unchanged apart from the two
  `siblings` → `eligible` argument substitutions.
- No behaviour change when `refused` is empty: same picker input, same order.

## 5. Falsifier (machine-checkable, behavioural, unrun)

New `repos/goal-host-vessel/test/satisfier-sibling-partition.test.ts`, importing from
`../src/index` (safe: boot is guarded by `import.meta.main` at `:16582`; the pattern is already
used by `test/active-dispatches-pagination.test.ts:2`).

Run: `cd repos/goal-host-vessel && bun test test/satisfier-sibling-partition.test.ts`

- **Case A (the defect).** `partitionSatisfierSiblings(["uiQuestion","uiQuestion_write","uiPanel_write"], ["uiFeedback"])`
  ⇒ `eligible` excludes `uiQuestion_write` and `uiPanel_write`, includes `uiQuestion`;
  `refused` contains both write shapes; `reason` is non-null.
- **Case B (positive control — the guard must not refuse everything).** same siblings with
  terminals `["obsidian:write_note"]` ⇒ `eligible` includes `uiQuestion_write`.
- **Case C (positive control — no-op path).** all-read siblings `["uiQuestion","uiFeedback"]`,
  terminals `["uiFeedback"]` ⇒ `eligible` deep-equals the input, `refused` empty, `reason` null.
- **Case D (unconditional fs drop).** siblings `["fs_write","memoryNote_write"]`, terminals
  `["fs_write"]` ⇒ `fs_write` refused even though it is a declared terminal;
  `memoryNote_write` eligible.

Fails before the change because `partitionSatisfierSiblings` / `isMutatingShape` do not exist —
the import fails. That is a behavioural absence, not a string match, and no comment or literal
can satisfy Cases A–D together (A requires dropping, B and C require NOT dropping).

**Not covered by this falsifier (name the gap):** it exercises the pure predicate, not the live
walk. Whether `:8877` actually receives `eligible` is not proven by it; that needs the C-1 /
human-surface-side evidence or a walk-level integration probe.

## 6. Risks and blast radius

- **Eligibility keys off DECLARED TARGET SHAPES, and target inference in this system is
  unreliable — it has been observed returning tool shapes at 0.98 confidence.** A walk that
  wrongly infers a write terminal re-opens the whole hole. C-2 narrows the blast radius; it
  cannot be the only defence, which is exactly why C-1 and the human-surface-side guard must
  exist independently of it.
- **The predicate is lexical.** Observed satisfier actions it *under*-includes (genuinely
  mutating, will still be invoked): `git_commit` ×7, `dispatch_goal` ×2,
  `vessel_mitosis_cutover` ×1. It *over*-includes reads via `/^(fs_|code[A-Z])/`: `fs_read` ×2
  observed as a producing action, plus `codeSearchResult`. Over-inclusion fails safe (fall
  through to bridge/escalate); under-inclusion is residual exposure to record, not fix here.
- **Reach may drop.** 34% of satisfier actions in the measured window are mutating-by-predicate;
  walks whose terminals are reads now fall through instead of writing, and some of those were
  producing real artifacts. Judge the reach delta against the corruption prevented.
- Single file, additive exports plus two argument substitutions; no schema, shape, migration, or
  newly written field.
