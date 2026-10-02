# Foundation Compliance Checks

> Authoritative check-list for the `foundation-compliance` validator-as-activity —
> the gate standing between substrate-authored spec proposals and admission into
> the change tree.
>
> **Companion to:** [`docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`](architecture/IMPULSE_ACTIVITY_FOUNDATION.md)
> (cited throughout as **FND §N**).

---

## §A — Purpose and scope

### What this list does

The `foundation-compliance` validator is the gate that stands between
substrate-authored spec proposals (output of the `propose-spec`
activity, per closure-replacement-suite §B / §F) and admission into
the openspec change tree. Without a comprehensive predicate set, the
validator can only spot-check three indicative violations and let the
rest through. That makes substrate self-development unsafe: any
proposal that drifts from FND can land via the propose → apply →
archive loop unless an operator catches it by hand.

This document enumerates the predicates the validator MUST evaluate.
Each predicate is grounded in a specific section of the foundation
document (or another canonical doc), expressed as a substrate-evaluable
rule over the fields of a `proposedSpec` impulse, and carries a
severity that determines the validator's aggregate verdict.

### What this list does NOT do

- It does **not** evaluate proposals for correctness, novelty, or
  product-strategic fit. Those are operator/review concerns and remain
  out of band.
- It does **not** replace the substrate-closure-properties §27.3.j
  closure-audit. Foundation-compliance asks "does this proposal honour
  the four-primitive minimum and its derived rules"; closure-audit
  asks "does this proposal preserve substrate-resident execution of
  IAL §27.1/§27.2 properties". Both gates are required; neither
  implies the other.
- It does **not** evolve the foundation. Foundation evolution happens
  by operator-authored proposals that explicitly amend
  `IMPULSE_ACTIVITY_FOUNDATION.md`. Updates to *this* document
  (FOUNDATION_COMPLIANCE_CHECKS.md) are themselves spec proposals and
  are themselves subject to foundation-compliance — but the changeset
  type "amend the foundation" is permitted to extend or rewrite checks
  rather than be blocked by them.

### How the validator consumes the list

`foundation-compliance` is a validator-as-activity. Its input is a
`proposedSpec` impulse with fields `{ proposal_md, design_md,
tasks_md, specs_md, validation_status }`. Its tasks parse those
artefacts (markdown headings, fenced code blocks, declared shapes,
declared activities, declared vessels, cited foundation sections),
then iterate over the checks in §B below. Each check produces a
verdict tuple `{ check_id, status: pass | fail | not-applicable,
detail }`. Aggregation rules are in §C.

### Vocabulary

- **Substrate** — the deployed fleet of vessels (FND background;
  CLAUDE.md "Substrate-Aware Development"). All checks treat the
  proposal as substrate-issued unless explicitly operator-flagged.
- **Foundation primitive** — one of the four primitives named in
  FND §47 (impulse, pointer, resolver, vessel). All other constructs
  (activity, shape, lifecycle event, validator, trace, ribosome,
  Thompson posterior) are derived per FND §56–§65.
- **Shape** — concrete artifact is `pointer.type` plus its metadata
  (FND §37–§45). Shapes are not declared in a global registry; they
  are advertised by vessels via `config.discovery.shapes`.
- **Indicative checks** — the three checks pinned by
  closure-replacement-suite R6.4 (cite-foundation, declared
  input/output shapes, shape advertised by owning vessel). They are
  FC-001, FC-007, and FC-005 below; all other checks expand the set.

---

## §B — The check list

Twenty checks total. Severity legend:

- **REQUIRED** — failure blocks admission of the proposal.
- **RECOMMENDED** — failure produces a warning; proposal can still be
  admitted with operator review (verdict `needs_human` propagates
  upward).
- **INFORMATIONAL** — logged on the proposal record; never blocks.

### Primitive-level checks

---

