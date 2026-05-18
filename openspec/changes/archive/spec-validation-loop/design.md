## Context

The current activity system executes templates and records traces but has no mechanism for external specification — validation rules are either inline (requiredPatterns, forbiddenPatterns in the task JSON) or implicit (the LLM's own judgment). A completed activity does not guarantee goal satisfaction; there is no artifact representing "what was intended" that can be compared against "what was produced."

The ribosome pattern already shows that activities can produce `activity_template` shaped impulses. This design extends that: activities produce `specification` impulses, which are then transformed by subsequent activities into enforcement and validation templates. The specification is an external, addressable impulse that flows into validation activities rather than being embedded in them. This is the architectural separation that makes external verification possible.

## Goals / Non-Goals

**Goals:**
- Define seven composable activity templates that form a specification-validation loop
- Express the loop as a shape-typed composition — each activity's output shapes feed the next activity's input shapes
- Add budget and max-sequence stopping conditions to MiniBob `--single` mode
- Demonstrate correctness via a cellular automata web app test with playwright verification

**Non-Goals:**
- New vessel endpoints or schema migrations
- Persistent spec storage beyond what impulse resolution already provides
- Formal spec language (specs are freeform text/JSON; format is up to the defining activity)
- Integration with external spec tools (OpenAPI, JSON Schema validation libraries)

## Decisions

### Decision 1: Activities as the only new artifact type

**Chosen:** All seven new capabilities are expressed as embedded activity template JSON files in `repos/minibob/src/embedded-templates/`.

**Rationale:** The system already has the infrastructure to discover, rank, and execute templates. Adding new templates is additive and zero-risk. Alternatives — new resolver types, new vessel endpoints, new schema tables — all require vessel code changes and add complexity without benefit.

**Alternative considered:** Register templates at runtime via POST /v2/activities/templates to the canary backend. Rejected for initial implementation because embedded templates are always available without network and are version-controlled with the code.

### Decision 2: Specification shape is freeform

**Chosen:** The `specification` shape is untyped — content can be markdown, JSON, or natural language. The producing activity (define-specification) determines the format; consuming activities (spec-to-enforcement-activity) use LLM resolution to interpret it.

**Rationale:** Enforcing a schema for specifications requires upfront agreement on what a specification is, which defeats the purpose of learning from diverse goal types. Thompson Sampling will learn which specification formats lead to better enforcement and validation activities over time.

**Alternative considered:** JSON Schema as the canonical spec format. Rejected — too rigid for the goal types we anticipate (e.g., "create a cellular automata web app" doesn't naturally decompose into JSON Schema).

### Decision 3: Enforcement and validation as distinct activity_template outputs

**Chosen:** Step 2 produces an `activity_template` that *enforces* a specification (runs the code / verifies it meets the spec). Step 3 transforms that into a validation variant that is *idempotent and non-destructive* (only reads and reports, never writes).

**Rationale:** Enforcement activities may modify state (e.g., fix a failing test). Validation activities must be safe to run repeatedly without side effects. Separating them as distinct templates allows Thompson Sampling to learn their performance characteristics independently.

**Shape naming:** Both step 2 and step 3 outputs have shape `activity_template` (same as the ribosome). The semantic distinction (enforcement vs. validation) is carried in the template's metadata tags, not in a separate shape. This avoids proliferating shapes for a distinction that only matters to downstream orchestration.

### Decision 4: Stopping condition in MiniBob goal-processor

**Chosen:** Check budget and sequence count inside the goal-processor's dispatch loop, after each activity completes. Stopping propagates as a `GoalProcessingResult` with `stopped_reason: "budget" | "max_sequences" | "satisfied"`.

**Rationale:** The stopping condition is a concern of the goal-processor, not the activity executor. The executor shouldn't know it's in a loop. This keeps the activity executor stateless with respect to loop management.

**CLI flags:** `--budget <usd>` and `--max-sequences <n>` default to `Infinity` (preserve existing behavior). If not present in MiniBob's current CLI parser, add them.

### Decision 5: Synchronize step uses diff, not full rewrite

**Chosen:** The `synchronize-spec-validation` activity compares the current specification against the validation_mapping and produces a `sync_report` that describes divergence (new components not covered, outdated mappings, spec sections without corresponding validation). It does NOT rewrite the specification.

**Rationale:** Rewriting the specification on every sync loop risks specification drift and loss of original intent. The sync report is an observation; updating the specification is Step 5 (`update-specs-from-validation`), which only runs when the sync report indicates meaningful divergence.

### Decision 6: Loop convergence signal in sync_report

**Chosen:** `sync_report` includes a boolean `converged` field. The meta-activity `spec-validation-loop` checks this field and exits the loop when `converged: true`.

**Convergence criteria:** All mapped components pass their validation activities, and no unmapped components exist for the current specification scope.

## Risks / Trade-offs

- **LLM cost per loop iteration**: Each iteration calls LLM resolvers in define-specification, spec-to-enforcement, enforcement-to-validation, and update-specs-from-validation. Cellular automata demo at `--budget 2.00 --max-sequences 15` is a reasonable bound for a first run. → Mitigation: budget flag; Thompson Sampling will over time learn to skip LLM steps for well-known patterns.

- **Specification format instability**: Since specs are freeform, the spec-to-enforcement activity may produce inconsistent enforcement templates across runs. → Mitigation: The ribosome extracts successful patterns; over time the format converges via learning.

- **Validation activities may miss semantic intent**: Pattern-matching validators (requiredPatterns) can confirm a file exists or a string is present but cannot confirm the app *works*. → Mitigation: playwright verification at the test level provides the semantic check the internal validators cannot.

- **Circular dependency risk**: A validation activity that calls another activity that calls another specification could loop infinitely without the max-sequences guard. → Mitigation: stopping condition required; meta-activity must pass `--max-sequences` to the dispatcher.

## Migration Plan

1. Add seven embedded template JSON files to `repos/minibob/src/embedded-templates/`
2. Add `--budget` and `--max-sequences` flags to MiniBob CLI; add stopping condition to goal-processor
3. Run demonstration test: `minibob --single "Create a working cellular automata web app" --workdir /tmp/cellautomata-demo --budget 2.00 --max-sequences 15`
4. Verify with playwright_mcp: navigate to `file:///tmp/cellautomata-demo/index.html`, confirm the app renders and the simulation runs
5. Push to dev branch; CI/CD deploys to canary

No rollback needed — embedded templates are additive. Reverting is removing the JSON files.

## Open Questions

- Does MiniBob's current CLI already have `--budget` and `--max-sequences`? Need to check `repos/minibob/index.ts` before implementing.
- Should `spec-validation-loop` itself be a trajectory (workbench-editable) or only an embedded meta-activity? Deferring to post-demo iteration.
