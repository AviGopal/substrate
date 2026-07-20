# Design — vessel-maintenance parity gate

The gate is the whole safety story: it is what lets an arbitrarily weak generator drive
code maintenance without risking semantic regression. This document specifies it precisely
enough that its verdict is mechanical, then wires the surrounding activity family.

## 1. The transform under gate: seam extraction

A `seamExtraction` moves a set of top-level declarations out of a source file into a new
sibling module, leaving a re-export shim so every existing importer and in-file caller is
unaffected.

Input (`seamExtraction` shape):

```
{ file: "src/routes/activities.ts",
  symbols: ["scoreTemplate", "bucketContext", ...],   // top-level decls to move
  targetModule: "src/routes/activities.scoring.ts",
  rationale: "Thompson scoring helpers — cohesive, no shared mutable module state" }
```

The **applier** (`apply-seam-extraction`, ts-morph) performs exactly:

1. Move each named top-level declaration (fn / const / class / type / interface) verbatim
   from `file` to `targetModule`.
2. In `targetModule`, add the `import`s those declarations need (computed from their free
   identifiers) and `export` each moved declaration.
3. In `file`, delete the moved declarations and add `export { ... } from "./targetModule"`
   (a re-export shim) **iff** the symbol was part of the file's public surface OR referenced
   by remaining in-file code; add a plain `import { ... } from "./targetModule"` for symbols
   used only internally.
4. Touch nothing else. No reformatting of untouched lines, no reordering, no body edits.

The applier is deterministic given a `seamExtraction`; all *judgment* is in choosing
`symbols`/`targetModule` (the generator), and all *safety* is in the gate below.

## 2. The four parity checks (cheapest-first, all hard)

### 2.1 Public-surface parity (cheapest)

Compute the file's **export signature** before and after: the set of
`(exportedName, normalizedTypeSignature)` reachable from the module's public exports,
resolved through re-export shims. Byte-equal sets ⇒ PASS. This catches an accidental
export addition/removal or a signature drift in one cheap pass, before invoking `tsc`.

### 2.2 Type parity

`tsc --noEmit` on the vessel. Capture the diagnostic set as `(code, file, message)` tuples;
require the post-change set to be a **subset-or-equal** of the pre-change baseline (a fossil
may already have benign diagnostics; the gate forbids *new* ones, not pre-existing ones).

### 2.3 Test parity

Run the vessel's existing suite. Require: (a) the suite passes, and (b) the test files are
**byte-identical** to pre-change (a maintenance commit that edits a test is rejected outright —
test changes are a behavior signal and must be a separate commit).

### 2.4 Normalized-AST equivalence (the proof)

The strong check. Parse the pre-change `file` and the post-change `{file, targetModule}` set,
**normalize**, and require structural equality.

Normalization (canonical form `N(·)`):

- **Strip trivia:** positions, comments, whitespace, and semicolon/ASI variation.
- **Erase module-boundary artifacts:** delete `import` declarations and `export` *modifiers*
  and re-export (`export … from`) statements introduced by the applier; the *declarations*
  they carry remain and are compared by content. (Only shim edges are erased — a pre-existing
  import that changed is NOT erased and will surface as a difference.)
- **Flatten across modules:** `N(file_before)` is compared against
  `N(file_after) ⊎ N(targetModule_after)` as an **unordered multiset of top-level declarations**
  keyed by declaration name; each declaration's body is compared as a normalized subtree.
- **Bind-preserving:** identifier *references* must resolve to the same declaration in both
  worlds (a move must not capture a different binding). This is the one semantic check and is
  computed from ts-morph's symbol resolution, not by name-matching.

`astEquivalent = ( multiset of normalized top-level declarations is identical
                   AND every reference binds to the same target )`.

Any rewrite of a moved body, any rename, any reordering *within* a declaration, or any
rebinding ⇒ non-equivalent ⇒ FAIL. A pure move ⇒ equivalent ⇒ PASS. This is what makes the
generator's strength irrelevant to correctness: the gate proves the move was a move.