**Check ID:** FC-001
**Title:** Foundation citation for primitive introduction
**Foundation citation:** FND §47–§55 ("Minimum Self-Stable Set"); the four primitives are impulse, pointer, resolver, vessel.
**Invariant:** A proposal that introduces a new primitive (i.e. a construct claimed to be irreducible to impulse/pointer/resolver/vessel) MUST cite the foundation section that admits it, OR explicitly propose a foundation amendment.
**Substrate-evaluable predicate:** Scan `proposal_md` and `design_md` for vocabulary indicating new-primitive introduction (`new primitive`, `irreducible`, `fifth primitive`, `cannot be expressed as`, headings like "New construct: X"). If any such marker is present, the file MUST contain a markdown link of the form `IMPULSE_ACTIVITY_FOUNDATION.md` (any anchor permitted) AND a sentence asserting which existing primitive the new construct extends OR a paragraph titled "Foundation amendment" or similar.
**Example violation:** A proposal "Introduce `cognition`, a new substrate primitive distinct from impulse and vessel" with no foundation reference.
**Example pass:** A proposal "Introduce `goal-frame`, an impulse subtype" with link to FND §47–§65 and a sentence explaining how `goal-frame` reduces to the impulse primitive.
**Severity:** REQUIRED

---

**Check ID:** FC-002
**Title:** Pointer-as-shape preserved
**Foundation citation:** FND §37–§45 ("Pointer-as-Shape: The Bootstrap Principle").
**Invariant:** Every learnable artefact introduced by the proposal MUST be addressable by a pointer with a typed `pointer.type` field; no learning posterior, no Thompson-keyed artefact, no resolver-dispatch table may be keyed on a side-channel REST field instead of on a shape.
**Substrate-evaluable predicate:** For each new shape, posterior, or learning structure declared in `design_md` or `specs_md`, verify that the declaration references the artefact's `pointer.type` (or `shape`) as its primary key. Reject declarations that key on a REST path, HTTP query parameter, or in-memory tuple as the canonical identifier of a learnable construct.
**Example violation:** "Track per-endpoint success rates via `GET /v2/activities/:id/score` keyed by URL path."
**Example pass:** "Track per-endpoint success rates via `endpoint_score` shape, resolved through `POST /v2/impulses/resolve`."
**Severity:** REQUIRED

---

**Check ID:** FC-003
**Title:** Resolvers live where data lives
**Foundation citation:** FND §226–§264 ("Vessels: Bundles of Capabilities"); design principle 3 (FND §920).
**Invariant:** A new resolver introduced by the proposal MUST live in the vessel that owns the underlying data or capability. The backend (activity-api) may resolve only trace-store, template, and learning-posterior shapes; it MUST NOT acquire resolvers for arbitrary external data.
**Substrate-evaluable predicate:** For each new resolver declared in the spec, locate its owning vessel (declared via `Owner` field in design-table or `config.discovery.shapes` block). If the owning vessel is `activity-api`, the resolved shape MUST be in the allowed family: trace, template, posterior, metric, audit-report, goal-path, composition-edge, or another shape category named in FND §720–§756. Otherwise the check fails.
**Example violation:** "activity-api will own a new `weather_data` resolver that calls the OpenWeather API."
**Example pass:** "A new `weather-vessel` will own the `weather_data` resolver; activity-api stores only the resulting traces."
**Severity:** REQUIRED

---

**Check ID:** FC-004
**Title:** No universal-resolver anti-pattern
**Foundation citation:** FND §263–§264, §717–§756 ("The Backend's Role"); CLAUDE.md "Red flags".
**Invariant:** The proposal MUST NOT introduce a new REST endpoint that resolves arbitrary shapes (i.e. a generic dispatcher routing on a body field that is not `pointer.type` via the canonical `/v2/impulses/resolve` path).
**Substrate-evaluable predicate:** Scan declared HTTP endpoints. Reject endpoints whose handler text describes "given `kind`, dispatch to N handlers" or "router on `query.type`" unless the endpoint IS `/v2/impulses/resolve` (the one allowed dispatch surface). Single-shape endpoints are fine; one-endpoint-per-shape patterns are fine; multi-shape endpoints that bypass the impulse-resolver dispatch are not.
**Example violation:** A new `POST /v2/data/get` endpoint that switches on `request.kind` to fetch different data types.
**Example pass:** A new `POST /v2/impulses/resolve` handler for a new shape, OR a single-purpose `GET /v2/weather/current`.
**Severity:** REQUIRED

---

### Shape-contract checks

---

