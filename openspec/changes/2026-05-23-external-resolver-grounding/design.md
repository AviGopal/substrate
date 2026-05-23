# Design — external-resolver-grounding

## Where the seed templates live

```
repos/development-vessel/src/seed/
├── probe-external-resolver.ts
├── synthesize-vessel-scaffold.ts
├── compile-and-smoke-test.ts
├── register-provisional-vessel.ts
└── promote-vessel.ts
```

Each exports an `ActivityTemplate` from `@avigopal/ias-executor-ts`,
re-exported through `src/seed/index.ts` and appended to
`SEED_TEMPLATES`.

## Why five templates, not one

The pipeline could be a single composite template, but five separate
templates buy three things:

1. **Independent measurement.** Probing is the noisy stage; scaffolding
   is the LLM-expensive stage; smoke-testing is the failure-rich stage.
   Splitting lets Thompson sampling learn each cost/success profile.
2. **Reusable subcomponents.** Drift response (out of scope here) needs
   to re-run probe → scaffold → smoke without re-registering; existing
   templates compose.
3. **Failure-mode locality.** A scaffold that compiles but fails smoke
   tests should emit a distinct `failure_mode` from a scaffold that
   never compiled. Distinct templates → distinct failure attribution.

The cost is more registry surface and more inter-step impulse plumbing.
Worth it for the loop's introspectability.

## Why a separate llm-dispatch hop

Step 2 (synthesise) needs a language model. Per dev-vessel discipline
(`repos/development-vessel/CLAUDE.md`), TypeScript in dev-vessel is
deterministic-resolver-and-dispatch-only; LLM calls go through a
discovered vessel that advertises `llm_completion`. The
`llm_completion_dispatch` resolver added in
`2026-05-22-failure-mode-autonomous-loop` DEV-2 is reused verbatim.

## The discovery-vessel schema change

`POST /register` payload gains:

```typescript
{
  // ... existing fields ...
  provisional?: boolean;            // default false
  provisional_since?: string;       // ISO timestamp, set on first
                                    // provisional register; cleared
                                    // on promotion
  promotion_criterion?: {           // captured at registration so the
    min_traces: number;             // promote-vessel template can read
    min_success_rate: number;       // it without out-of-band config
    max_shape_drift: number;
  };
}
```

The registry record stores all three fields. `discover-by-shapes
candidates_with_scores` mode applies a configurable down-weight to
provisional matches (default factor 0.5×) so they're sampled but not
preferred. The down-weight is a discovery-vessel config value, not
per-vessel.

## Task graphs (sketches)

### probe-external-resolver

```
input_shapes:  [resolverCandidate]
output_shapes: [probeReport]
tasks:
  1. extract-descriptor       fs_read | http_request  (OpenAPI fetch if URL given)
  2. plan-probes              llm_completion_dispatch (generates probe battery)
  3. execute-probes           iteration over http_request
  4. analyze-responses        deterministic   (infer shapes from JSON structure)
  5. emit-report              memo            (assemble probeReport)
```

### synthesize-vessel-scaffold

```
input_shapes:  [probeReport]
output_shapes: [vesselScaffold]
tasks:
  1. load-template-doc        fs_read         (TYPESCRIPT_VESSEL_TEMPLATE.md)
  2. draft-source             llm_completion_dispatch
  3. write-files              fs_write        (loops over generated files)
  4. emit-scaffold            memo            (paths + file list)
```

### compile-and-smoke-test

```
input_shapes:  [vesselScaffold]
output_shapes: [scaffoldHealth]
tasks:
  1. install                  shell_exec      (bun install)
  2. lint                     shell_exec      (bun run lint)
  3. test                     shell_exec      (bun test)
  4. boot                     shell_exec      (start vessel on ephemeral port)
  5. probe-self               iteration over http_request
  6. shape-conform-check      deterministic   (responses match probeReport)
  7. shutdown                 shell_exec
  8. emit-health              memo
```

### register-provisional-vessel

```
input_shapes:  [vesselScaffold, scaffoldHealth]
output_shapes: [provisionalRegistration]
tasks:
  1. precheck                 deterministic   (scaffoldHealth.passed?)
  2. register                 http_request    (POST discovery /register with provisional=true)
  3. emit-registration        memo
```

### promote-vessel

```
input_shapes:  [provisionalRegistration]
output_shapes: [vesselPromotion]
tasks:
  1. fetch-traces             http_request    (GET /v2/activities/execution-traces?vessel_id=…)
  2. compute-stats            deterministic   (success rate, shape drift)
  3. decide                   deterministic   (apply promotion_criterion)
  4. promote                  http_request    (PATCH discovery /vessels/:id provisional=false)
  5. emit-decision            memo
```

## What does NOT change

- minibob's binding layer needs no code change; it already sees
  provisional vessels through `discover-by-shapes` and the
  down-weighting is enforced inside discovery-vessel's scoring.
- activity-api's trace schema is unchanged; the `vessel_id` field
  already exists.
- No new shape resolver is needed in activity-api; the new shapes
  (`probeReport`, `vesselScaffold`, etc.) live as in-flight impulses
  during pipeline execution and are not persisted as activity-api
  rows.

## Trade-offs considered

**Hand-author the first vessel vs. dogfood from day 1.** We could
hand-author `perplexity-vessel/` and only build the pipeline afterward
"once we have an example." Rejected because the pipeline *is* the
example we're trying to validate — building it by hand first means
the pipeline is reverse-engineered from a fixed solution rather than
designed against the general case.

**One composite template vs. five.** See "Why five templates" above.

**Provisional flag on discovery-vessel vs. metadata on activity-api
trace rows.** Putting trust at the discovery layer is the right
locus because *selection* is where untrusted vessels do damage. A
trace metadata field would be too late — the trace already happened.

**Strict promotion threshold vs. continuous score.** Considered
keeping `provisional` as a continuous score that the binding layer
weights against. Rejected as premature; a hard threshold is simpler
to reason about and the down-weight factor already gives smooth
gradient. Can be revisited if promotion turns out to be too rigid.
