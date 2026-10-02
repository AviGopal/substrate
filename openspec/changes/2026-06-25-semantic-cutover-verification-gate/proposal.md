# Semantic cutover-verification gate (the reach-gate, applied orthogonally to code)

**Date:** 2026-06-25
**Vessel:** development-vessel (feature_compose verify path)
**Stage:** SPEC (root-caused live — see evidence)
**Lever:** 5 (emergent keystone for the AUTHORING-LANDING half). Surfaced by the cutover demonstration: the mechanism lands code, but the gate is semantically blind.

## Problem (demonstrated live 2026-06-25)

With the verify-harness PATH unblocked, the autonomous loop authored + typecheck-verified + applied + restarted a code change for the `trace_outcome_inconsistency` gap — but the landed patch was **hollow**: a net-new `recordOutcome`/`isNoOpBody` that (a) has ZERO callers (dead code), (b) records nothing (`void success; void body;`), (c) never touches the real β-penalty path (`verifyGoalReached → penaliseHollowTemplate`). It passed because the verify gate (`feature-compose.ts` ~L306) checks only **`tsc --noEmit` + shape-dispatch** — both of which pass on type-clean dead code.

The gate enforces *syntactic/type* validity, not *semantic* validity. This is the exact analogue, on the code-cutover path, of the hollow-completion hole the **reach-gate** already closed on the goal-execution path: `status=completed ≠ goal reached`, and here `typecheck=clean ≠ gap fixed`.

## Key insight: reuse the reach-gate, orthogonally

`verifyGoalReached` (goal-host) is an LLM judge that, given a goal + produced output, decides whether the output GENUINELY satisfies the goal (not just "ran"). The code-cutover path needs the same judgment shape: given the **gap** + the **diff** + **reachability facts**, decide whether the patch GENUINELY addresses the gap (not just "compiles"). Same pattern (LLM judge via `LLM_VESSEL_ENDPOINT`/haiku, strict JSON verdict), new domain.

## Change (DEV scope, development-vessel feature_compose)

After the existing typecheck/shape-dispatch verify passes (and BEFORE marking FAVORABLE / staging), add a **semantic verification step** `verifyPatchAddressesGap(gap, diff, reachability)`:

1. **Reachability facts (deterministic, cheap, computed before the LLM call):** for each edited symbol/function in the diff, compute whether it is REACHABLE — i.e. has ≥1 caller in the vessel (grep `\bname\s*\(` across `src/`, excluding the definition) OR is an exported entrypoint / route handler / resolver dispatch case / lifecycle hook. Flag edits that are (a) net-new functions with zero callers, (b) edits to functions with zero callers (dead code). Provide these facts to the judge AND hard-fail on them: a patch whose ONLY changes are to unreachable code → UNFAVORABLE outright (no LLM needed).
2. **LLM semantic judge:** prompt with the gap summary + the unified diff + the reachability facts + the relevant existing-code context (the function(s) the gap names, and the actual live path if reachability found a different one). Ask: does this diff genuinely change the behavior the gap describes, on a path that actually executes? Return `{ addresses: boolean, reason, on_live_path: boolean, suspected_real_location?: string }`. `addresses=false` → UNFAVORABLE (rollback, gap stays open) with the reason recorded on the gap so the next attempt is informed.
3. **Mis-localization feedback:** when the judge reports `suspected_real_location` (the gap pointed at the wrong symbol — e.g. `recordOutcome` when the live path is `penaliseHollowTemplate`), write that back onto the gap (`classification_metadata.suspected_real_location`) so re-drafting targets the right code. This makes gap localization self-correcting.
4. **Flag-gate** `SEMANTIC_CUTOVER_GATE` (default ON once verified — this is a safety gate, the kind we KEEP per the 2026-06-21 gates framing; it is substrate self-verification, not an operator-in-the-loop toggle). Log the verdict.

## Why this is the keystone (operator design questions)

- **Avoid bad approaches as much as learn good ones:** the reach-gate damps hollow goal-executions; this damps hollow code-cutovers. Together the substrate now rejects hollowness on BOTH its arms — selection (lever 4 routes away from irrelevant), execution (reach-gate), and authoring (this). Avoidance is now symmetric with reward.
- **Develop + maintain its own vessels:** a self-authored code change can only land if it genuinely, reachably addresses the gap — so the autonomous loop stops "closing" gaps with dead code. This is what makes S1→S2 (substrate-authored development) TRUSTWORTHY, not just possible.
- **Apply the same reasoning orthogonally to make future activities/vessels/resolvers better:** the gate generalizes — "did the change achieve its declared intent on a live path?" is the universal verification primitive. For a new ACTIVITY: does it produce its declared output shape on a reachable resolver (already partly the reach-gate)? For a new RESOLVER: is it dispatch-wired (three-place) and invoked? For a VESSEL change: is the edited code on an executing path? Reachability + intent-match is the common spine; this lever instantiates it for code and is the template for the others.

## Out of scope

- A full call-graph analysis (use grep-based reachability + the existing cpg-inference/analysis-vessel only if cheap; deterministic grep is the MVP).
- Reverting prior hollow landings beyond the one this demo produced (the implementer reverts that one to keep the runtime honest).
- The reach-gate strictness calibration (separate, secondary finding).

## Verification

- `bun run lint` + `bun test` green incl. a unit test: a dead-code-only diff → UNFAVORABLE (reachability hard-fail, no LLM); a diff editing a function with real callers that genuinely changes the gap behavior → addresses=true; mock the LLM judge.
- **Live (the demonstration, re-run):** first REVERT the hollow `recordOutcome` patch from `/vessels/goal-host-vessel` (re-copy host src + restart). Then re-drive the `trace_outcome_inconsistency` cutover. Assert the semantic gate now **REJECTS** a hollow/dead-code draft (UNFAVORABLE with a reachability reason + `suspected_real_location`), OR — if the drafter, informed by the reachability facts, targets the real path — LANDS a SOUND patch that actually edits the live β-penalty logic. Either outcome demonstrates "avoid bad approaches": no more hollow landings.

## Risk

Low. The gate can only BLOCK a landing (fail-safe: an authored change that can't be semantically verified stays staged/open, exactly like a typecheck failure today). One extra haiku call per FAVORABLE-typecheck compose. Deterministic reachability is the cheap first filter. Deploy: development-vessel `docker cp` + restart.