**Check ID:** FC-005
**Title:** New shapes advertised by an owning vessel
**Foundation citation:** FND §43, §226–§289 ("Vessels"); closure-replacement-suite R6.4(c).
**Invariant:** Every new shape declared in the spec MUST appear in some owning vessel's `config.discovery.shapes` array (or its source-of-truth equivalent in the vessel's discovery contract).
**Substrate-evaluable predicate:** Extract the set of new shape identifiers declared in `design_md` / `specs_md` (markdown table rows, `Shape:` headings, fenced TypeScript blocks of the form `type FooShape = { ... }`). For each, confirm the proposal text names an owning vessel AND either (a) lists the shape under that vessel's `config.discovery.shapes` block in the proposal, or (b) declares a tasks-level requirement that the vessel be updated to advertise it.
**Example violation:** "Introduce `cargoManifest` shape" with no vessel taking ownership.
**Example pass:** "Introduce `cargoManifest` shape; `freight-vessel` will advertise it via `config.discovery.shapes += ['cargoManifest']` (tasks §4.2)."
**Severity:** REQUIRED

---

**Check ID:** FC-006
**Title:** Shape body schema declared
**Foundation citation:** FND §94–§122 (Impulse interface).
**Invariant:** Every new shape MUST declare its body schema (the structure of the resolved content) in the spec, either as a TypeScript interface, a SurrealDB schema, or a structured table.
**Substrate-evaluable predicate:** For each new shape, locate either (a) a fenced `ts` / `typescript` / `sql` code block in `design_md` or `specs_md` near the shape declaration containing a type definition referencing the shape name, OR (b) a markdown table titled or near the shape declaration with at least one field-name/field-type row pair.
**Example violation:** "Shape: `riskAssessment`" with no body description.
**Example pass:** "Shape: `riskAssessment { score: number, factors: string[], computed_at: string }`."
**Severity:** REQUIRED

---

**Check ID:** FC-007
**Title:** Activity input/output shapes explicit
**Foundation citation:** FND §126–§174 ("Activities"); closure-replacement-suite R6.4(b).
**Invariant:** Every new activity declared in the spec MUST have an explicit `input_shapes` (or `inputSchema.required`) and `output_shapes` (or `outputSchema.produces`) declaration. `input_shapes` MAY be empty; `output_shapes` MUST be non-empty (FND requires every activity to produce at least one output shape — otherwise the trace cannot feed the learning loop).
**Substrate-evaluable predicate:** Parse activity declarations from design tables and tasks.md. For each, confirm presence of both fields. Empty `input_shapes` is allowed (FND notes inputs are optional by default); empty/missing `output_shapes` is rejected.
**Example violation:** A new activity "`audit-traces`" with no `output_shapes` declaration.
**Example pass:** "`audit-traces` { input_shapes: [`auditWindow`], output_shapes: [`auditReport`] }."
**Severity:** REQUIRED

---

**Check ID:** FC-008
**Title:** Task resolvers reference registered resolver ids
**Foundation citation:** FND §147–§164 (Activity tasks); FND §692–§711 ("LLMs Are One Component Among Many").
**Invariant:** Every task in a declared activity MUST reference a resolver by id (e.g. `bash`, `git`, `llm`, `validation`, or any registered resolver-id). Tasks MUST NOT contain inline LLM-call code, inline shell strings as the sole task body, or anonymous callbacks. The resolver-id MUST either be a known vessel resolver OR be declared elsewhere in the same proposal as a new resolver registration.
**Substrate-evaluable predicate:** For each task block in design/specs, locate a `resolver:` field. Verify the value is a non-empty string. Cross-reference against a known-resolver allow-list (compiled from `repos/ias-executor-ts/src/`, and any new-resolver registrations in the same proposal).
**Example violation:** Task `{ id: "summarise", code: "const out = await callClaude(...)" }`.
**Example pass:** Task `{ id: "summarise", resolver: "llm", prompt: { template: "..." } }`.
**Severity:** REQUIRED

---

