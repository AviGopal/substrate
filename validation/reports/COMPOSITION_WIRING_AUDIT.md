# Composition-wiring audit — why arbitrary complex goals flatten and never compose

Multi-agent audit (6 pipeline stages, each adversarially verified; 4/6 stage
findings completed — the walk-dispatch and ribosome finders hit the schema-retry
cap and were dropped). Every ranked blocker below carries a CONFIRMED adversarial
verdict. Live-verified refinement of blocker #1 added by the operator.

## Executive summary

The composition machinery physically exists but is **inert for the goals that
actually arrive**. Complex tasks are performed one of two non-chaining ways:

1. **Flattening.** A broad imperative/count/extract/aggregate goal class is
   deterministically collapsed at target-inference to a single sourceless
   `[shellResult]@0.6` by four verbatim pre-LLM shortcuts
   (`goal-target-inference.ts:362/381/396/416`) that return *before* the shape
   vocabulary or the LLM is consulted — then satisfier-resolved in one shell hop.
2. **One-shotting.** Any goal the walk cannot chain falls to the
   `universal-tool-fallback` **floor** — a single tool-enabled LLM agent loop with
   zero shape-graph composition — which persists `compositionChain:[]`
   (`index.ts:4159`) and is graded `reached:true` on **content alone**
   (`verifyGoalReached` called without `walkEvidence`, `:4132`).

A partial correction to the working hypothesis: `inferDerivationSplit` **does**
compute a real intermediate→terminal split that drives satisfier deferral in the
walk (`index.ts:9549→5535→7156`) — the structure is *not* computed-then-discarded.
It has nothing to act on because the graph has no edges for its targets.

## Where composition dies (two deaths — fixing only the earlier one is insufficient)

- **Earliest (dominant, ordinary-phrasing majority):** target-inference flattening
  at `goal-target-inference.ts:362` (+381/396/416) returns `{shapes:['shellResult'],
  confidence:0.6}` before the producible-shape vocabulary or LLM is consulted,
  foreclosing the ≥2-shape target `inferDerivationSplit` needs. Bypassed only by a
  narrow write-clause phrasing (`isCompositionAsk`, `:270`).
- **Most-decisive (bars composition even for well-phrased goals):** the shape graph
  has **no traversable chain to the dominant targets.** Backward-chain recursion
  (`index.ts:7793`) is gated on `inputShapes.length>0`; producers of
  `shellResult`/`memoryNote_write` declare `input_shapes:[]` (`paradigm.ts:990`
  omits `input_schema` when empty), and `shellResult` has zero declared consumers.

### Live refinement of the decisive blocker (operator, hub sample of 100 templates)

The graph is **not globally edgeless** — 22/100 templates declare non-empty input
shapes. But the edges are non-composing:
- `auto-bridge-*` consume `goal` / `goal,dispatch_id` → single-hop **entry**
  bridges from the goal, not producer→producer links.
- `composed-cap-*` consume a scan/report → produce bespoke
  `composedDeliverable_close_substrate_gap_*` **terminal** shapes, consumed by
  nothing.

So composition-extraction *did* mint some multi-input activities (the gap-closers),
but no intermediate shape is **both produced by one activity and consumed by
another**, and none chains to `shellResult`/`memoryNote_write`. The decisive claim
holds: no multi-hop chain exists for the shapes goals actually infer.

## Ranked composition-blockers (all CONFIRMED by adversarial verify)

1. **No traversable edge to the inferred targets.** Producers of the dominant
   targets carry `input_shapes:[]`; the existing edges are goal-entry bridges and
   dead-end bespoke deliverables. Decisive even when inference yields ≥2 shapes.
   `discover-by-shapes.ts:189` + `paradigm.ts:990`. *Fix:* seed one real edge — an
   activity B `input=[I] output=[T]` and a producer A `output=[I]` — so the query
   returns B and the `:7793` recursion adds I as a sub-target. The query is fine;
   the **data** is edgeless.
2. **Target-inference flattens** a broad goal class to sourceless `[shellResult]@0.6`
   before the vocabulary/LLM is consulted. `goal-target-inference.ts:362(+381/396/416)`.
   *Fix:* narrow the shortcuts to compute-with-no-derivation so genuine derivation
   goals reach the LLM composition rule (`:465`) and engage the ≥2-shape split
   (`:615`/`index.ts:9506`).
