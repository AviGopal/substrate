# Design — substrate-self-replacement-pipeline

## A. Where the seed templates live

```
repos/development-vessel/src/seed/
├── audit-vessel-purity.ts
├── draft-replacement-vessel.ts
├── shadow-validate-replacement.ts
├── promote-replacement.ts
└── archive-vessel.ts
```

Each exports an `ActivityTemplate` from `@avigopal/ias-executor-ts`,
re-exported through `src/seed/index.ts` and appended to
`SEED_TEMPLATES`.

## B. The seven-item purity checklist

The audit step measures a vessel against:

1. **Single resolve endpoint.** Exactly one `POST /v2/impulses/resolve`
   that dispatches on `pointer.type`. No bespoke REST endpoints for
   single-use queries.
2. **Discovery-resident.** Calls `discovery-vessel/register` at boot;
   heartbeats every 60s; advertises every shape it owns.
3. **Identity-resident auth.** Validates credentials via
   `identity-vessel/v1/auth/resolve`; no local fallback validator;
   no direct DB validation against the `api_key` table.
4. **Domain-local shapes.** Owns shapes pertinent to its domain only;
   does not advertise shapes whose data lives elsewhere.
5. **LLM dispatch.** Any LLM call routes through a discovered vessel
   advertising `llm_completion`; the vessel source contains no
   imports from `@anthropic-ai/sdk`, `@ai-sdk/anthropic`,
   `@ai-sdk/openai`, or `openai`.
6. **Intent-tagged traces.** Every resolve emits a trace carrying at
   least one `intent:` tag.
7. **Standard template structure.** Matches
   `docs/architecture/TYPESCRIPT_VESSEL_TEMPLATE.md` for file layout:
   `index.ts`, `src/resolvers/<shape>.ts`, `src/discovery-
   registration.ts`, `src/auth.ts`.

Each check is deterministic and runnable against source + registry
data alone. The audit emits one entry per check with `severity:
high|medium|low` and a `replacement_scope` predicate naming whether
the gap can be addressed by adding shapes, removing endpoints, or
requires a full rewrite.

## C. Why a separate audit step from forge-driven replacement

The forge already drafts vessels from contracts. The audit step is
necessary because the forge needs a *target contract* and a
*deviation report* — the contract tells it what to build, the
deviation report tells it which parts of the current vessel are
keepable vs. discardable. Without an audit, the forge would either
(a) reproduce the existing vessel's gaps, or (b) need to infer them
itself, which conflates concerns.

The audit is also reused by maintenance activities that don't
trigger replacement. A vessel with one minor gap may be reported but
not replaced; the report is still useful for tracking idiom drift
over time.

## D. Shadow validation: oracle vs. divergence-only

Two shadow-validation modes:

**Oracle mode** (default for C.1): the old vessel's output is the
ground truth. Every divergence is a replacement defect. Used when
the new vessel is meant to be a behaviorally-identical replacement.

**Divergence-only mode**: divergences are recorded but the old
vessel is not authoritative — the new vessel may intentionally
differ (e.g., adding a field). Used for replacements that improve
on the original. The operator declares the mode at pipeline launch.

C.1 uses oracle mode. C.2 (activity-vessel) likely uses oracle mode
plus a *known-additions* allowlist for fields the new vessel adds
intentionally. C.3 (goal-vessel) is more likely to need
divergence-only with a goal-completion oracle layered on top.

## E. Atomic swap semantics

Discovery-vessel's current registration is read-modify-write: a
client GETs a vessel, modifies the record, POSTs the update. For
replacement, we need atomic shape-ownership transfer — between the
read and the write, no calls to the shape should hit a half-updated
state.

Three options considered:

1. **Optimistic concurrency.** GET returns an `etag`; PATCH requires
   matching `etag` or fails. The promote-replacement task retries on
   conflict. Simple, but small windows of mixed routing during retry.
2. **Two-step transfer.** Discovery accepts a
   `POST /vessels/transfer-shape` that takes the shape name, old
   `vessel_id`, new `vessel_id`, and a `cutover_at` timestamp. The
   registry stores both routes until cutover, then flips.
3. **Discovery-level transaction.** Discovery accepts a small DSL of
   register/deregister/update operations and applies them atomically
   in-memory.

Default: option 1 (optimistic concurrency). It's the smallest change
to discovery-vessel and the retry window for shape-ownership
transfer is rare enough that brief mixed routing during a retry is
acceptable. If observed mixed-routing causes real failures, escalate
to option 2.

## F. Naming and org discipline

All vessels minted by this pipeline:

- **Repository**: `github.com/AviGopal/<vessel-name>`.
- **npm package**: `@avigopal/<vessel-name>`.
- **Vessel name format**: kebab-case, no `metabob-` prefix, no `bob`
  substring, descriptive of capability (e.g., `shell-vessel`,
  `activity-vessel`, `filesystem-vessel`).
- **CLAUDE.md / README.md**: zero references to `metabob` or `bob`
  outside of historical-context citations.
- **package.json `description`**: states the vessel's shape contracts,
  not its lineage from any prior implementation.

The draft step's prompt explicitly enforces these via a system
prompt under
`repos/development-vessel/src/seed/prompts/draft-replacement-vessel.md`.
If the LLM produces output containing the forbidden substrings, the
draft step rejects the response and retries with a stricter prompt.

## G. Task graphs (sketches)

### audit-vessel-purity