**Check ID:** FC-009
**Title:** Resolver tier classified
**Foundation citation:** FND §692–§711, FND §337–§349 (Performance Tracking); CLAUDE.md "Resolver Tiers" (deterministic / pattern / llm).
**Invariant:** Every new resolver introduced by the proposal MUST declare its tier: `deterministic`, `pattern`, or `llm`. This is required so the learning loop can stratify cost and reliability per tier (CLAUDE.md, RESOLVER_TRACKING.md).
**Substrate-evaluable predicate:** For each new resolver declaration, locate a `tier:` / `resolver_tier:` field with one of the three allowed values.
**Example violation:** "Introduce `pdf-extract` resolver" with no tier.
**Example pass:** "Introduce `pdf-extract` resolver, tier: `deterministic`."
**Severity:** REQUIRED

---

### Trace and learning checks

---

**Check ID:** FC-010
**Title:** Activities emit traces
**Foundation citation:** FND §408–§471 ("Record Trace", "Learn"); design principle 5 (FND §928).
**Invariant:** Every new activity MUST emit an execution trace through the standard activity-api trace-write path (`activityExecutionTrace_write` or successor). Activities that explicitly opt out of trace emission MUST justify the exception with a foundation citation.
**Substrate-evaluable predicate:** For each new activity declaration, either (a) confirm the activity uses the standard executor (no `traceEmission: "skip"` or equivalent), or (b) if trace emission is suppressed, confirm presence of an inline justification linking to a FND section that permits it (currently none does, so suppression is effectively forbidden).
**Example violation:** "Activity `quick-ping` does not emit traces because it runs every second."
**Example pass:** Activity declared without a suppression flag; OR activity declared with a foundation-cited justification (e.g. a future foundation amendment permitting low-signal trace skipping).
**Severity:** REQUIRED

---

**Check ID:** FC-011
**Title:** Two-direction learning duality preserved
**Foundation citation:** FND §475–§490 ("Two-Direction Learning Duality").
**Invariant:** A proposal that introduces a new Thompson-keyed posterior, composition-edge, or relevance score MUST update BOTH the forward arm (`P(success | activity X resolves pointer of shape Y)`) and the reverse arm (`P(success | activity X chosen given pool shapes {A,B,C})`), OR explicitly note the asymmetry and justify it. Single-arm posteriors degrade the recall/learning cycle (FND §488).
**Substrate-evaluable predicate:** Scan `design_md` for vocabulary indicating new posterior or learning structure (`alpha`, `beta`, `posterior`, `thompson`, `relevance score`, `composition edge`). For each occurrence, verify the proposal explicitly enumerates both write sites (forward and reverse) OR includes a paragraph titled or referencing "asymmetry justification".
**Example violation:** "New `endpoint_relevance` posterior, written when activity succeeds with the endpoint." (forward only, no reverse arm)
**Example pass:** "New `endpoint_relevance` posterior, written on success (forward) and on selection-given-pool (reverse), per FND §477–§488."
**Severity:** REQUIRED

---

**Check ID:** FC-012
**Title:** Trace structure standard fields
**Foundation citation:** FND §411–§457 (trace schema); CLAUDE.md "Execution Trace Model".
**Invariant:** If a proposal introduces a new trace variant, the variant MUST carry at minimum: `trace_id`, `activity_id`, `input_impulses`, `tasks`, `output_impulses`, `outcome { success, duration_ms, cost_usd }`. New variants MAY add fields; they MUST NOT rename or remove the standard fields without a foundation amendment.
**Substrate-evaluable predicate:** For each new trace-variant declaration, parse the schema block and verify presence of the required field names (or their documented aliases).
**Example violation:** A new "lightweight trace" variant that omits `outcome.cost_usd` to save space.
**Example pass:** A new "extended trace" variant that adds `extended.semantic_summary` while preserving all standard fields.
**Severity:** REQUIRED

---

### Closure and dependency checks

---