3. **The floor one-shots and locks it in.** `universal-tool-fallback` persists
   `compositionChain:[]` and records a single-element path replayed by
   `recommendReachingPath` *instead of* the walk. `index.ts:9963/4159/9784`. *Fix:*
   gate the reuse-before-derive shortcut so a single-step floor path doesn't preempt
   a walk that now has edges; stop persisting floor reaches as reusable pathways for
   families where a chained path exists.
4. **Composition credit is invisible to selection.** Chain-credit's
   `context_thompson_scores` write needs per-ancestor signatures no caller supplies
   (`ancestor_signatures` has zero populating callers), so credit lands only in the
   unconditional metrics — a composed pathway can never out-rank a single-shot one
   on the signature-conditioned key. `posterior-update.ts:1042/474/621`. *Fix:*
   populate `ancestor_signatures` at the `propagateCreditAlongChain` call site.
5. **Reach-judging is content-only.** No branch requires/records that N>0
   producer→consumer transformations occurred; the floor's reach gate omits
   `walkEvidence`, so a zero-producer answer passes the identical gate a composed
   walk would. `index.ts:2712/2988/4132`. *Fix:* pass `walkEvidence` into the
   floor's `verifyGoalReached`; make the hollow-walklog cap fail-closed for
   multi-shape targets.
6. **Nothing rewards a chain at selection time.** The composition graph is unread at
   selection (`composition-graph.ts:369`, zero callers) and successor-features ψ is
   default-off (`SF_BLEND=0`). *Fix:* wire the composition graph into recommend-time
   scoring or enable/feed ψ.

## Minimal change path — make ONE 2-transformation goal (I→T) genuinely compose

1. **Edges first.** Seed one real producer→consumer edge in the registry
   (B `input=[I] output=[T]`; A `output=[I]`). The only blocker phrasing can't work
   around.
2. **Two-shape target.** Get inference to emit `[I,T]` — either phrase as a
   write-clause composition ask (`isCompositionAsk`, already bypasses the flatten
   shortcuts) or widen the shortcut exemptions — engaging the ≥2-shape split.
3. **Don't preempt.** For a fresh, uniquely-phrased goal, neither the catch-all
   (`:9963`, fires only on walk failure) nor the reuse gate (`:9784`, only for a
   previously floor-reached family) preempts — no code change needed for the first
   run; confirm the family has no recorded floor path.

Steps 1–3 make it compose **once**. To make it **stick and be preferred** over the
single-shot floor: (4) populate `ancestor_signatures` (`posterior-update.ts:1042`);
(5) pass `walkEvidence` into the floor's `verifyGoalReached` (`index.ts:4132`).

## Caveats / open questions (honest scope)

- **2 of 6 stages unaudited** (walk-dispatch, ribosome) — exactly the middle the
  minimal path assumes works: that the walk, given a 2-shape target and a real edge,
  actually dispatches producers, binds shape-to-shape, and populates
  `composition_chain`. **This is the verification probe, not extra scope:** after
  step 1, dispatch a fresh-phrased 2-transformation goal and inspect the trace for a
  non-empty `composition_chain` and two producer steps with real output shapes.

### PROBE RESULT (2026-08-13): the executor middle WORKS; routing is the gate

