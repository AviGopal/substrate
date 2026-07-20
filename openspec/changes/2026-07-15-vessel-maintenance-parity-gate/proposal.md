# Vessel-maintenance parity gate — behavior-neutral seam extraction so weak models can decompose fossils

**Date:** 2026-07-15
**Vessel:** development-vessel (feature_compose verify path) + a new maintenance activity family
**Stage:** SPEC (grounded in a live fossil census + a watched self-repair loop declining to draft against a fossil)
**Lever:** the missing `λ₁` — the substrate's autonomous *decomposition* rate. Standing it up from zero is the S1→S2 keystone for self-maintenance.

## Problem (grounded live 2026-07-15)

The code-drafter (`feature_compose`) cannot reliably splice a file past ~1–2k lines. Every source file above that is a **fossil**: a region the substrate *cannot self-edit*, forcing an operator in. A census of the canonical vessel set (`repos/*/src`, `.ts`, excluding generated bundles/tests):

| Rank | File | Lines | Structure |
|---|---|---|---|
| 1 | activity-api `routes/activities.ts` | 12014 | loose bag — 57 independent route handlers |
| 2 | goal-host-vessel `index.ts` | 6912 | god-object-with-satellites |
| 3 | activity-api `routes/impulses.ts` | 5686 | loose bag (already a mount seam) |
| 4 | activity-api `routes/execution-traces.ts` | 3717 | loose bag |
| 5 | boredom-vessel `index.ts` | 3491 | loose bag — 66 procedural fns |
| 6 | obsidian-vessel `views/goal-dispatch-view.ts` | 2546 | god-class (one `ItemView`) |
| 7 | minibob `impulse.ts` | 2342 | one cohesive unit |
| 8 | development-vessel `resolvers/gap-to-feature.ts` | 2085 | router-of-resolvers |

These fossils accreted in S1: operator hands added load-bearing complexity faster than any *decomposition* capability existed — `λ₁ = 0`. The self-repair loop is alive and correctly declines to close behavior gaps that land inside a fossil: watched live, `development-vessel:draft-gap-closing-activity` fires and returns `no_op` against fossil targets rather than producing a hollow splice. The write-back walk gap (`walk-autobridges-obsidian-write-note-…`, whose fix lives in goal-host `index.ts` at 6912 lines) is one concrete casualty — it is **blocked-on** decomposition, not merely unattempted.

Load-bearing observation from the census: **the biggest fossils are the easiest.** `activities.ts` (12k lines) is 57 loosely-coupled handlers — a mechanical "one handler → one module, re-export" split needs almost no semantic reasoning. The genuinely hard fossils (goal-host `index.ts`, the obsidian god-class) are the minority. This distribution is what makes a *weak-model* strategy viable rather than aspirational.

## Key insight: the parity gate is the dual of the semantic cutover gate

`2026-06-25-semantic-cutover-verification-gate` established the universal verification primitive: *"did the change achieve its declared intent on a live path?"* — enforced by an LLM judge, because intent-match over an *arbitrary* behavior change is not machine-decidable.

A **maintenance** transform has a *trivial, special* declared intent: **"change nothing observable."** Behavior-neutrality **is** machine-decidable — via normalized-AST equivalence. So the parity gate is the same verification primitive at its degenerate, strongest, cheapest point: no LLM judge, a deterministic proof.