**Check ID:** FC-013
**Title:** External dependencies declare substrate-resident replacement
**Foundation citation:** FND §263 (backend is not universal resolver); `2026-04-26-impulse-activity-loop` §27.3.j (substrate-closure-properties); closure-replacement-suite §F.
**Invariant:** A proposal that introduces or expands a dependency on an external tool (operator-memory, slash-skills, subagents, github-actions, operator-shell, operator-spec-authoring, or any other external service) MUST name the substrate-resident replacement OR explicitly state that the dependency is permanent and justify it.
**Substrate-evaluable predicate:** Scan proposal/design for references to external tools (matching the list in closure-audit script §G). For each reference that is not a bootstrap-only acknowledgement, confirm presence of either (a) a named replacement vessel/activity/shape that takes over the responsibility post-bootstrap, or (b) an explicit "permanent dependency" paragraph with justification.
**Example violation:** "Proposal uses operator-shell for every deployment step" with no `deploy-substrate` activity (or equivalent) named as replacement.
**Example pass:** "Bootstrap-only: uses operator-shell during initial install; replaced by `deploy-substrate` activity post-bootstrap (closure-replacement-suite §B)."
**Severity:** REQUIRED

---

**Check ID:** FC-014
**Title:** Closure-replacement contract consistency
**Foundation citation:** closure-replacement-suite spec §R1–§R10.
**Invariant:** A proposal that modifies a closure replacement named in closure-replacement-suite (e.g. `verify-merge-candidate`, `propose-spec`, `apply-spec`, `archive-spec`, `cleanup-docs`, `review-pr`, `audit-security`, `deploy-substrate`, `cron-dispatch`) MUST update the named contract rather than introducing a parallel surface.
**Substrate-evaluable predicate:** For each activity-id named in closure-replacement-suite §B / §C, if the proposal mentions or modifies behaviour in that domain, verify the activity is referenced by id rather than re-declared under a new id.
**Example violation:** A proposal introducing a new `run-tests-and-merge` activity that duplicates `verify-merge-candidate`.
**Example pass:** A proposal that extends `verify-merge-candidate` by adding a new check task to its existing contract.
**Severity:** RECOMMENDED

---

### Routing and dispatch checks

---

**Check ID:** FC-015
**Title:** Pointer-typed dispatch (no untyped routing)
**Foundation citation:** FND §37–§45, FND §233 (resolvers dispatch on `pointer.type`).
**Invariant:** New resolver-dispatch logic MUST key on `pointer.type` (or its documented alias `shape`). Dispatch that switches on a free-form string field, a regex over content, or a numeric tag is rejected.
**Substrate-evaluable predicate:** For each new dispatch logic declared in `design_md`, locate the switch key. Pass if key is `pointer.type` / `pointer.shape` / `impulse.metadata.shape`; fail otherwise.
**Example violation:** "Dispatcher reads `impulse.body.kind` to decide handler."
**Example pass:** "Dispatcher reads `pointer.type` to decide handler."
**Severity:** REQUIRED

---

**Check ID:** FC-016
**Title:** No single-use REST endpoints
**Foundation citation:** FND §735–§756 (Minimal Backend API); CLAUDE.md "Red flags" ("Adding new REST endpoints for single-use queries").
**Invariant:** New REST endpoints for queries that could be expressed as a shape and resolved via `POST /v2/impulses/resolve` MUST instead be expressed as shapes. Exception: mutations that fundamentally cannot be modelled as a resolved impulse (e.g. `/v1/auth/login` issuing a session) MAY remain REST.
**Substrate-evaluable predicate:** For each new `GET /v2/...` or `POST /v2/...` endpoint declared, classify as either (a) a query (read-only, parameterised by id/filter) — these MUST be expressed as shapes, or (b) a mutation/auth endpoint — these are allowed. Single-use query endpoints fail; shape-resolution endpoints pass.
**Example violation:** "New `GET /v2/activities/:id/last-failure` endpoint."
**Example pass:** "New `lastFailure` shape resolved via `POST /v2/impulses/resolve` with `{ type: 'lastFailure', activity_id: '...' }`."
**Severity:** REQUIRED

---

### Improvisation and meta checks

---

**Check ID:** FC-017
**Title:** Improvisation paths record traces
**Foundation citation:** FND §548–§613 ("Improvisation: Wing It With Recording").
**Invariant:** A proposal that introduces a fallback/improvisation path (vocabulary: "improvise", "fallback", "ad-hoc", "when no activity matches") MUST require the path to emit a trace tagged as improvisation, so the ribosome can extract patterns. Silent fallbacks are rejected.
**Substrate-evaluable predicate:** Scan proposal for improvisation vocabulary; for each occurrence, verify a nearby paragraph or task declares trace emission for the improvisation path.
**Example violation:** "If no activity matches, dispatch a generic LLM call directly."
**Example pass:** "If no activity matches, dispatch a generic LLM call AND emit an `improvisation_trace` for ribosome extraction (FND §602–§612)."
**Severity:** RECOMMENDED

