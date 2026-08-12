# The differentiation lever is viable, but only with a calibrated prompt

Measured 2026-08-12, immediately after the LLM plane was restored (OpenRouter
failover; see the `isFailoverError` repair). This is the gating measurement for
the proposed differentiation lever — **run before writing any of it**, because the
lever's entire value depends on one assumption that had never been tested.

## The assumption under test

The lever makes goal-target inference emit an **ordered step plan** rather than a
deduplicated set of shapes, so that two goals demanding different amounts of work
stop being the same object. It only produces differentiation if inference actually
returns a step count that **tracks the work the goal demands**.

The probe that proposed the lever flagged this as unsettled and named the negative
result precisely: *"step count is constant across rungs"* → the lever is wrong, and
*"step count varies but the per-step commands are identical strings"* → padded
steps, **worse than the status quo**, because it manufactures signature
differentiation without work differentiation.

## Result 1 — the naive prompt REFUTES the lever

Prompt: *"A transformation is one step that produces a value not already
available, from values that are. Reporting a value you already computed is NOT a
separate transformation."*

| rung | expected | measured | plan returned |
|---|---|---|---|
| 1 | 1 | **3** | discovery registry data → list of impulse shapes → number |
| 2 | 2 | **3** | List of strings → Integer → Memory Note |
| 3 | 3 | **3** | int → int → string |
| 4 | 4 | **4** | count shapes → count gaps → ratio → memory note |

**k = {3, 3, 3, 4}.** Three of four rungs collapse to the same count — the exact
negative result. Rung 1 is the tell: *"registry data → list of shapes → number"*
decomposes **one query** into its internal representations. The prompt ruled out
re-reporting a computed value and did not rule out the intermediate forms a single
operation passes through, so the model counted them.

Had the lever been built on this, it would have produced four signatures whose
step counts were 3, 3, 3, 4 — differentiating nothing between rungs 1–3 while
looking like progress.

## Result 2 — the calibrated prompt SATISFIES it

Two changes: anchor the unit on **external round-trips** rather than "values", and
rule out internal representations by name. Plus three worked examples.

| rung | expected | measured | operations returned |
|---|---|---|---|
| 1 | 1 | **1** | read discovery registry |
| 2 | 2 | **2** | read discovery registry; write memory note |
| 3 | 3 | **3** | read registry; read gaps; compare counts |
| 4 | 4 | **4** | read registry; read gaps; compute ratio; write note |

**n = {1, 2, 3, 4}.** Exact, and the operations are distinct external effects
rather than restatements — so this is work differentiation, not padding.

### The prompt that works

```
Count the DISTINCT EXTERNAL OPERATIONS a goal requires.

An external operation is one round-trip OUT of the process: reading a live
source, or writing a durable artifact.
These are NOT operations, they are internal to one:
  - parsing, filtering, deduplicating, or counting data you already fetched
  - formatting or phrasing an answer you already have
  - reporting a value you already computed
Arithmetic over values you already hold IS an operation only if it produces a
NEW value the goal asks for (e.g. a ratio).

Examples:
  "How many X does source S have? Report it." -> 1 (one read; counting and reporting are internal)
  "Count X in S, then save it to store T."    -> 2 (one read, one write)
  "Compare X from S with Y from T and say which is larger." -> 3 (two reads, one comparison producing a new value)

GOAL: <goal>

Return ONLY: {"n": <integer>, "ops": ["<one clause each>"]}
```

## What decided it

The word "transformation" is the defect. It invites counting *type changes*
(`data → list → number`), which is what a single query does internally.
"External operation, one round-trip out of the process" names a boundary the
model can locate in the goal text, and the three examples pin where that boundary
falls in the two ambiguous cases — a bare read, and arithmetic over held values.

## Standing caveat

This is a **four-goal, one-model, one-shot** measurement. It establishes that a
calibrated prompt *can* produce a tracking count on this ladder; it does not
establish stability across models, rephrasings, or goal families. Before the lever
ships, the same four goals should be re-run several times and against at least one
other model — an inference that returns 1,2,3,4 once and 2,2,3,4 next run gives
unstable signatures, which is its own defect.

The earlier ladder result (zero producer steps, rungs 1 and 3 sharing
`path_signature 4502429f46`) was measured **inside** the 43-hour 401 window and
remains contaminated. It must be re-run now the plane is live before any claim
about differentiation in the live walk is repeated.

---

## Stability run — the lever is DISQUALIFIED as a signature key

2 models × 2 phrasings × 4 rungs × 3 repetitions = 48 cells, 0 parse failures.

| model | phrasing | r1 | r2 | r3 | r4 |
|---|---|---|---|---|---|
| sonnet | original | 1 | 2 | 3 | 4 |
| sonnet | **rephrased** | 1 | 2 | **2** | **3** |
| haiku | original | 1 | 2 | 3 | **4/5/4** |
| haiku | **rephrased** | 1 | 2 | **2/2/3** | **3** |

- exact match to expected: **36/48**
- unstable across repetitions: **2/16 cells** — repeatability is fine
- **strictly increasing across rungs: 2/4 model-phrasing combos**

### Why it fails, and it is not randomness

Both monotonicity failures are **rephrasings of identical work**. The prompt's
worked example reads *"Compare X from S with Y from T and say which is larger →
3"*. The original rung 3 nearly matches that sentence and scores 3; the
rephrasing — *"Which is bigger right now: … Give both figures"* — scores 2. The
model is not counting operations, it is **matching the examples**, and the
examples were written from the original goals.

That is disqualifying for the purpose. A `path_signature` keyed on this count
would give two goals demanding **the same work but phrased differently** different
signatures — splitting identical goals, where the system today collapses distinct
ones. The mirror defect, not a repair. A differentiation key must be a function of
the work; this is a function of the wording.

### What survives

The count is ~75% accurate and highly repeatable, so it remains usable as a
*hint* — a prior, a log field, an input to selection. It is not usable as an
**identity**. The distinction is the finding: the earlier result ("calibrated
prompt gives 1,2,3,4") was true and insufficient, and only the rephrasing arm
showed why.

Had the lever shipped on the first calibration measurement, it would have produced
four distinct signatures on the ladder — reading as success — while assigning
different identities to identical work everywhere else.