```
input_shapes:  [vesselReference]   # { vessel_id, source_path }
output_shapes: [vesselPurityReport]
tasks:
  1. fetch-registration       http_request   (discovery GET /vessels/:id)
  2. enumerate-source         fs_read         (recursive ls of source_path)
  3. check-1-endpoints        deterministic   (grep for non-resolve endpoints)
  4. check-2-discovery        deterministic   (search for register call)
  5. check-3-auth             deterministic   (search for identity-vessel call)
  6. check-4-shapes           deterministic   (compare advertised vs domain)
  7. check-5-llm-imports      deterministic   (grep forbidden imports)
  8. check-6-trace-tags       trace_query     (sample recent traces)
  9. check-7-structure        deterministic   (file-layout match)
  10. emit-report             memo            (assemble vesselPurityReport)
```

### draft-replacement-vessel

```
input_shapes:  [vesselPurityReport]
output_shapes: [replacementScaffold]
tasks:
  1. derive-contract          deterministic   (from report's advertised shapes)
  2. enforce-naming           deterministic   (compute new name, validate prefix-free)
  3. dispatch-forge           composition     (forge-vessel-for-shape with contract)
  4. emit-scaffold            memo            (scaffold path + metadata)
```

### shadow-validate-replacement

```
input_shapes:  [replacementScaffold, vesselReference]   # original being replaced
output_shapes: [shadowReport]   # roll-up of shadowDivergence impulses
tasks:
  1. start-replacement-provisional   http_request (register provisional)
  2. install-shadow-tap              shell_exec   (configure discovery to dispatch both)
  3. accumulate-traces               wait         (until min_shadow_traces or budget)
  4. analyze-divergence              deterministic (compute rate, flag categories)
  5. emit-shadow-report              memo
```

### promote-replacement

```
input_shapes:  [shadowReport, replacementScaffold]
output_shapes: [replacementPromotion]
tasks:
  1. precheck                  deterministic   (divergence ≤ threshold)
  2. operator-approval         human_resolver  (skipped if automated_mode=true)
  3. atomic-swap               http_request    (discovery transfer with etag)
  4. emit-promotion            memo
```

### archive-vessel

```
input_shapes:  [replacementPromotion, vesselReference]
output_shapes: [vesselArchive]
tasks:
  1. move-source               shell_exec      (mv repos/<old> repos/archive/...)
  2. remove-from-manifests     fs_write        (update super-repo .gitmodules etc.)
  3. freeze-registry-record    http_request    (discovery PATCH state=archived)
  4. emit-archive              memo
```

## H. Open design questions

**Q1. Should `audit-vessel-purity` itself be subject to its own
checklist?** Yes — the activity is implemented in dev-vessel which
already satisfies the checklist. The audit can target itself; that
trace becomes a regression check.

**Q2. What happens when the old vessel is still being called during
shadow validation but its source has been edited?** The pipeline
treats the registration record (not the source code) as the
authority. If the operator modifies the old vessel during shadow
validation, the pipeline emits a warning impulse and may abort.

**Q3. How does the pipeline handle vessels with state (e.g.,
activity-api's trace store)?** Shadow validation for read endpoints
is straightforward. For write endpoints, the replacement writes to
its own backing store; the shadow oracle compares only read
responses, and the operator decides when the new write store is
authoritative (typically by replaying writes against the new store
during shadow). This is why C.2 (activity-vessel) is a later
change with its own design discussion.

**Q4. Does the new vessel inherit posteriors from the old?** No.
Replacements start with fresh α/β under their new vessel-id. The
old vessel's posteriors are preserved in the archive for analysis
but do not transfer. This is intentional: the replacement is a
*different* vessel under Thompson, evaluated on its own evidence.

**Q5. Repo location during shadow?** The new vessel's source lives
under `repos/<new-name>-vessel/` from draft onward. After
promotion, it stays there. After archive, the old vessel moves to
`repos/archive/<old-name>-<date>/`.

## I. Failure modes

| Failure | `failure_mode.type` | Recovery |
|---|---|---|
| Audit cannot parse source (malformed) | `verifier_negative` | Operator-supplied source-path correction |
| Forge draft fails compile | `cascading` (upstream from forge) | Forge's existing recovery; retry on prompt revision |
| Naming check rejects LLM output | `safety_breach` (path/name prefix violation) | Retry with stricter prompt up to N times; then abort |
| Shadow divergence exceeds threshold | `verifier_negative` | Replacement abandoned; archive new under `repos/archive/<new>-failed-<date>/` |
| Discovery atomic-swap conflict (etag mismatch) | `cascading` | Retry up to 3 times with exponential backoff |
| Operator denies approval | `user_abort` | Replacement abandoned; new vessel deregistered; old vessel keeps serving |
| Archive cannot remove file (permissions) | `safety_breach` | Operator intervention required; pipeline halts |

## J. Trade-offs

**One pipeline vs. per-vessel-class pipelines.** Considered
specializing the pipeline by vessel kind (data-store vs.
compute-only vs. UI-adapter). Rejected for now: the seven-item
checklist applies uniformly, and divergent vessel kinds can be
handled via shadow-validation mode (D) rather than separate
pipelines. Revisit if the second canary (C.2) forces specialization.

**Atomic swap at discovery vs. routing fence at activity-api.**
Considered routing replacement traffic at the activity-api edge.
Rejected because discovery is the right locus — shape ownership is
its job. Routing fences would mean two truth sources for "who
resolves shape X."

**Replacement-by-vessel vs. replacement-by-shape.** Considered
replacing one shape at a time across vessel boundaries. Rejected
because vessels are the deploy unit and the registry unit; the
shape-level granularity makes the archive step messy. A vessel is
replaced wholesale; if only one of its shapes needs work, the
forge can still produce a vessel that owns only that one shape and
the rest stay where they are.

**Pipeline ribosome.** Should successful replacements feed the
ribosome at the maintenance horizon? Yes. Cross-vessel patterns
(e.g., "every API-style vessel replacement uses the same shadow
window") become higher-order templates the substrate accrues. This
is the "continual maintenance" property: the pipeline gets better
at running itself as evidence accumulates.