---

**Check ID:** FC-018
**Title:** LLM-only task graphs justify the absence of deterministic tasks
**Foundation citation:** FND §692–§711 ("LLMs Are One Component Among Many"); FND §936 (design principle 8); CLAUDE.md "all-LLM task graphs" (templateAuditReport red flag).
**Invariant:** Activities whose every task is `resolver: "llm"` are a known anti-pattern. The proposal MUST either include at least one non-LLM task, OR justify the all-LLM graph with a paragraph noting why no step can be deterministic (e.g. all inputs are ambiguous text).
**Substrate-evaluable predicate:** For each new activity, count the tasks by resolver tier. If all tasks are `llm`, look for a justification paragraph. Pass if non-LLM task exists OR justification is present; fail otherwise.
**Example violation:** A new activity with five tasks, all `resolver: "llm"`, no justification.
**Example pass:** A new activity with three LLM tasks and one `validation` task; OR all-LLM with explicit justification.
**Severity:** RECOMMENDED

---

**Check ID:** FC-019
**Title:** Implicit vessels named, not multiplied
**Foundation citation:** FND §265–§289 ("Implicit Vessels"); the foundation acknowledges two existing implicit vessels (ActivityExecutor, Thompson) and treats them as evidence of gaps to close, not patterns to expand.
**Invariant:** Proposals MUST NOT introduce new implicit vessels (resolver bundles that do not register with discovery and do not advertise shapes). Existing implicit vessels MAY be referenced; new ones require explicit foundation citation justifying why the construct cannot be a registered vessel.
**Substrate-evaluable predicate:** Scan for resolver-bundle declarations with no discovery-registration plan. If the bundle is named as one of the two existing implicit vessels (ActivityExecutor, Thompson), pass. If it is new and lacks a registration plan in tasks.md, fail unless an "Implicit vessel justification" paragraph cites FND §265–§289.
**Example violation:** A new "ribosome executor" that dispatches resolvers in-process without registering with discovery.
**Example pass:** A new "ribosome vessel" that registers with discovery and advertises its shapes.
**Severity:** REQUIRED

---

**Check ID:** FC-020
**Title:** Recall and learning motions not conflated
**Foundation citation:** FND §22–§34 ("Three States, Two Motions"); FND §477.
**Invariant:** A proposal MUST NOT describe a code path that performs recall (i → t → o, applying existing structure) and learning (o → t → i, minting structure) within a single non-decomposable operation. Code paths that update posteriors WHILE selecting are flagged.
**Substrate-evaluable predicate:** Scan `design_md` for sentences that conjoin selection vocabulary (`sample`, `recommend`, `select activity`, `Thompson-pick`) with update vocabulary (`increment α`, `update posterior`, `write back`, `record success`) in the same paragraph without an explicit lifecycle separation. Pass when the paragraph either separates the motions explicitly OR names the lifecycle event between them (`task.completed`, `execution.succeeded`).
**Example violation:** "Sample the activity AND increment α inline in the recommendation handler."
**Example pass:** "Sample the activity (recall). After execution completes, the trace-emitter increments α (learning, on `task.completed`)."
**Severity:** RECOMMENDED

---

## §C — How the validator uses this list

### Verdict computation

The `foundation-compliance` validator runs the checks in order. Each
produces `{ check_id, status, detail }`. Aggregation:

1. If any **REQUIRED** check has `status: fail`, the aggregate verdict
   is **`fail`**. The `validationResult.failures[]` array carries one
   entry per failing REQUIRED check.
2. Else if any **RECOMMENDED** check has `status: fail`, the aggregate
   verdict is **`needs_human`**. The `validationResult.warnings[]`
   array carries one entry per failing RECOMMENDED check. The proposal
   may still be admitted after operator review marks the warnings
   addressed.
3. Else if any **INFORMATIONAL** check has `status: fail`, the
   aggregate verdict is **`pass`** with the informational failures
   logged in `validationResult.notes[]`.
4. Otherwise the aggregate verdict is **`pass`**.