The consequence is the whole reason this unlocks weak-model self-maintenance (the operator's explicit requirement): **all correctness lives in the deterministic gate, so the *generator* of the cut can be arbitrarily weak.** Model strength affects only *how cohesive/well-named* the split is — a low-stakes, re-cuttable property — never *whether behavior is preserved*. Semantic consistency and development quality are guaranteed by the gate, not bought with model tier.

Corollary — split the two gates by transform type:

- **Behavior change** (a normal gap fix) → the **semantic gate**: intent achieved on a live path (LLM judge + reachability).
- **Maintenance transform** (seam extraction) → the **parity gate**: behavior provably unchanged (deterministic).

A maintenance commit that also edits behavior *voids parity* and must be split into a separate behavior commit. This separation is itself the safety property.

## What "parity" formally guarantees

A `seamExtraction` is behavior-neutral iff **all** of the following hold (cheapest-first; each is a hard gate):

1. **Public-surface parity.** The edited file's export set (names + type signatures) is unchanged; former in-file callers reach moved symbols through a re-export shim. The module's *contract* is byte-stable.
2. **Type parity.** `tsc --noEmit` clean with **zero new diagnostics** versus the pre-change baseline.
3. **Test parity.** The existing suite passes **unchanged** — a maintenance commit may not add, delete, or edit a test. (Test edits are a behavior signal and belong elsewhere.)
4. **Normalized-AST equivalence.** For a pure move, the union of the resulting modules' normalized ASTs equals the original file's normalized AST, modulo exactly: (a) module boundaries, (b) the added `import`/`export` shim edges, (c) whitespace/comments/positions. Any rewrite of a moved symbol's body → non-equivalent → FAIL. This is the *proof* that code was moved, not rewritten.

`verdict = surfaceParity ∧ typeParity ∧ testParity ∧ astEquivalent`. The gate can only ever **BLOCK** — a transform that cannot prove parity stays unlanded, exactly like a typecheck failure today (fail-safe).

## Shape vocabulary (new)

- **`spliceabilityGap`** — a gap keyed to a *file's un-spliceability*, detected from realized splice-failure + edit-pressure (NOT a line-count lint). Weight = `size_over_ceiling × failed_edit_frequency`. A 12k-line file nobody edits is low priority; a fossil the drafter keeps `no_op`-ing on is urgent (law 6: the bug class, not the instance).
- **`seamExtraction`** — a proposed cut: `{ file, symbols[], targetModule, rationale }`. Emitted by a possibly-weak generator; consumed by the deterministic applier.
- **`parityVerdict`** — the gate's output: `{ surfaceParity, typeParity, testParity, astEquivalent, verdict, failReason? }`.

## The activity family (earned by doing, boredom-driven)

Minted as activities the loop can grade, not hand-run scripts (law 2):

- **`detect-spliceability-gap`** — correlate drafter `no_op`/hollow/low-`predicted_p` outcomes against a target path; emit/upweight a `spliceabilityGap`.
- **`propose-seam-extraction`** — generate a `seamExtraction`. **Deterministic** for loose bags (one handler/function-cluster → one module, by existing grouping); **weak-LLM** for god-classes (which cohesive collaborator to extract). Either way the output is *only a proposal*.
- **`apply-seam-extraction`** — mechanical AST move (ts-morph) + re-export shim + import fixups. No content rewrite.
- **`verify-parity`** — the gate above. Lands a traced commit on PASS; rolls back and records `failReason` on the `spliceabilityGap` on FAIL, so the next proposal is informed.

Selection is **boredom/condition-driven** (law 5): idle capacity folded with open `spliceabilityGap` demand raises the weight; no timer, no refactor sprint. The **decompose-before-behavior** ordering law means this family runs *ahead* of behavior work on the same file — otherwise behavior gaps on a fossil block forever.

## Why this is the keystone

- **`λ₁ ≳ ρ_grow`.** Self-development stalls unless the decomposition rate outpaces the accretion rate. In S1, `λ₁ = 0` (only operator extraction), so fossils grew unbounded. Standing up a nonzero *autonomous* `λ₁` is exactly what removes the operator as the load-bearing extractor — the definition of "the system takes over more fully."
- **Weak models make `λ₁` large.** If every split needed the strongest model, `λ₁` would be cost-throttled. Correctness-in-the-gate lets cheap models drive high-throughput decomposition. The operator's two asks — decompose fossils, self-update with weak models — are the *same* ask.
- **Generalizes past decomposition.** Parity-gated mechanical transforms are the safe substrate for *all* weak-model vessel maintenance: dead-code removal, dup consolidation, dependency hygiene, rename. Each is "prove behavior unchanged" + a mechanical edit. This change instantiates the pattern for seam extraction and is the template for the rest.

## Bootstrap (the chicken-and-egg, resolved)

The family cannot be drafted *into* the fossil it must fix — a legitimate operator bootstrap ("a capability that cannot exist until someone bootstraps it"). The bootstrap is **not** hand-splitting `index.ts` (that just re-runs S1 accretion with a different hand). It is:

1. Build + unit-prove the **gate** against this spec (the load-bearing piece — get it wrong and every weak-model edit is poisoned).
2. Mint the **deterministic loose-bag extractor** against the settled gate.
3. Run it on the **easiest big fossil** — `activities.ts`, 57 handlers — with the gate live. Traces accrue; the family is *earned*.
4. Climb toward god-classes (weak-LLM proposal for collaborator extraction, still parity-gated).

## Out of scope

- Full call-graph analysis — grep + ts-morph AST is the MVP; reach for analysis-vessel/cpg-inference only if cheap.
- God-class collaborator extraction — phase 2, after loose bags prove the gate.
- Any code rewrite/optimization *inside* a move — forbidden; voids parity by construction.
- The write-back walk fix itself — it is a *consumer* of this capability (blocked-on it), landed after goal-host `index.ts` is spliceable.

## Verification

- **Unit (the safety property):** a pure move → `astEquivalent = true`, parity PASS; the *same* move plus any body edit/rename of a moved symbol → `astEquivalent = false`, parity FAIL. A moved test or a new `tsc` diagnostic → FAIL.
- **Live (bootstrap step 3):** run `apply-seam-extraction` + `verify-parity` on one handler group of `activities.ts`. Assert: a traced commit lands, `tsc` + full suite green, the file drops by exactly the extracted line count, zero behavior change. Then re-drive a small behavior edit that previously `no_op`'d against the file and confirm the drafter now splices the shrunken module — i.e. the fossil became self-editable.

## Risk

Low by construction. The gate can only BLOCK; an unprovable transform stays unlanded (fail-safe). The worst weak-model failure is a poor-but-valid cut — an ugly module boundary, re-cuttable later — never a regression, because behavior-neutrality is proven, not trusted.