Forced `target_template_id = composed-cap-close-substrate-gap-orphaned-capability`
(exec_joi8onzf). The trace ran **2 real `/pattern` steps** — #1 produced the
intermediate `orphaned_capability_scan`, #2 (`llm_completion_dispatch`) "format the
output into the goal's deliverable" — and `produced_shapes` held BOTH the
intermediate and the terminal `composedDeliverable_*`. Reach failed only on an
`authentication error` in the terminal content (environmental), NOT on composition.
**So the multi-step executor is functional** — the audit's unverified middle is not
the blocker. TWO limits keep this from being full composition-autonomy: (1) the
template was FORCED, not autonomously routed — target inference would have flattened
an NL goal to shellResult (#2); (2) the tasks recorded `∅ → ∅`, so data-flow between
steps is described, not hard-recorded. And it is a ribosome-minted COMPOSED TEMPLATE
running its baked-in chain, NOT proof of the walk DYNAMICALLY backward-chaining
across separate activities from a bare target (§4.2 proper) — inference-flatten gates
the path to that test. Net: composition EXECUTION is present; composition ROUTING
(inference→multi-shape target→dynamic assembly, blockers #1/#2) is the real gate.
- The "satisfier / single reused shell command / lexical rebind" frame was asserted,
  not independently re-traced here — UNVERIFIED in these findings (though heavily
  evidenced by live traces earlier this session).
- The "satisfier reaches persist no execution row" leg rests on a code comment
  (`execution-traces.ts:1177`), not executed code.

## ✅ END-TO-END COMPOSITION DEMONSTRATED ON AN ARBITRARY GOAL (2026-08-13, ZERO edits)

Baseline-first (advisor discipline): dispatched a fresh-nonce, composition-ask-phrased
arbitrary goal DIRECTLY to the local goal-host (:8210 — MCP routes via hub discovery
to the flaky :18401; direct dispatch gives a controlled local-journal instrument):
*"Scan the substrate for orphaned capabilities, then persist a summary of what the
scan found as a memory note."* No target_template_id, no pool seeding. Local journal
(goal_hash f11349f0):

- `inferred_target_shapes: [orphaned_capability_scan, memoryNote_write]` conf 0.9 —
  **inference did NOT flatten** (composition-ask phrasing bypasses the shortcuts, as
  predicted). `derivation-intent intermediates: intermediate=[orphaned_capability_scan]
  terminal=[memoryNote_write]` — the ≥2-shape split computed.
- `REACHED via 2-step chain`. Step 1 produced a REAL scan
  (`live_shape_count:322, invoked_resolver_count:398, capability_orphan_count:76`).
  Step 2's note body: *"Orphaned capability scan: 76 orphans found ... out of 322 live
  shapes and 398 invoked resolvers"* — **step 2 consumed step 1's output** (identical
  numbers). `composite constructed walk-composite-orphaned-capability-scan-to-memorynote-write`,
  `recordGoalPath chain=2 reached=true`.

**Meets the pre-registered criteria: reached + oracle-correct content + ≥2 steps
where step N+1 consumes step N's output — from an arbitrary NL goal, no forcing.**
So blockers #1/#2 (edgeless/flatten) do NOT bar this class: with composition-ask
phrasing and an intermediate that has a live resolver, the walk composes end-to-end.

**The remaining joint (does NOT block the demo, blocks COMPOUNDING):**
`WITHHELD alpha-credit for satisfier:memoryNote_write — no in-chain producer-to-consumer
edge`. The two steps are **vessel-resolve SATISFIERS**, not producer-tier activities, so
data flowed and the goal reached, but the walk does not credit this as a reusable
pathway. So it COMPOSES but does not yet COMPOUND — the credit/edge joint (audit defects
#2/#4, and the credit check requiring a declared producer→consumer edge rather than a
satisfier-chain that actually flowed data). That is the true "complete the wiring"
remainder: make a data-flowing satisfier-chain earn pathway credit (or make the steps
producer-tier), so the composite is learned and preferred next time.

### RE-RUN with recall available: 3/3 DISTINCT FAMILIES COMPOSE + EXTRACT

Re-dispatched the failed families when concept-db recall recovered (verified the
local `:8260/v2/impulses/resolve type:concept` call returns real rows). BOTH now
composed end-to-end:
- **vessel-health** (ec7d2f6e): 2-step reach; step1 real health report
  (analysis-vessel-local HTTP 200, 6 shapes); step2 note consumed it verbatim.
- **system-load** (8878ac7f): 2-step reach; step1 real load report
  (load 2.6/1.29/1.37, 14 cores, 37.7% mem); step2 note consumed the exact numbers.
- **`reach→mint: ran ribosome-extract`** for BOTH composites
  (`walk-composite-<intermediate>-to-memorynote-write`) — the LEARN stage engaged.

So THREE distinct arbitrary-goal families (orphaned-cap, vessel-health, system-load)
compose end-to-end + get extracted. The earlier 4/5 failure was **intermittent
concept-db recall**, not a structural inference/walk defect. IMPORTANT REFINEMENT of
the audits: this composition works via VESSEL-RESOLVE SATISFIERS — each intermediate
(`*_report`, `*_scan`) has a LIVE RESOLVER, so the walk satisfies it directly and
feeds it to the terminal. The audit's edgeless-graph / backward-chain-authoring
blockers apply to shapes that must be PRODUCED by a chain (no resolver); for the
large, useful class whose intermediates are resolver-served (reports/scans/counts),
composition already works end-to-end. Also observed: `pathway reuse: accepted 2-step
pathway via shape_signature ... borrowed_from_goal=... (10/10 reached)` — reuse fires.

### ✅ WIRING COMPLETED: composition is now recall-INDEPENDENT (2026-08-13, `45818d0`)

The last-turn gate (4/5 composition-ask goals failed on empty inference because
`concept-db could not be asked`) is closed. Landed `45818d0`:
- **(A)** `deterministicCompositionAsk` recovers `[intermediate, terminal]` from the
  shape names the goal uses, WITHOUT the LLM — folded into the `empty` constant so it
  fires ONLY where inference would otherwise return empty (recall-down / LLM-failed),
  never preempting the LLM path or its alternatives.
- **(B)** deterministic derivation split for the 3 emit sinks (memoryNote_write /
  concept_write / substrateGap_write) + a non-emit source, so the split survives
  recall-down too (excludes activityVariant_write).

Verified OFFLINE on the REAL functions + real 322-shape vocab (the recall-down path):
**12/12** — the 3 previously-failing families compose with correct split;
non-regression empty paths preserved; adversarials pass (no-named-shape→empty,
terminal-from-clause, concept-terminal, note→note refused, adjective-hijack refused).
An adversarial-verify workflow (diff-trace + 26-case battery) caught TWO real defects
before landing — a terminal-hijack (adjectival "concept-level" stealing the note sink;
fixed by reading the terminal from the LAST sink noun) and an Edit-B guard bypass
(fixed by excluding activityVariant_write). Live post-edit: recall-UP dispatch composes
end-to-end via the LLM path (@0.9, alternatives intact) — the fallback correctly
abstains, so no regression. NET: composition-ask goals now compose whether recall is
up (LLM) or down (deterministic route) — the offline 12/12 is the recall-down proof.

### COMPLEXITY-3 FAN-IN COMPOSITION (2026-08-13)

"Produce a vessel health report AND a system load report, then persist a combined
summary of both as a memory note" → inference `[vessel_health_report,
system_load_report, memoryNote_write]`@0.9, split into 2 intermediates + 1 terminal,
`REACHED via 3-step chain`. The note consumed BOTH sources' real values
(analysis-vessel-local healthy/HTTP 200 + load 2.72/1.5/1.37, 32.7% mem). A genuine
FAN-IN (two sources → one sink), oracle-satisfied. So composition extends past linear
2-step to multi-source complexity-3 for resolver-served intermediates. Also this
session: 3/3 arbitrary single-transformation goals in UNTESTED domains solved correct
(sha256, package.json field extraction, string reverse) — the walk cold-synthesized
the right command (sha256sum / jq / bun) each time, oracle-verified.

### THE LOOP CLOSES: compose → extract → REUSE (2026-08-13)

Reuse probe (fresh-nonce system-load goal, cf99e7d8): `pathway reuse: accepted
2-step pathway via shape_signature ... borrowed_from_goal=fdd43724 (10/10 reached)`
→ REACHED via 2-step chain with fresh data → `reach→mint: ran ribosome-extract`
again. So the substrate **reuses a learned 2-step pathway with a 10/10 reach
record** — the ceiling fires. Full loop for resolver-served-intermediate goals:
**compose end-to-end → ribosome-extract the composite → reuse the learned pathway.**

Reconciliation with the audits: the per-step alpha-credit is still WITHHELD
(satisfier steps) and the composite is tagged reached:false, yet the
`goal_execution_paths` row tracks the pathway as 10/10 reached and reuse prefers it
— so PATHWAY-grain learning works even where the finer context-conditioned posterior
(ancestor_signatures) does not. The audit's 6 joints are real but scoped to a
DIFFERENT class (intermediates with NO resolver, needing a produced chain); for the
large useful class of resolver-served intermediates (reports/scans/counts →
persist), the loop already composes, extracts, AND compounds — no edits.

### Battery (first run): 1/5 composed — the gate was INFERENCE-RECALL, intermittent

Five fresh composition-ask goals dispatched directly to the local goal-host:
- **orphaned-capabilities → memoryNote: COMPOSED + REACHED** (above). Inference
  matched `orphaned_capability_scan` deterministically (goal words ≈ shape name).
- **4/5 others FAILED at inference** (`vessel health`, `shape inventory`, `system
  load report`, `composition coverage report`): `inferred_target_shapes:[]
  confidence 0` → floor `exit=empty_loop` → reached:false. NOT flatten — EMPTY.

Root: `walk-concepts: concept-db could not be asked — recall unavailable`. Inference
falls back to narrow deterministic shape-name matching; the LLM/concept-recall path
that would map an arbitrary phrasing to a shape is DOWN (concept-db's SurrealDB
queries time out; goal-host's recall routes via discovery to the flaky hub). So the
routing gate is not "flatten to shellResult" here — it is "return empty unless the
goal literally names the shape," and that is currently a recall/transport
degradation, not a code defect in inference.

**Honest scope of the demonstration:** end-to-end composition on an arbitrary goal
is DEMONSTRATED (definitively, once — 2-step chain, data flow, reached,
oracle-correct content, zero edits, no forcing). It is NOT robust across arbitrary
phrasings: 4/5 fail at inference because concept recall is degraded. "Complete the
wiring" for ROBUST arbitrary-goal composition therefore reduces to two NON-walk
items: (a) restore/hardening inference recall (concept-db routing/transport — the
walk itself is fine), and (b) credit a data-flowing satisfier-chain so the composite
(currently constructed but tagged reached:false, alpha-credit withheld) is learned
and preferred. Neither is a defect in the executor, which composes when routed.

## The architecturally-defined solution (IMPULSE_STATE_SPACE_SPEC §4.2, §4.4, §5.3, §6)

The architecture does NOT solve the edgeless graph by an operator seeding an edge —
law 4 forbids that ("activities are earned by doing... an operator uploading a
hand-written template" is hollow). It defines a **self-growing composition loop**
where the walk grows its own edges:

1. **Backward-chaining (§4.2 / §4.4).** "When the producer selected for an unmet
   target declares input shapes the pool does not yet hold, the walk... adds those
   input shapes to the target set as sub-targets, defers the step, and re-discovers
   the producer once the pool covers its inputs. The chain is built backward from
   the goal toward what the pool already has." Composition IS this backward walk.
2. **Author-on-demand / bridge authoring (§4.2, §4.1 table).** "When a target shape
   is advertised by a live resolver but no activity produces it, the walk asks
   development-vessel to author and validate a producer for that shape against the
   shapes already in the pool. If authoring succeeds, the newly minted producer's
   own missing inputs are folded back in as sub-targets." A true capability gap
   (no resolver at all) files a gap for the authoring pipeline; a routing gap is
   solved by producing intermediates. **This is how edges appear without an
   operator.**
3. **Learn & reuse (§5.3, §6.1/6.3).** Record the `CompositionRecord`
   (`compositionChain`, `inputImpulseShapes`, `outputImpulseShapes`), weight the
   shape-transformation network (`v_shape_network(input_shape, output_shape,
   edge_weight)`), and reuse learned sequences via `activity WHERE input_shapes
   ALLINSIDE available_shapes ORDER BY thompson_score`. The ribosome extracts
   reached chains into reusable templates (the ceiling).

**So the audit's six blockers are precisely the six points where the running
implementation is disconnected from this spec:**

| Spec mechanism | Implementation disconnect (blocker #) |
|---|---|
| Backward-chain a producer's unmet inputs (§4.2) | Producers declare `input_shapes:[]`, so there are no unmet inputs to sub-target; recursion `index.ts:7793` never fires (#1) |
| Emit a ≥2-shape target to begin the chain (§4.4) | Inference flattens to `[shellResult]` before the vocabulary is read (#2) |
| Author-on-demand mints the missing producer (§4.2) | Authoring mints goal→X `auto-bridge` entry hops and bespoke `composedDeliverable_*` terminals, not reusable I→T edges; and the floor preempts the walk before authoring triggers (#3) |
| Substance-honest credit requires an in-chain producer→consumer edge (§4.4) | Reach is content-only; the floor omits `walkEvidence` (#5) |
| Record + reuse the composition (§5.3, §6.3) | The composition graph is unread at selection (`composition-graph.ts:369`, zero callers); chain credit's conditioned posterior needs `ancestor_signatures`, never populated (#4, #6) |

The architecturally-correct fix is to **repair the self-growing loop back to spec**,
not to hand-seed edges. The operator "seed one edge" step in the minimal path above
is the manual stand-in for §4.2 bridge authoring — useful only as a *test probe* to
confirm the walk chains once an edge exists; the durable solution is making
author-on-demand mint reusable intermediate edges and wiring the composition graph
into selection so the system grows and reuses its own chains.