Currently this document declares zero INFORMATIONAL checks; the
category is reserved for future additions where evidence is desired
but no admission consequence is wanted yet.

### Check-list evolution

The check list is itself a substrate-maintained artefact. Adding,
removing, or modifying a check is a spec proposal that runs through
`propose-spec` and is itself subject to `foundation-compliance`.
Foundation-amendment proposals (changes that explicitly amend
`IMPULSE_ACTIVITY_FOUNDATION.md`) MAY adjust or remove checks; other
proposals MAY add checks but MUST NOT remove or weaken existing
REQUIRED checks without a paired foundation amendment.

### Operator overrides

A proposal that fails REQUIRED checks may still be admitted with an
operator override recorded as an `operatorOverride` impulse carrying
the reason and the operator's identity. The override is recorded on
the proposal trace; subsequent foundation-compliance runs against
proposals that cite the overridden proposal as precedent MAY surface
the override in their `notes[]`.

---

## §D — Open / hard checks (operator judgment only)

The following invariants from the foundation document are real and
load-bearing but resist substrate-evaluable formulation today. They
remain operator-review concerns. Future updates to this document MAY
promote them to §B as the substrate's parsing capacity grows.

### O-001 — Pattern extractability

**Foundation citation:** FND §946–§960 (Implementation Alignment Checklist, "Can this pattern be extracted and reused?").

**Why operator-only:** Determining whether a proposal's pattern is reusable requires reasoning about the abstract structure of the workflow against the system's accumulated pattern library. Substrate-evaluable predicates can spot syntactic markers (declared `output_shapes`, presence of a ribosome path) but not semantic reusability.

### O-002 — Search-space reduction

**Foundation citation:** FND §492–§521 ("Reduce Search Space").

**Why operator-only:** A proposal's actual contribution to search-space reduction depends on the empirical distribution of inputs the substrate will see. The validator can confirm shapes are declared; it cannot confirm those shapes will narrow recall meaningfully.

### O-003 — Backend-as-trace-store discipline (semantic)

**Foundation citation:** FND §263–§264, §717–§756.

**Why operator-only:** FC-003 and FC-004 catch syntactic violations (resolver ownership, generic-dispatch endpoints). But a proposal that technically routes through `/v2/impulses/resolve` while semantically using activity-api as a general-purpose data fetcher (e.g. resolving shapes that have no learning loop attached to them) requires human judgment about intent.

### O-004 — Closure-property impact estimation

**Foundation citation:** closure-replacement-suite §R7–§R10 (closure-audit).

**Why operator-only:** Whether a proposal *strengthens* or *weakens* the substrate's closure relative to a given external tool requires synthetic-removal evaluation under the closure-audit harness. Foundation-compliance can name the dependency (FC-013); it cannot run the audit. The closure-audit script (closure-replacement-suite §G) runs independently and complements foundation-compliance.

### O-005 — Foundation-amendment soundness

**Foundation citation:** FND §47–§68 ("Minimum Self-Stable Set"); the foundation is "hypothesis under test", not declaration.

**Why operator-only:** When a proposal explicitly proposes to amend `IMPULSE_ACTIVITY_FOUNDATION.md` (changing one of the four primitives, adding a fifth, weakening pointer-as-shape, etc.), foundation-compliance can verify the amendment is declared (FC-001 partial); it cannot judge whether the amended foundation is still self-consistent. That judgment is operator-only and is the most consequential review the substrate's authors perform.

### O-006 — Vessel-collaboration vs vessel-nesting

**Foundation citation:** FND §321–§334 ("Vessels Collaborate, Not Nest").

**Why operator-only:** Detecting nesting (a vessel that "contains" another vessel rather than collaborating peer-to-peer with it) requires structural analysis of the proposed deployment topology. The validator can spot blatant ownership claims; subtler nesting (e.g. a vessel that uses another vessel only through a private channel) requires operator review.

---

---

## §E — Closure compliance checks (CC-001 through CC-007)

Closure checks verify that the substrate is not load-bearing on the seven external stateful dependencies enumerated in the substrate closure properties. Unlike FC-001..FC-020, which test individual code artifacts for foundation alignment, CC checks are system-level: they test whether removing an external tool breaks a substrate property.