### Verdict

```
parityVerdict = { surfaceParity, typeParity, testParity, astEquivalent,
                  verdict: surfaceParity ∧ typeParity ∧ testParity ∧ astEquivalent,
                  failReason? }   // first failing check, human + machine readable
```

PASS → land a traced commit (`refactor(<vessel>): extract <targetModule> from <file> [parity-gated]`).
FAIL → roll back the working tree, write `failReason` onto the `spliceabilityGap`
(`classification_metadata.last_parity_fail`) so the next `propose-seam-extraction` is informed.

## 3. Where it lives / reuse (law 3)

- The gate sits in development-vessel's **feature_compose verify path**, *beside* the existing
  semantic cutover gate — same call site (`feature-compose.ts` verify), a sibling verifier
  selected by transform type. Behavior change → semantic gate; maintenance transform →
  parity gate. Neither is drafted into a fossil; both are small modules.
- Reuse the semantic gate's deterministic-first discipline: cheap checks (surface, type) gate
  before the expensive one (AST parse of a 12k-line file), and the AST parse itself is the only
  non-trivial cost — one ts-morph project load per attempt.
- No new REST endpoint; the transform, verdict, and gap are all shapes resolved through the
  existing impulse plane.

## 4. Generator tiers (weak-model discipline)

`propose-seam-extraction` is where model tier is a *learned shaped selection*, not a hardcode:

- **Loose bag (deterministic tier, no LLM):** files that are `N` independent handlers/functions
  with no shared mutable module state. The proposal is computed — group by existing route
  prefix / call-cluster / adjacency — and needs zero model calls. Covers ranks 1,3,4,5,8 of the
  census (the bulk of fossil mass).
- **God-class / cohesive unit (weak-LLM tier):** files where a collaborator must be *identified*
  (which fields+methods form an extractable helper). A cheap model proposes; the gate still
  proves. Covers ranks 2,6.

Because the gate is identical across tiers, escalation is free: try deterministic; if the
proposal is empty or its parity FAILs structurally, escalate to the weak model; reserve stronger
models only for repeatedly-failing god-classes. Tier is one shaped policy read at use time.

## 5. Data flow (one fossil, one seam)

```
drafter no_op/hollow on file F  ─▶ detect-spliceability-gap ─▶ spliceabilityGap{F, weight}
                                                                     │  (boredom selects when idle
                                                                     │   & weight high; ordering:
                                                                     │   before behavior work on F)
                                                                     ▼
                                          propose-seam-extraction (det | weak-LLM)
                                                                     │  seamExtraction{F, symbols, target}
                                                                     ▼
                                              apply-seam-extraction (ts-morph move + shim)
                                                                     │  working-tree diff
                                                                     ▼
                                    verify-parity ── FAIL ─▶ rollback + failReason onto gap ─┐
                                          │                                                   │
                                        PASS                                    (informs next proposal)
                                          ▼
                              traced refactor commit; F shrinks by extracted lines
                                          │
                                          ▼
                        F still > ceiling?  ──yes──▶ (gap stays open, next seam)
                                          │
                                         no ──▶ close spliceabilityGap; F is now drafter-spliceable
                                                 ▶ any behavior gap blocked-on F unblocks
```

Convergence: each PASS strictly reduces `F`'s line count and never regresses behavior, so the
loop is monotone toward spliceability. `λ₁` = PASS-commits per unit time; cheap generators keep
it above `ρ_grow`.

## 6. What this deliberately does not do

- It does not *improve* code — a maintenance commit is behavior-neutral by definition. Quality
  improvements to moved code are separate, semantic-gated behavior changes made *after* the file
  is spliceable (the point of decomposing first).
- It does not decide *whether* a file is worth splitting on size alone — that is the
  `spliceabilityGap` weight (realized edit-pressure), not this gate.
- It does not touch generated/deployed snapshots (`repos/deployment/vessels/**`); those are
  rebuilt from canonical `repos/*/src`, never hand-maintained.