The closure-audit script runs CC-001..CC-007 nightly and emits a `closureStatusReport` impulse. Three consecutive green runs across all seven checks are a hard prerequisite for lift approval.

---

**Check ID:** CC-001
**Title:** Operator memory closure
**Invariant:** Wiping `~/.claude/.../memory/` and restarting a Claude session does not cause loss of known substrate facts. The substrate resolves recalled facts via `memoryNote` queries rather than operator-side files.
**Test:** Wipe the operator-side memory cache. In a fresh session, query the substrate for three known facts via `memoryNote` resolver. Verify accuracy ≥ 80% (at least 2 of 3 facts recalled correctly from substrate alone, without the cache).
**Severity:** REQUIRED

---

**Check ID:** CC-002
**Title:** Slash-skill closure
**Invariant:** The workflows behind operator slash-skills (spec proposal, review, deployment) are executable as substrate activities without invoking operator-side harness skills. The substrate can drive its own development cycle end-to-end.
**Test:** Trigger `develop-vessel:propose-spec` as a substrate goal; verify the activity produces a valid `proposedSpec` impulse. Trigger `verify-merge-candidate` as a substrate goal; verify it produces a `ciAgreementReport` impulse.
**Severity:** REQUIRED

---

**Check ID:** CC-003
**Title:** Subagent closure
**Invariant:** Research and planning tasks (topology analysis, failure-mode investigation, gap analysis) are dispatched as substrate goals, not as operator-side subagent invocations.
**Test:** Dispatch `draft-gap-closing-activity` as a substrate goal (not via operator-spawned subagent). Verify the activity produces a candidate template without a subagent spawn event in the execution trace.
**Severity:** REQUIRED

---

**Check ID:** CC-004
**Title:** CI closure
**Invariant:** The substrate harness is the merge authority. It produces a `ciAgreementReport` that the CI pipeline accepts as its primary gate signal, without requiring manual operator approval for substrate-authored proposals.
**Test:** Confirm a substrate-authored PR has merged on harness-green with a `ciAgreementReport` as the gate signal and no manual approval event recorded on the merge.
**Severity:** REQUIRED

---

**Check ID:** CC-005
**Title:** Shell-access closure
**Invariant:** Restart and restore operations for substrate vessels are dispatched as substrate activities, not as `docker exec` or `kubectl` commands from the operator shell.
**Test:** Trigger `restart-vessel` activity for a named vessel from inside the substrate container (not via operator shell). Verify the vessel restarts and re-registers with discovery.
**Severity:** REQUIRED

---

**Check ID:** CC-006
**Title:** Spec-authoring closure
**Invariant:** At least three accepted proposals have substrate-authored provenance — authored by a substrate vessel, not the operator.
**Test:** Query the proposal trace store for `proposedSpec` impulses with `authored_by` set to a substrate `vessel_id` (not an operator identity). Verify count ≥ 3 and that each reached `validation_status: accepted`.
**Severity:** REQUIRED

---

**Check ID:** CC-007
**Title:** Git-access closure
**Invariant:** At least one commit, PR, and merge cycle has been completed by the substrate without operator git credentials. The substrate can write to its own source tree.
**Test:** Inspect merge history for a commit with `author.email` matching the substrate's `operator-vessel` registration identity. Verify the associated PR was opened and merged without operator-credential git operations.
**Severity:** REQUIRED

---

## References

- [`docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`](architecture/IMPULSE_ACTIVITY_FOUNDATION.md) — canonical foundation document; cited throughout.
- [`docs/architecture/RESOLVER_TRACKING.md`](architecture/RESOLVER_TRACKING.md) — resolver-tier definitions used in FC-009.
- **The adapter-layer principle** behind FC-004, stated here rather than cited so
  it outlives the product surface it was first written for: when a frozen
  dependency does not expose what a caller needs, the missing functionality lands
  in an adapter — a server-side composition of the endpoints that do exist, or a
  small vessel that calls the dependency as a client — and never as a patch to
  the frozen thing. Patching what you have declared frozen is how a boundary
  stops being one.
- [`CLAUDE.md`](../CLAUDE.md) — "Red flags" section feeding FC-001, FC-004, FC-016, FC-018.
