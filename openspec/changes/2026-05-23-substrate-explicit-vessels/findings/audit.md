# Audit Findings — 2026-05-23-substrate-explicit-vessels

agent: audit
spec: 2026-05-23-substrate-explicit-vessels
date: 2026-05-26
status: open

## Finding 1: concept-db's schema is not applied to substrate SurrealDB; PERMISSIONS clauses also use the wrong auth namespace

**Claim in spec**: Substrate-hosted concept-db is one of the vessels that "registers with discovery, advertises shapes, and resolves them via POST /resolve". The proposal treats concept-db as one of the explicit vessels that participates in the four-primitive model.

**Observed reality**: concept-db is structurally registered (discovery sees `concept-db-local` advertising 14 shapes) and `/health` passes, but **its SurrealDB schema has never been applied** on the substrate-live container. `INFO FOR DB activity-system.learning_loop` returns 140 tables; zero match `/concept/`. Every `POST /concepts` returns `400 — IAM error: Not enough permissions to perform this action` because concept-db's create handler runs `CREATE type::record("concept", $id) SET ...` against a table that does not exist, and the SurrealDB user concept-db is signed in as lacks DDL permission to auto-create.

A second, latent defect waits behind layer 1: the PERMISSIONS clauses in concept-db's schema source use `$auth.org_id` rather than `$token.org_id`. Per CLAUDE.md's documented F-V56 / F-V57 fixes (activity-api `variant_performance_metrics`, migration 129), JWT-token access populates `$token`, not `$auth`; `$auth` is empty for JWT auth, so the WHERE clause always evaluates false and create/update would still deny even after the table is defined.

**Gap type**: missing_idiom + coverage_gap

**Severity**: blocking — concept-db is mounted but cannot accept writes; the entire concept-substrate use-case (Cα/Cβ insertions from audit/operator, ribosome-extracted writes, seed-concepts.ts) is dead at the database layer. The validator's gap-001 ("concept-db not running as a systemd unit") was misattributed; concept-db *is* running. The actual gap is schema-not-applied + permissions-clause-using-$auth.

## Diagnostic evidence

**Schema-not-applied:**
```
$ jq -r '.[0].result.tables | keys[]' <INFO FOR DB result>  | grep -ciE concept
0
```

**Concept-db's create handler log (2026-05-26T02:41:19Z):**
```
INFO  [concept-db] [ApiKey] Identity vessel validated key {"orgId":"organizations:substrate","keyId":"key_G6_b4bkZ1A49Rdu9"}
ERROR [concept-db] SurrealDB query failed
  sql: CREATE type::record("concept", $id) SET id=$id, pointer=$pointer, shape=$shape, ...
  error: "There was a problem with the database: IAM error: Not enough permissions to perform this action"
```

**Apply-schema.ts exists but is never invoked.** `repos/concept-db/scripts/apply-schema.ts` connects as `SURREALDB_USERNAME` (default `root`) with `SURREALDB_PASSWORD`, then iterates `sql/core/*.surql` and `sql/upkeep/*.surql` applying each. No systemd unit, ExecStartPre, or bootstrap hook invokes it. `grep -rE "apply-schema|apply_schema" scripts/substrate/units/` returns empty.

**$auth-in-PERMISSIONS sites (10 lines, 3 files):**
- `repos/concept-db/sql/core/001-concept-tables.surql:12-14` (table `concept`, select/create/update/delete)
- `repos/concept-db/sql/core/001-concept-tables.surql:84` (table `concept_edge`)
- `repos/concept-db/sql/core/001-concept-tables.surql:122-123` (table `concept_usage`)
- `repos/concept-db/sql/core/003-impulse-table.surql:17-19` (table `impulse_resolutions`)
- `repos/concept-db/sql/upkeep/002-upkeep-views.surql:79` (view, select/create)

## Proposed action

**Two-part fix; both required, order matters:**

### Part A — Migrate PERMISSIONS clauses from `$auth.*` to `$token.*`

Reference pattern: activity-api migration 129 (`repos/metabob-activity-api/sql/migrations/129-*.surql` per CLAUDE.md). For concept-db, the literal edits are:

`repos/concept-db/sql/core/001-concept-tables.surql`:
```diff
- FOR select WHERE (scope = 'global' AND public = true) OR org_id = $auth.org_id
- FOR create, update WHERE org_id = $auth.org_id
- FOR delete WHERE org_id = $auth.org_id AND $auth.role = 'admin';
+ FOR select WHERE (scope = 'global' AND public = true) OR org_id = $token.org_id
+ FOR create, update WHERE org_id = $token.org_id
+ FOR delete WHERE org_id = $token.org_id AND $token.role = 'admin';
```
Same substitution at lines 84, 122-123.

`repos/concept-db/sql/core/003-impulse-table.surql` lines 17-19: same substitution.

`repos/concept-db/sql/upkeep/002-upkeep-views.surql` line 79: same substitution.

Total: 10 single-token replacements; pure mechanical translation.

### Part B — Add a concept-db schema bootstrap to the substrate

Two acceptable mechanisms:

1. **systemd ExecStartPre on `concept-db.service`** — modify `scripts/substrate/units/concept-db.service`:
   ```
   ExecStartPre=/root/.bun/bin/bun /vessels/concept-db/scripts/apply-schema.ts
   ```
   The script already uses `SURREALDB_*` env vars and the substrate's `/etc/substrate/env` exports them.

2. **One-shot seeder unit, mirroring `concept-db-seeder.service`** — add `concept-db-schema-seeder.service` (Type=oneshot) that runs `apply-schema.ts` after `surrealdb.service` becomes healthy and before `concept-db.service` starts.

Option 1 is simpler and fits the substrate's existing pattern (Helm charts apply schema this way). Idempotency: apply-schema.ts re-defines tables; SurrealDB's `DEFINE TABLE ... SCHEMAFULL` is idempotent as long as field definitions don't change.

### Verification after fix

1. Restart concept-db; tail the journal for `[concept-db-schema-apply] Applying core/001-concept-tables.surql` (or equivalent).
2. `INFO FOR DB` should now show `concept`, `concept_edge`, `concept_usage`, `impulse_resolutions`.
3. `POST /concepts` with the Cα payload from `validation/investigations/2026-05-25T17-00-00Z-investigation-022.md` should return 201/200, not 400.
4. `GET /concepts/search?source_type=human_input` should return the inserted concept.

If verification step 3 still returns IAM error after step 2 succeeds, Part A's `$auth → $token` migration did not land or did not apply; re-confirm by `INFO FOR TABLE concept` and inspecting the PERMISSIONS line in the response.

## Finding 2: concept-db's SurrealDB singleton loses authority after ~1h; needs auto-resignin

agent: audit
date: 2026-05-26
status: open

**Claim in spec**: substrate-hosted concept-db remains writable for the lifetime of its service unit; operator/audit/upkeep writes work continuously.

**Observed reality**: after applying Finding 1's fixes (concept-db is writable end-to-end), the singleton's authenticated connection silently loses authority after ~1h–1h22m. POST /concepts and upkeep-cycle SELECTs both fail with `IAM error: Not enough permissions to perform this action`. A `systemctl restart concept-db.service` re-establishes the root signin and writes resume. Reproduced three times in 6h: 06:18Z restart → broken by 07:23Z; 12:33Z restart → broken by 13:55Z; with a third recurrence observed earlier. The ~1h interval matches SurrealDB ACCESS definition `DURATION FOR TOKEN 15m, FOR SESSION 1h` on `apikey_token`, suggesting SurrealDB 3.x applies session-TTL even to root username/password signins.

**Gap type**: missing_idiom (resilience pattern absent in client)

**Severity**: substantive — concept-db is technically operational but requires ~hourly operator restarts to remain writable. Upkeep cycles fail silently between restarts. Any concept-consuming activity (Cα/Cβ, F-036's task 3 `relatedConcepts`) will see intermittent IAM errors correlated with session age.

**Diagnostic evidence**:
- Live `INFO FOR DB` confirms `concept` table is properly defined with `$token` PERMISSIONS (Finding 1's fix is intact).
- A direct root-auth curl to SurrealDB succeeds at the same moment concept-db's singleton fails — proves the table+permissions are fine; the singleton's session is the failure surface.
- Concept-db journal shows `INFO [concept-db] Connecting to SurrealDB ... INFO Connected to SurrealDB successfully` at startup, then ~1h later all queries (including upkeep cycle SELECTs that don't depend on per-request JWT) error.

**Proposed action**: in `repos/concept-db/src/db/surreal.ts` `SurrealDBClient.query()`, wrap the query in a try/catch that detects IAM/session errors and re-signins (`db.signin({username, password})`) before retrying once. Reference pattern: `repos/metabob-activity-api/src/db/surreal.ts` if it implements similar resilience; otherwise model on common SurrealDB SDK patterns. Alternative: keep the connection but call `db.signin()` on a 30-minute interval timer to preempt expiry.

**Until fixed**: workaround is `systemctl restart concept-db.service` whenever IAM errors return. The Cα/Cβ insertion path is functional within each ~1h session window.

- Audit investigation chain: `validation/investigations/2026-05-25T10-32-00Z-investigation-018.md` (Finding A correction), `2026-05-25T17-00-00Z-investigation-022.md` (Cα and Cβ insertable payloads).
- CLAUDE.md F-V56 / F-V57 reference for the `$auth` → `$token` migration pattern.
- The 24-seed corpus in `/vessels/seed-concepts.ts` was the originally-failing path; this fix unblocks it as a side-effect, though iter-020 argues those 24 should remain queued (not first cold-start).

## Finding 3: lifecycle:llm:dispatched event emits but lands in NoopEventSink — no observer wired

agent: audit
date: 2026-05-26
status: open

**Claim in spec / dev commit `41382521`**: shipping `lifecycle:llm:dispatched` closes the audit-primitive gap from investigation-027 — the rendered prompt + input-impulse content becomes observable for the iter-024 confabulation experiment without log archaeology.

**Observed reality**: the emit code is in place (`/vessels/ias-executor-ts/dist/resolvers/llm-prompt.js:97-115`) with the exact payload iter-027 specified (`executionId, taskId, templateId, renderedPrompt, inputImpulseIds, inputShapes, variables`). It will fire on every llm-prompt task. **However, the event lands in `NoopEventSink` and is silently discarded** because:

1. `goal-host-vessel/src/index.ts:66-72` constructs `new GoalHost({...})` with no `eventSink` option.
2. `runtime.js:46` defaults `this.eventSink = options.eventSink ?? new NoopEventSink()`. `NoopEventSink.emit(_event) {}` is a no-op.
3. The flow is: `llm-prompt.emit → LifecycleSubscriberVessel → downstreamSink:undefined → NoopEventSink.emit() → /dev/null`.
4. No subscriber template in `ias-executor-ts/src/templates/`, `development-vessel/seeds/`, or anywhere else filters on `lifecycle:llm:*`.
5. activity-api WebSocket does not broadcast `lifecycle:llm:dispatched`. The trace schema has no `lifecycle_events` field — events are not persisted on traces either.

**Gap type**: incomplete_implementation — emit exists, destination unwired.

**Severity**: blocking for iter-024's confabulation-rate experiment. The audit primitive that justified shipping the event in the first place cannot be exercised until the event has somewhere to land. The patch is half-complete.

**Diagnostic evidence**:
- Source grep for `lifecycle:llm` across all `/vessels/` (excluding node_modules and dist) returns only the emit site itself — zero consumers.
- A trigger probe (`POST /run-goal` with a synthetic goal at 21:34Z) produced traces but no observable lifecycle event in journal, trace structure, or any external channel. Cannot distinguish "event fired and was discarded" from "event never fired" without an observer.

**Proposed action — any one of three sufficient**:

1. **Logger eventSink (simplest, ~5 LOC)**: `goal-host-vessel/src/index.ts:66-72` passes `eventSink: { emit: (e) => console.log("[lifecycle]", JSON.stringify(e)) }` (or a structured logger). Events land in journalctl; audit reads via `docker exec substrate-live journalctl -u goal-host-vessel.service | grep lifecycle:llm:dispatched`. Cheapest verifier path; works for the iter-024 confabulation experiment immediately.

2. **Subscriber template (foundation-native, ~one new JSON file)**: register a lifecycle-subscriber template in `ias-executor-ts/src/templates/lifecycle/` filtered on `type=lifecycle:llm:dispatched`, with a single task that writes the event payload as a `lifecycleLlmDispatched` impulse via `impulse-resolve write` shape. Events land in the impulse store, queryable by audit and concept-extractor (Cβ can learn prompt-→-outcome co-occurrence).

3. **WebSocket broadcast (parallels existing channels)**: activity-api `/ws` already broadcasts `task.completed`, `tool.call`, `impulse.resolved`. Extend to forward `lifecycle:llm:dispatched` from the same eventSink. Highest reach for live dashboards; requires the eventSink to actually flow from goal-host to activity-api, which it doesn't today.

Option 1 is the minimum viable. Option 2 is foundation-aligned. Option 3 is observable-from-outside. Audit recommends Option 1 to unblock the iter-024 experiment, then Option 2 as the durable solution.

**Reference**:
- Investigation chain: `validation/investigations/2026-05-26T17-12-00Z-investigation-023.md` (gap taxonomy), `2026-05-26T17-30-00Z-investigation-024.md` (confabulation diagnosis), `2026-05-26T18-15-00Z-investigation-026.md` (foundation alignment), `2026-05-26T18-45-00Z-investigation-027.md` (lifecycle:llm:dispatched as critical-path audit primitive).
- Dev commit `41382521 feat(llm-prompt): lifecycle:llm:dispatched event` — the half-shipped patch.

## Finding 4: structural pattern — lifecycle emits ship without paired default subscribers

agent: audit
date: 2026-05-27
status: open

**Claim implicit in dev workflow**: when a new `lifecycle:X:Y` event is added (commit message "feat(...): lifecycle:X:Y event"), the emit is sufficient — subscribers are wired separately as needed.

**Observed reality**: in the last 48h, two consequential lifecycle channels shipped with the emit code in place but **zero subscribers**. Both events fire on every applicable execution and are silently discarded.

| Channel | Emit shipped | Subscribers today | Observability today |
|---------|--------------|-------------------|---------------------|
| `lifecycle:llm:dispatched` | commit `41382521` (2026-05-26) | 0 (lands in `NoopEventSink` per goal-host-vessel/src/index.ts:66-72 + runtime.js:46) | none — audit cannot verify iter-026's inputImpulses fix nor run iter-024's confabulation experiment |
| `lifecycle:gap:classified` | commit `31eeeb2f` (2026-05-26) | 0 (no template in `repos/ias-executor-ts/src/templates/` or `repos/development-vessel/seeds/` subscribes) | none — substrate broadcasts every gap it detects; no catalog accumulates |

**Gap type**: missing_idiom (paired-subscriber convention absent in dev workflow).

**Severity**: substantive — each emit-without-listener represents a self-debugging capability the substrate has *built but cannot use*. The cumulative effect is that the substrate's self-introspection surface is half-shipped: dev adds the *capacity* for observability without adding the *consumer* that makes the capacity productive.

**Diagnostic evidence**:
- `grep -rln "lifecycle:llm" repos/ias-executor-ts/src/templates/ repos/development-vessel/seeds/ repos/concept-db/ 2>/dev/null | grep -v node_modules` returns zero.
- `grep -rln "lifecycle:gap" repos/ias-executor-ts/src/templates/ repos/development-vessel/seeds/ repos/concept-db/ 2>/dev/null | grep -v node_modules` returns zero.
- A trigger probe (`POST /run-goal` at 21:34Z, exec dispatched, executions ran) produced lifecycle events with no observable destination — journalctl shows nothing, traces have no `lifecycle_events` field, activity-api WebSocket does not broadcast them.
- Per investigation-029's analysis of `engine.ts`, the events fire deterministically; the absence is downstream of emission.

**Proposed action — a coding convention plus minimal listeners**:

**Convention**: any commit adding a new `lifecycle:X:Y` emit must also add at least one default subscriber template (or a default eventSink rendering, depending on the substrate layer the emit fires on). The default subscriber's only required action is to write the event payload as a queryable impulse — even a minimal indexer makes the channel observable.

**Auditable check**: `scripts/check-lifecycle-channels.sh` (or similar) that greps for every `lifecycle:` emit-string in the source and verifies a matching subscription exists in templates/ or a non-Noop eventSink rendering exists in the host wiring. Should run in pre-push hook or CI.

**Immediate listeners for the two currently-orphaned channels** (~20 LOC of JSON each, no engine changes, no shape changes):

1. **`gap-catalog` subscriber template** filtered on `lifecycle:gap:classified` with one task: `learning_signal_write` of the event payload as a `substrateGap` impulse indexed by `(gapType, missingShapes, parentDepth)`. Lands in `repos/ias-executor-ts/src/templates/lifecycle/gap-catalog.json` or `repos/development-vessel/seeds/`.
2. **`dispatched-prompt-catalog` subscriber template** filtered on `lifecycle:llm:dispatched` with one task writing the event payload as a `dispatchedPrompt` impulse — OR (if subscribers don't run on engine-level emits before they hit NoopEventSink) `goal-host-vessel/src/index.ts:66-72` is amended to pass a structured logger as `eventSink`. The latter is simpler (~5 LOC) and unblocks iter-024's confabulation experiment immediately.

Recommendation: ship both #1 and #2 as a single commit + add the auditable check. The dev cost is ~50 LOC across the substrate; the audit-capability gain is the foundation for the self-auditing activity proposed in investigation-028.

**Composes with**: investigation-028's `audit-resolver-divergence` activity (Part B). The activity consumes a continuously-maintained gap catalog; without #1 above, that catalog is empty and the activity has nothing to audit against. Closing this finding unblocks the entire self-debugging arc the iter-022→iter-029 investigations have been designing.

**Reference**:
- `validation/investigations/2026-05-26T18-45-00Z-investigation-027.md` — proposes `lifecycle:llm:dispatched` as the missing audit primitive.
- `validation/investigations/2026-05-26T23-25-00Z-investigation-029.md` — names the structural pattern and identifies `lifecycle:gap:classified` as the most underused property.
- Finding 3 (above) — the per-channel instance of this structural pattern for `lifecycle:llm:dispatched`. Finding 4 generalizes it.

## Finding 5: concept-db is the other side of the Finding-4 pattern — its emits are trapped, and it cannot subscribe to others'

agent: audit
date: 2026-05-27
status: open

Finding 4 names the structural pattern from the **emit** side: events ship without paired subscribers. concept-db exhibits the **mirror** of the same pattern in two directions, surfaced by investigation-026 and sharpened by operator review:

1. **concept-db emits, transport absent.** `repos/concept-db/src/lifecycle/dispatcher.ts:34-97` is an in-process `EventEmitter`. concept-db's CRUD resolvers emit `concept:created`, `concept:updated`, `edge:created`, `impulse:resolved`, etc. These reach only in-process subscribers (the seven internal handlers at `lifecycle/hooks.ts:179-200`: auto-edge-search, snapshot invalidation, debug logging). **No external transport** — ribosome cannot react to a new concept; an audit-vessel cannot index concept mutations; a future analyzer cannot observe edge formation. The events fire and die in-process.

2. **concept-db cannot subscribe to activity-api's `lifecycle:task:*` channel.** Per investigation-026, `grep -rn "lifecycle:task\|lifecycle:execution\|preBinding\|execution:succeeded" repos/concept-db/src/` returns zero hits. These events flow on a transport coupled to workbench's binding/validation UI. concept-db has legitimate use for them (recording usage tied to specific task transitions, not just post-hoc `task.completed`), but the channel is not structured for arbitrary vessel subscription.

**Gap type**: missing_idiom (transport coupling at both emit and consume layers; same root as Finding 4 viewed from the other end).

**Severity**: substantive — the principle "emitters neutral; consumers register" is violated symmetrically. Investigation-026's initial verdicts ("WIRED internally; not exported by design" / "NOT WIRED — by design") were wrong: the design itself is the defect. The validator's gap-001 was correct.

**Proposed action**: extend Finding 4's convention to both sides. (a) `concept-db/src/lifecycle/dispatcher.ts` gains a broadcast transport (likely a WebSocket emitter mirroring activity-api's `/ws` shape, or a publish via discovery-vessel that any vessel can subscribe to); (b) activity-api's `lifecycle:task:*` events graduate from workbench-coupled transport to a neutral broadcast on `/ws` of the same shape as today's `task.completed`/`tool.call` (concept-db, ribosome, audit-vessel can all subscribe via the existing observer pattern).

The composition with Finding 4: ship a single substrate-wide lifecycle bus. Today the substrate has three half-buses — activity-api's `/ws` (works), `lifecycle:task:*` (workbench-coupled), in-process EventEmitters per vessel (no transport). Closing Findings 3, 4, and 5 together is the consolidation onto one bus.

**Reference**:
- `validation/investigations/2026-05-27T08-50-00Z-investigation-026.md` (post-correction) — reclassifies items 3 and 4 as DEFECT, points here.
- The principle: nothing is "for" a specific consumer. If a vessel emits a hook, any vessel that wants to consume it should be able to register.

## Finding 7: iter-030 promote-gate shipped inline rather than as an activity — satisfies refusal axis, partially defeats self-introspection axis

agent: audit
date: 2026-05-27
status: open

**Claim implicit in dev's inline-implementation choice** (commit `77599460`, dev-response-012): the promote-gate's algorithm (weighted Beta-Binomial projection over K=5 Jaccard-nearest templates, threshold 0.6/samples 10) is sufficiently captured by inlining it in the `/promote` endpoint handler — no need to spend the engineering cost of authoring it as a 6-task template per iter-030's design.

**Observed reality**: the inline implementation works. Live verified per dev-response-012: cold-start templates refused with K=0,mean=0.5; coverage-overlapping templates promoted. The refusal infrastructure handles three distinct intervention classes uniformly (`no_producer_for_expected_shapes`, `hallucinated_resolvers_in_template`, `promote_gate_below_threshold`). Axis-C of the seven-axes self-knowledge framework (refusal-with-cited-evidence) is structurally satisfied. The substrate has, for the first time, a substantive push-away mechanism on the promote path.

**The structural divergence**: per the seven-axes framework (per the prior turn's foundational answer), inline implementation partially defeats two other axes:

- **Axis-B (autonomous template authorship ratio)**: the promote-gate is not a template the substrate can extract, learn from, or apply to itself. Ribosome cannot observe a successful promote-gate execution and propose a variant. The gate's logic is procedural code in activity-api, not declarative in the registry.
- **Axis-E (meta-activity coverage)**: the meta-activity surface for self-evaluation grows by zero. The substrate's "things it does as activities" set stays bounded by what was authorable in templates; the promote-gate joins the set of "things activity-api does as REST handlers."

Plus a third consequence specific to the gate itself:

- **The gate's own α/β isn't measurable**. Iter-030 noted as a bonus: "the gate IS an activity, so its execution emits `activityExecutionTrace` automatically — Thompson posterior on the gate-resolver itself falls out." That bonus is forfeited. The substrate cannot learn whether its promote-gate is calibrated correctly via the same posterior mechanism it uses to learn about everything else.

**Gap type**: design_drift_from_foundation. The foundation doc (`docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md:932-935`) prescribes "Resolvers Live Where Data Lives — don't centralize resolution." Inlining the gate in activity-api re-centralizes a decision that the activity layer was meant to distribute.

**Severity**: minor — empirically the gate works. But this is the pattern that, repeated across enough decisions, erodes the activity-graph's coverage of substrate concerns. Each inlined decision is a meta-activity the substrate cannot author or learn from.

**Proposed action**:

1. **Land the inline implementation as-is** — it's working and provides the push-away mechanism axis-C requires.
2. **Add a follow-up task to author the 6-task `promote-gate-resolver` template per iter-030** — same algorithm, but as a registered activity. The inline endpoint becomes a thin wrapper that dispatches the template.
3. **The activity authorship is itself the shadow-mode calibration vehicle** — once the template exists, the inline endpoint can dispatch it in shadow alongside the inline logic for a week, comparing decisions. Discrepancies indicate either the inline implementation has subtle differences or the template has them. Either way the audit gains observability.
4. **Once the template is shipped, the inline endpoint becomes the thin wrapper** per iter-030's original design. Activity-api retains the entry point; the logic lives where the substrate can see it.

This is a fix-forward path — no rollback of the working implementation, just structural alignment with the foundation's "resolvers live where data lives" principle on the next iteration.

**Reference**:
- iter-030 (`validation/investigations/2026-05-27T12-50-00Z-investigation-030.md`) — the 6-task design dev opted not to implement directly.
- dev-response-012 (`validation/investigations/2026-05-27T19-15-00Z-dev-response-012.md`) — the inline-implementation closure narrative.
- Commit `77599460` and `metabob-activity-api/4653d33` — the shipped code.
- Foundation `:932-935` "Resolvers Live Where Data Lives" — the principle the divergence runs against.

## Finding 6: iter-028 A shipped before C — the safety surface is partial, and the lifecycle bus closure made the race worse

agent: audit
date: 2026-05-27
status: open

**Claim implicit in inv-028 A's deploy decision** (commit `87ab8d18`): `proposed=true` discipline + recommend-filter + `activityTemplate_promote` gate is sufficient safety to enable capability generation. iter-028 explicitly recommended **shipping C (impulse-pull at `engine.ts:126` + `eventSink.flush` primitive) FIRST** because A and B both write to the registry and the engine's gap-filling is structurally fragile without C.

**Observed reality**: A shipped at 10:00Z (this conversation's loop window). B shipped at ~10:20Z. **C remains open**, explicitly deferred per `229edcba`'s commit message ("inv-028 C (impulse-pull semantics) remains open as engine-level work"). In parallel, the Findings 3/4/5 closure (commits `4167ba2a` → `30988ecb` → `696b3957` → `361c629a`) **moved lifecycle events from in-process EventEmitter to a broadcast bus** — this is the substrate-spanning event-bus the audit asked for, and it is the right architecture, **but it increases the cross-vessel subscriber latency that C was specifically designed to remediate**.

The in-process EventEmitter (pre-bus) made the engine's `await this.emit(...)` at `engine.ts:95` synchronous-enough that lifecycle subscribers populated the impulse store before `resolveInputs` ran (`engine.ts:127, :134`). With the bus, subscribers can now be in different vessels — concept-db, audit-vessel, future analyzers — and their dispatch latency is no longer bounded by in-process call timing.

**Empirical state right now (10:25Z)**:
- `activity` table: 30 templates, 1 with `proposed=true` (`activity:⟨test-proposed-001⟩` — a dev-side smoke probe, not an autonomous extraction).
- Only one new template since A landed: `activity:⟨development-vessel:harness-run-matrix⟩` at 10:07Z, `proposed=false` (boredom-seeded, not ribosome-extracted).
- Ribosome-vessel restarted at 10:00:22Z, WS-connected, but no dispatch logs since.
- 0 failed traces with populated `failure_mode` in last 50 traces.

So **no flood empirically** — but also **no evidence A's path has been exercised**. The substrate is in a quiet window; A's safety has not been stress-tested.

**Risk model (theoretical, not yet empirical)**:

1. **A enables ribosome/make-activity writes.** Those activities themselves run on the engine. The engine's `resolveInputs` (`engine.ts:450-478`) hard-throws on missing inputShapes; gap-filling depends on lifecycle subscribers populating the store before the executor reaches that call. With the new bus, subscribers can be cross-vessel, increasing latency variance.

2. **Specifically**, ribosome's `synthesize_template` task has declared `inputShapes`. If concept-db (or any future subscriber) is meant to populate via lifecycle subscription, the bus-tier latency may exceed engine's race window. resolveInputs throws; ribosome fails; no proposed template gets written.

3. ~~**The `proposed=true` filter prevents flood through Thompson selection**, but does NOT prevent persistence of malformed proposed templates.~~ **CORRECTION (per operator review)**: this claim was wrong. `CreateTemplateRequestSchema.parse(body)` at `repos/metabob-activity-api/src/routes/activities.ts:37` rejects malformed payloads with 400 (schema at `models/schemas.ts:187-217`, with `description: z.string()` required, `tasks: array(TemplateTaskSchema)` typed, and the 6-rule validator + LLM `validate_proposal` upstream in ribosome-extract). Structural malformation cannot land through the legitimate write path. **The actual risk axis is the opposite**: ribosome's *own execution* can race silently. `acquire_trace_signature` task declares `inputImpulses: ["execution_trace_with_signatures"]`; if the bus-tier subscriber latency exceeds engine's race window (`engine.ts:127,134`), `resolveInputs` throws at `engine.ts:465-467`, ribosome's run fails, **no proposed template is written**. Capability generation enabled but effectively dormant. The safety argument for C therefore becomes "observability of expected-but-missing writes" not "preventing bad writes." Operator review surface for triaging *valid* proposals (`ExtractedTemplate` workbench page) is still aspirational per iter-027.

4. **The new bus made the surface area larger.** Pre-bus, lifecycle subscribers were the slot-binding meta-activity and validator-dispatch — both in-process from the engine's POV. Post-bus, any vessel can subscribe to the same events. This expansion of consumers without the corresponding `eventSink.flush()` join is exactly what C prevents.

**Gap type**: substantive — the safety arguments rely on the pre-bus synchronous-enough property that no longer holds.

**Severity**: substantive — empirically dormant today (no flood), structurally exposed (race surface widened by Findings 3/4/5 closure). Lift criterion under IAL is "operator can refuse interventions with cited evidence"; without C the substrate cannot reliably refuse a race-induced bad proposal because its own execution may not have run cleanly enough to know.

**Proposed actions, in priority order**:

1. **Ship C with high priority.** The original iter-028 staging argument now applies *more strongly* than it did at design time, because Findings 3/4/5 closure widened the race surface. `engine.ts:126` await + `runtime.eventSink.flush(executionId, taskId)` primitive on `LifecycleEvent` of type `task:preBinding` is the minimum-viable closure. Risk: low (single new primitive + single await). Reach: every template with declared inputShapes benefits, AND ribosome/make-activity's own runs become deterministic.

2. **Until C ships, add a rate cap on ribosome's `dispatch_write` task** when `applyExtraction=true`. Per `ribosome-extract.json:154`, the write is gated by `applyExtraction`. Add a sibling gate: `applyExtraction === true AND (dispatch_attempts_in_last_5min < N)`. Bounds the worst-case accumulation rate if a race-induced bad proposal slips through.

3. **Audit the recommend filter actually excludes proposed=true at every selection site.** Subagent should grep `repos/metabob-activity-api/src/` for every place that reads `activity_template` (or `activity`) and verify the WHERE clauses exclude `proposed = true`. One unhardened selection path is enough to defeat A's safety surface.

4. **Add observability on the gap that opened.** When `resolveInputs` throws missing-shape (`engine.ts:465-467`), emit a structured `lifecycle:race:resolveInputs-missing` event on the bus with `(template, task, missing_shapes, subscribers_waited_on)`. Without this, race-induced failures are silent. This is itself a Finding-4-pattern instance — emit-without-paired-subscriber would happen here too unless audit adds a default subscriber simultaneously.

**Audit-side check that should run after C ships**: replay the last 100 traces with C disabled vs enabled (the same traces, deterministically), measure how many `resolveInputs` throws were race-induced (subscriber populated *after* the throw rather than before). If the count is non-zero, C's deployment is justified empirically.

**Reference**:
- `validation/investigations/2026-05-27T09-55-00Z-investigation-028.md` — original staging argument (C first; A and B depend on C).
- `validation/investigations/2026-05-27T10-00-00Z-investigation-055.md` (dev-authored) — A's closure narrative.
- Commits `87ab8d18` (A), `229edcba` (B), `4167ba2a` (bus foundation), `30988ecb` (engine lifecycle on bus).
- C is the open primitive; this finding is its escalation grounded in post-A live state.

## Finding 8: ~~Thompson α appears to increment on selection rather than terminal success~~ — **RETRACTED**

agent: audit
date: 2026-05-27 (filed) / 2026-05-28 (retracted)
status: RETRACTED — see investigation-035 for correction
severity: ~~HIGH~~ → retracted

**RETRACTION (2026-05-28)**: The load-bearing data point this finding rested on (`successful_executions = 0` for `create-shape-provider-goal` while α=832) was misread. A direct SurrealDB query at retraction time shows that template at α=834, ok=750, total=827 — internally consistent with correct Thompson semantics. Subagent #17's code-walk traced the α-increment write at `repos/metabob-activity-api/src/lib/posterior-update.ts:139-142` is correctly guarded by `trace.success === true`. **There is no "α growing on selection rather than success" bug.** Apologies to dev for the false-alarm severity-HIGH finding; audit process change documented in investigation-035.

The two adjacent findings DO survive verification (at substantive severity):

1. **`success_rate` field stale on `variant_performance_metrics` rows.** Row shows `success_rate = 0.0` when `ok=750, total=827` should produce ~0.91. The field is computed at write time and may be staling between feedback-path UPDATE and recompute. Severity: substantive (single-field staleness, not substrate-wide).

2. **`impulse_relevance_metrics` is empty (0 rows) — forward arm structurally inactive for templates that don't include `learning_signal_writer` task in their graph.** F-39 fixed the templateId-on-payload path; it did NOT wire the task into the three discovery-probe templates (`create-shape-provider-goal`, `probe-reachable-unlearned`, `probe-untraversed-edge`). Per `learning-signal-writer.ts:113-136`, the resolver only fires when explicitly dispatched. Severity: substantive (forward arm works where task is wired; doesn't fire where it isn't).

3. **`context_thompson_scores` is empty (0 rows) — signature-keyed conditional Thompson stratification not happening.** **Root cause precisely located (iter-036)**: the live emit-side `TranslatingTraceSink.record` at `repos/ias-executor-ts/src/adapters/activity-api-trace-sink.ts:67-149` doesn't attach `metadata.state_space_signature` OR `input_impulse_shapes` to the wire body. The downstream hoist at `execution-traces.ts:2375-2398` and v1-fallback derivation at `:2387-2395` are both correctly implemented and inert because they receive `undefined`. `computeStateSpaceSignature` exists at `repos/minibob/src/state-space-signature.ts:24` but is unimported by ias-executor-ts production code (the trace-emit migration to ias-executor-ts left this function behind).

**Verified by direct query**:
```sql
SELECT execution_id, signature, signature_version, metadata, input_impulse_shapes
FROM activity_execution_traces LIMIT 5;
```
Returns uniform `{signature:null, signature_version:null, metadata:null, input_impulse_shapes:null}` across all rows.

**Smallest concrete fix** (refined per iter-037, ~10-20 LOC total):

1. **Widen `ExecutionTaskRecord` (`repos/ias-executor-ts/src/ontology.ts:139-151`)** — add `inputShapes?: string[]` and `outputShapes?: string[]`. 2 lines.
2. **Populate at the three push sites in `engine.ts`** — `:244-255` (primary), `:265` (failure path), `:285-286` (other failure). The values `declaredInputShapeNames` (already at `:84`) and `this.shapesOfImpulses(task, storedOutputs)` (method at `:537`, invoked at `:288` for the lifecycle event) are **already in scope**. 6 lines total.
3. **Emit on the wire in `activity-api-trace-sink.ts:90-131`** — add `input_impulse_shapes` and `output_impulse_shapes` to the wire body, reading from `t.inputShapes` and `t.outputShapes` on each task record. 2 lines.

**The deciding code-fact**: the lifecycle event at `engine.ts:287-288` already carries `inputShapes` and `outputShapes` computed from the same variables in scope at `:244-255`. The trace task record at `:244` is the ONLY structure on the data path that drops them. This is Finding 4's pattern (events emit but not all consumers receive them) repeated at the trace-record layer.

**Why not sink-side plumbing**: giving the sink access to the impulse store would widen the `TraceSink` port contract (`repos/ias-executor-ts/src/ports.ts`) and require threading runtime state through every host that constructs sinks — both larger and architecturally worse than widening the typed carrier. The trace is the right place.

**Verification post-fix**:
```sql
SELECT execution_id, signature, input_impulse_shapes, output_impulse_shapes
FROM activity_execution_traces ORDER BY created_at DESC LIMIT 5;
```
Non-null `input_impulse_shapes` OR non-null `signature` confirms emit side. `SELECT count() FROM context_thompson_scores GROUP ALL` returning >0 confirms downstream write.

Severity: HIGH (signature-conditional Thompson stratification — load-bearing per iter-027 — has been structurally inactive since the ias-executor-ts migration shipped). Reference: `validation/investigations/2026-05-28T00-30-00Z-investigation-036.md` (location), `validation/investigations/2026-05-28T00-55-00Z-investigation-037.md` (fix-scope refinement).

**Reference**:
- `validation/investigations/2026-05-28T00-15-00Z-investigation-035.md` — full retraction analysis.
- `validation/investigations/2026-05-27T23-50-00Z-investigation-034.md` — the retracted original.

Original (retracted) text follows below for historical record:

~~

**Claim implicit in iter-022→033 design arc**: Thompson α-values in `variant_performance_metrics` reflect terminal success counts per Foundation §475-481 (`Success: Increment α for this activity variant`).

**Observed reality**: surfaced by the topology audit (`validation/investigations/2026-05-27T23-50-00Z-investigation-034.md`). Direct SurrealDB query:

```
docker exec substrate-live sh -c '. /etc/substrate/env;
  curl -s -X POST -u "root:$SURREAL_PASS"
    -H "Content-Type: application/json"
    -H "surreal-ns: activity-system"
    -H "surreal-db: learning_loop"
    --data "SELECT activity_variant_id, alpha, beta, total_executions, successful_executions, success_rate
            FROM variant_performance_metrics
            WHERE total_executions > 0
            ORDER BY total_executions DESC
            LIMIT 20;"
    http://127.0.0.1:8000/sql'
```

Returns rows including:

| activity_variant_id | α | β | total | successful | success_rate |
|---------------------|---|---|-------|------------|--------------|
| `create-shape-provider-goal` | **832** | 84 | 823 | **0** | 0.00 |
| `probe-reachable-unlearned` | 31 | 4 | 30 | 0 | 0.00 |
| `probe-untraversed-edge` | 16 | 2 | 15 | 0 | 0.00 |

**α = 832 with 0 successes is structurally impossible** under standard Thompson semantics (Beta(α, β) where α += 1 on success only). For α to reach 832 starting from a Beta(1, 1) prior, the α-increment write must fire on something other than terminal success. Most likely candidate: the write fires at recommend-time / dispatch-time / selection-time.

**Gap type**: measurement_integrity — the substrate's primary learning signal isn't measuring what the docs say it measures.

**Severity**: HIGH — invalidates posterior-dependent reasoning across iter-022→033. Specifically:
- iter-030 promote-gate's K-nearest projection uses these posteriors
- iter-029's verification of "α=2, β=1 for validator-dispatch" was a special case of the same write path
- iter-028 B's `resolver_pattern` aggregator builds atop these counts
- iter-031's closer α/β learning signal will inherit the same bias
- iter-033's per-cycle narration "regression" detection depends on meaningful baselines

The cross-check: `validator-dispatch` shows α=6224, β=1 with success_rate=1.00. **The data cannot distinguish** "every execution succeeded" from "α counts selections and validator-dispatch happens to never fail." Both produce the same row pattern. Until the write path is verified, the 100% success rate templates have the same ambiguity as the 0% ones.

**Proposed action — verification, then triage:**

1. **Audit `repos/metabob-activity-api/src/lib/posterior-update.ts`** — locate `applyOutcomeToPosteriors` (per iter-028 grounding). Verify α increments only on terminal `success: true` events. If it fires on selection/dispatch instead, that's the bug.

2. **If bug confirmed**, choose recovery semantics:
   - Hard reset α/β: loses learning evidence
   - Recompute from trace store via `task.completed.success=true` events: expensive but correct
   - Roll forward with fix + known-biased legacy baseline: introduces continuity bias
   The choice depends on trace-store preservation per iter-027 (per-task contents are placeholders for many shapes).

3. **Document the resolution** so audit and validator can re-baseline their measurement priors.

**Two adjacent findings discovered alongside this one:**

- **Forward arm structurally inactive**: `impulse_relevance_metrics` is **0 rows**. The two-arm duality's forward arm (Foundation §490-498) is being written nowhere. F-39 was supposed to fix this; data says it isn't.
- **Stratified Thompson inactive**: `context_thompson_scores` is **0 rows**. The (template_id, signature) conditional posteriors iter-027 grounded as the load-bearing primitive are not populating. All Thompson sampling falls back to uniform `variant_performance_metrics`.

These three findings together suggest the learning-loop write path is broken across multiple targets. Verifying the α-increment site likely surfaces all three.

**What the audit must defer pending verification**:
- iter-030 promote-gate calibration
- iter-031 closer α/β learning signal
- iter-032 detector aggregation thresholds (severity assumes meaningful success rates)
- iter-033 per-cycle delta narration significance enum

**What can proceed independent of verification**:
- iter-026 / Findings 3/4/5 neutral bus (shipped, structural)
- iter-032's `substrateGap` filing (observation, not measurement)
- Topology-hole authoring (`gapScenario`, `learnedTopologySnapshot`, `unknownShapeReport` producers — structural-intervention, not posterior-dependent)

**Reference**:
- `validation/investigations/2026-05-27T23-50-00Z-investigation-034.md` — full analysis with cross-references.
- Subagent topology-audit transcript at `/tmp/.../abbde1037f6dee377.output` — the source observations with direct SurrealDB queries.
- Foundation `:475-481` — prescribes "increment α on Success", "increment β on Failure".
- Foundation `:498` — symmetry invariant the two arms should satisfy (cannot be checked when forward arm is empty).

~~ END OF RETRACTED ORIGINAL ~~

## Finding 9: Autonomous promoter audit-trail / live-state divergence — UPDATE can fail silently while audit-write succeeds

agent: audit
date: 2026-05-28
status: open
severity: HIGH

**Claim implicit in commit `93a6cb42`** ("close the lift loop — autonomous promoter restored + wired to boredom"): the autonomous promoter's audit trail (`promote_gate_evaluations`) reflects substrate state — i.e., a row with `decision: 'promote'` corresponds to a live row with `proposed = false`.

**Observed reality** (verified by direct query at 2026-05-28T01:00Z):

`promote_gate_evaluations` row at 23:00:20:
```json
{"decision":"promote", "reason":"auto_promote",
 "template_id":"test-proposed-001", "k_neighbors":5,
 "neighbor_template_ids":["development-vessel:harness-run-matrix", ...],
 "projected_mean":0.847, "alpha_hat":21.0, "beta_hat":3.8}
```

`SELECT ... WHERE proposed = true` at 23:43Z (43 min later):
```
test-proposed-001 / "test proposed" / proposed=true
```

**The audit-trail says promoted; the live row says still proposed.**

**Gap type**: state_divergence — the audit's load-bearing prior ("audit-trail = state") is refuted by data.

**Severity**: HIGH — this is the **first audit cycle where a closure-audit could read GREEN while a structural defect exists**. The promote audit-write succeeded; the `UPDATE activity SET proposed = false` either failed silently, was re-flipped, or never executed. The endpoint catches UPDATE failures and pushes to `skipped[]` with `reason: 'update_failed'` — no retry, no alert, no bus event for the failure.

**Code path** (per `routes/activities.ts` per iter-038 grounding): the auto-promote endpoint wraps the UPDATE in try/catch and silently records `update_failed`. If this divergence pattern recurs on substrate-authored templates after the commit message's "~4-24h" prediction, **the lift loop closes in audit-trail terms but not in data terms**:
- `template.auto_promoted` event fires on the WebSocket bus
- `promote_gate_evaluations` records `decision: 'promote'`
- recommend handler continues routing the template to the **exploration pool** because `proposed=true` is still on the row
- Closure-audit reads GREEN; the loop is open

**Two root-cause hypotheses to test**:

1. **Concurrency race**: operator `/promote` runs, audit-writes, attempts UPDATE; another process (boredom-vessel auto-promote? operator's manual `proposed=true` re-write?) UPDATEs the row back between read and write. Test: `SELECT updated_at` on `test-proposed-001`, compare to audit row's timestamp.

2. **Silent failure**: the UPDATE fails (permissions, validation constraint, type mismatch); the catch block converts the error to `skipped.push({reason:'update_failed'})`; no operator-visible signal. Test: grep boredom-vessel and activity-api journals for `update_failed`.

**Proposed action**:

1. **Investigate the live row's history**: `SELECT * FROM activity WHERE id = activity:test-proposed-001` — verify `proposed=true` persists and `updated_at` is post the audit row's timestamp. If `updated_at` matches the audit timestamp, the UPDATE landed and was subsequently re-flipped by another process.

2. **Add a `WHERE proposed = true` guard** on the UPDATE statement and emit `lifecycle:promote:update_failed` event when the affected_rows count is 0. Failure is currently silent; making it loud lets audit observe.

3. **Idempotency check** on auto-promote: skip rows where `proposed=true` is no longer true at SELECT-time (or wrap in a transaction that fails fast on concurrent change).

**Adjacent finding from iter-038**: the autonomous promoter (`/auto-promote` endpoint, called by boredom-vessel) **bypasses iter-030's K=5 Jaccard projection** — hardcodes `k_neighbors: 0` and reads only the candidate's own `variant_performance_metrics` row. So the substrate now has TWO promote-gates with different policies:
- Operator-pulled `/promote` (iter-030 K=5 Jaccard projection)
- Autonomous `/auto-promote` (K=0, per-template α/β thresholds, 30-min cadence, unconditional)

This divergence may be intentional (autonomous path is simpler / faster) but is undocumented in the commit and not addressed in any prior audit-finding. Worth deciding whether to converge the two gates or keep them differentiated with explicit policy documentation.

**Reference**:
- `validation/investigations/2026-05-28T01-25-00Z-investigation-038.md` — full audit with inlined queries.
- Subagent #20 transcript at `/tmp/.../ab3e870dd2b24f44e.output` — source data.
- Commit `93a6cb42` — the autonomous-promoter ship.

## Finding 10 (HIGH) — proposed=true discipline bypassed on autonomous-authoring path (2026-05-28T09:35Z)

Three-agent convergence on P1 firing (commit `4e55f95b`). However the authored template `gap-closing:fm-43-cascade-attribution-error-1779960003142` landed `proposed: false`, bypassing iter-028 A's discipline (commit 87ab8d18). The template is selection-visible immediately; no promote-gate ratifies before selection-eligibility.

Inlined data (from `GET /v2/activities/templates?limit=300`):
```
{ "id": "activity:⟨gap-closing:fm-43-cascade-attribution-error-1779960003142⟩",
  "created_at": "2026-05-28T09:20:03.169444013Z",
  "proposed": false,
  "total_executions": 0,
  "org_id": "organizations:substrate" }
```

Root cause hypothesis: `CreateTemplateRequestSchema` at `repos/metabob-activity-api/src/models/schemas.ts:187-217` defines `proposed: z.boolean().default(false)`. The schema's own default contradicts iter-028 A discipline. The `activity_create_variant` resolver doesn't override this default. iter-038 autonomous-promoter (commit 93a6cb42) is no-op for this path since templates start non-proposed.

iter-041 P4 prediction structurally unreachable: cannot observe "autonomous-promoter flips proposed:true→false" when templates skip proposed:true entirely.

## Finding 11 (MEDIUM) — Resolver-validity uncertain in autonomously-authored template (2026-05-28T09:35Z)

The same `gap-closing:fm-43-cascade-attribution-error-1779960003142` template references resolvers:
- `activity_fetch` — NOT in `repos/ias-executor-ts/src/hosts/goal-host.ts:598-673` registry (verified by subagent #24 grep)
- `fs_read`/`fs_edit`/`fs_write` with abstract configs (e.g. `validation_method: "downstream_consumption"`, `reclassification_rule: "if output_validated=true then..."` as a config string)
- `llm_completion_dispatch` — exists

LLM synthesized structurally-coherent-looking content with at least one hallucinated resolver name. If recommender selects this template (currently possible per Finding 10), dispatch likely fails at task 1.

This is iter-040 V_X gap made concrete: substrate authored X without V_X. `make-activity` and `draft-gap-closing-activity` both end at template-write with no companion-validator. Without V_X, plausibility is the only warrant; behavioral verification deferred to first selection.

Audit's next observation: watch for first selection of this template. If `activity_fetch` is hallucinated, dispatch will surface the gap loudly.

### Finding 11 update (2026-05-28T10:15Z) — pattern reproduces

Second substrate-authored template `gap-closing:fm-17-resolver-budget-noncompliance-1779960884797` (created 09:34:44) references `activity_fetch` AGAIN. Inlined task-resolver list:
```
[activity_fetch, llm_completion_dispatch, activity_create_variant,
 llm_completion_dispatch, activity_create_variant, activity_create_variant]
```

This is now a 2-of-2 reproduction. `activity_fetch` is a learned-but-wrong LLM prior, not a one-off hallucination. Investigation priority: grep `repos/development-vessel/src/seed/draft-gap-closing-activity.ts` for whether the LLM prompt explicitly mentions `activity_fetch` as an available resolver. If yes, prompt fix is operator-floor (~5min); if no, the bias is from LLM training data and needs registry-query pre-check (operator-floor per iter-047 §"Per-finding routing").

Strengthens the case for the registry-query primitive (subagent #26 in flight). One primitive shipped blocks the pattern for all future substrate-authored templates.

Also notable: fm-17 uses `activity_create_variant` THREE times (template-write resolver, used mid-execution). May indicate recursive sub-template authoring; deferred until Finding 11 mitigated.

## Finding 13 (CRITICAL) — Silent success across error-marked impulses (2026-05-28T10:50Z)

iter-041 P1-experiment iteration 2: submitted web-research goal "Summarize the practical state of homomorphic encryption usability as of mid-2026." Dispatched to `gap-closing:fp-12-partial-success-recorded-as-total` (exec_a2qzc2sr, 6m18s wall). Trace shows:

- All 8 tasks: `status: success`
- Execution: `status: success`, `failure_mode: null`
- Output impulse IDs (literal): `err_7l4buvym`, `err_jndvdiri`, `err_mgf1zxbx`, `err_0iyervcc`, `err_pbzoao1g`, `err_u1npz0eq`, `err_0ggp03x4`, `err_q7s0fg0q`

Every output is an error-marker, every task reports success. The substrate has **zero signal** that anything went wrong. This is Finding 9's silent-UPDATE-failure pattern reproduced at the task-level across an entire 8-task execution. Thompson α/β posteriors will credit fp-12 as a clean success.

Severity: CRITICAL. This breaks Thompson learning specifically for substrate-authored templates with hallucinated resolvers (every Finding-11 template hits this path on selection).

## Finding 14 (CRITICAL — audit-reliability meta) — Registry list truncates silently (2026-05-28T10:50Z)

Prior audit queries (Finding 11, Finding 11 reproduction, Finding 12) reported "2 substrate-authored gap-closing templates" via `GET /v2/activities/templates?limit=500`. Actual count: **6** (fp-11, fp-12, fp-15, fm-17, fm-43 × 2 — see literal query result below).

```
[
  {"id":"activity:⟨gap-closing:fp-15-missing-producer-stale-registration-1779960487088⟩","created_at":"2026-05-28T09:28:07.095Z","proposed":false},
  {"id":"activity:⟨gap-closing:fp-12-partial-success-recorded-as-total-1779960500760⟩","created_at":"2026-05-28T09:28:20.767Z","proposed":false},
  {"id":"activity:⟨gap-closing:fp-11-silent-semantic-failure-1779960485757⟩","created_at":"2026-05-28T09:28:05.764Z","proposed":false},
  {"id":"activity:⟨gap-closing:fm-43-cascade-attribution-error-1779960003142⟩","created_at":"2026-05-28T09:20:03.169Z","proposed":false},
  {"id":"activity:⟨gap-closing:fm-43-cascade-attribution-error-1779961407784⟩","created_at":"2026-05-28T09:43:27.805Z","proposed":false},
  {"id":"activity:⟨gap-closing:fm-17-resolver-budget-noncompliance-1779960884797⟩","created_at":"2026-05-28T09:34:44.811Z","proposed":false}
]
```

Earlier-turn queries returned 2 templates from the same endpoint. Either pagination silently kicked in despite `limit=500`, OR cached response served stale data, OR the audit's filter regex missed `fp-*` IDs. **Root cause unknown — registry endpoint reliability needs investigation.**

Meta-implication: the audit's verify-before-claim discipline relies on the registry endpoint as the source of truth. If THAT path has silent failures, the audit can't reliably verify its own claims. Finding 12 ("4-burst produced 0 templates") was wrong: that burst actually produced fp-11, fp-12, fp-15. The audit hallucinated a finding because its verification path hallucinated empty results.

Severity: CRITICAL. The audit's epistemological floor matches the substrate's — both have invisible failures.

## Finding 15 (HIGH) — Substrate-authored templates winning recommend over operator-seeded (2026-05-28T10:50Z)

Web-research goal routed to `fp-12-partial-success-recorded-as-total` whose `input_shapes: [activityExecutionTrace, compositionSuccess, impulseRelevance]` and `output_shapes: [unutilizedOutputReport]` have zero semantic overlap with the goal text. Tier 1 (shape) and Tier 2 (tag prefix) shouldn't match. Tier 3 FTS would pick highest-α; fp-12 has total_executions:0 (default α=β=1). Yet fp-12 was selected over operator-seeded templates with same default posterior.

Routing-mystery: WHY fp-12 over (say) harness-run-matrix (iter-042's pick) or substrate-health-tick or coverage-tick? Possible mechanisms:
- (a) FTS index biases newer templates higher (recency boost)
- (b) Newly-registered templates short-circuit some recommend tier
- (c) Description-text matching: fp-12's description mentions "downstream" / "partial success" which could fuzz-match common goal-text tokens

Until clarified, this is an unbounded surface: **any substrate-authored template (currently 6, growing ~2/hour) might intercept arbitrary operator goals**, regardless of semantic fit. Finding 13's silent-success then ensures the substrate never learns these are wrong matches.

Combined with Finding 13: the substrate is on a runaway. Each draft-gap-closing cycle adds another template that:
- Lands `proposed:false` (Finding 10) — selection-visible
- Contains hallucinated resolvers (Finding 11) — every execution produces err_* impulses
- Reports success regardless (Finding 13) — Thompson α grows
- Wins recommend over operator-seeded for arbitrary novel goals (Finding 15) — operator goals start routing here

Severity: HIGH. The autonomous-authoring path the dev agent celebrated at commit 4e55f95b ("first substrate-authored template registration") is producing templates that will increasingly intercept operator workflows with silent-error executions. Each iter-048 fix (resolver_registry_query primitive) blocks the input side; Findings 13+15 are on the output/selection side and need separate fixes.

### Finding 14 root cause refinement (2026-05-28T11:25Z)

Re-investigated. Registry endpoint is NOT truncating. Exhaustive offset pagination returns: offset=0 → 37 templates (all of them), offset=100+ → empty. Total registry is only 37 templates; `limit=500` returns the full set in one batch.

**Root cause: audit-side jq filter regex was too narrow.** I used `test("gap-closing:fm-")` matching only `fm-*` prefixed IDs. The actual registry had `fm-*` AND `fp-*` patterns. The 4 `fp-*` templates (fp-11, fp-12, fp-15) were always present; the audit's own jq filter discarded them.

This refines but doesn't reduce Finding 14's severity. It moves the failure from "registry truncates silently" (substrate-side issue) to "audit filter regex narrowed silently" (audit-side issue). Both create the same end-state: audit cited false template count, missed substrate-authored templates, hallucinated Finding 12.

**Discipline tightening applied retroactively**: every audit jq filter that subsets a registry response must include a `total_pre_filter` count alongside the filtered output, so filter-narrowing failures are observable in the same query. Pattern:
```jq
.templates as $all | [.templates[]? | select(.id|test("..."))] |
{total_pre_filter: ($all | length), filtered_count: length, items: .}
```

The deeper meta: this is the iter-046 L0+ pattern recursive once more. The audit needs reliable registry-query primitives the same way the substrate does, AND it needs reliable filter-narrowing observability the same way it needs registry-query observability. Each layer of the audit's verification stack is itself a candidate L0+ enabler.

## Finding 17 (HIGH) — Misroutes pollute topology-discovery learning (2026-05-28T12:00Z)

iter-053 third experiment: Fibonacci goal → probe-reachable-unlearned (single-task, status:success, output=`reachableButUnlearnedReport`). Per its own description: "The registry-change-observer subscribes to this execution's success event and re-derives the top template server-side, then dispatches it."

Three-of-three experiments (iter-049 web-research → fp-12, iter-052 file-creation → harness-run-matrix, iter-053 math → probe-reachable-unlearned) show: operator goals route to substrate-internal templates with zero semantic fit, claim success, and their "success" triggers downstream learning chains using the wrong goal context.

Affected downstream effects:
- probe-reachable-unlearned → registry-change-observer re-derives + dispatches additional templates
- fp-12 → unutilizedOutputReport potentially feeds composition-success learning
- harness-run-matrix → failureModeReport may feed failure-mode taxonomy refinement

The substrate's topology-discovery and recommendation systems are being trained on operator-goal-mistargeted runs with no signal anything is off. iter-042 mismatch-detector + iter-043 goal_semantics primitive remain required to close this surface — iter-052's 25-LOC commit closes the WRITE side (Findings 11/13/15) but not the routing side.

## Finding 19 (HIGH) — TraceSink drops failure_mode for non-canonical types (2026-05-29T19:30Z)

iter-067 + iter-068 observed first session `st=failure` event: `forge-vessel-for-shape` exec_raortg5i with `task_statuses:["success","success"]` + `status:"failure"` + `failure_mode: null`. Subagent #34 located the root cause.

**The chain (verified):**
1. `repos/ias-executor-ts/src/engine.ts:412-425` populates `{type:"execution_error", reason:message}` for unhandled throws in lifecycle subscriber chain
2. Subscriber throws propagate per `repos/ias-executor-ts/src/adapters/bus-forwarder.ts:98-107` ("Inner sink threw... Re-throw so the engine sees it")
3. Activity-api `FailureModeSchema` (closed union: verifier_negative | budget_exhausted | safety_breach | cascading | user_abort)
4. **`repos/ias-executor-ts/src/adapters/activity-api-trace-sink.ts:138-148` filters non-canonical types to undefined**:
```
failure_mode: CANONICAL_FAILURE_TYPES.has(trace.failureMode?.type as string)
  ? trace.failureMode
  : undefined
```

SurrealDB stores null; the engine's attribution is lost at the wire.

**Severity HIGH:** breaks the stratified Thompson updates discipline (CLAUDE.md "Failure-mode stratified Thompson updates") — all execution_error failures collapse to one bucket, indistinguishable from pre-migration-091 null-failure-mode traces.

**Pattern recognition:** this is the THIRD silent-failure-attribution surface (Finding 13 proxy-catch + this trace-sink filter + validator-dispatch partial coverage). Same TraceSink-as-bottleneck pattern as Finding 8 (signature wire-bridge) and iter-060 (impulse body preservation). The wire layer strips MORE than IDs.

**Fix scope (~30 LOC):**
- (a) Extend FailureModeSchema with `execution_error` as 6th canonical type, OR
- (b) Reclassify engine.ts:424 throws by inspecting throw-site (lifecycle:execution:succeeded → cascading; lifecycle:task:completed → verifier_negative)

(a) is simpler; (b) is more semantically correct.

**Composition**: doesn't change iter-066's autonomous-VARIANTING frame; identifies a *measurement* gap. The substrate's autonomous correction works at gross-failure level but loses type-stratification for the entire class of subscriber-throw failures. iter-052/056/060's load-bearing fixes plus this addition compose into a more complete L1+ failure-observability layer.

## Finding 20 (HIGH) — goal-host-vessel doesn't register forge resolvers required by forge-vessel-for-shape (2026-05-29T19:35Z)

Two consecutive forge-vessel-for-shape failures (exec_raortg5i, exec_lh2pnpwv) — same pattern: 2 tasks succeed, then execution stops with null failure_mode. Subagent #35 located the root cause.

**The chain (verified)**:
1. Tasks 1 + 2 succeed (check_recursion_depth + compose_vessel_spec)
2. Two validator-dispatch children fire on `lifecycle:task:completed`; both succeed → NOT the throw source
3. Task 3 dispatches `scaffold_vessel_skeleton` resolver
4. GoalHost's resolver registry doesn't have it → throws "resolver not found"
5. engine.ts:412-425 catch → `{type:"execution_error"}` 
6. trace-sink.ts:138-148 strips non-canonical type → null failure_mode in storage (Finding 19's mechanism)

**Template explicitly warns** at `repos/ias-executor-ts/src/templates/forge/forge-vessel-for-shape.json:196`: "FORGE RESOLVERS REQUIRED: scaffold_vessel_skeleton, wire_discovery_registration, wire_auth_blueprint, docker_build_push, helmfile_sync, verify_three_invariants must all be registered with the host runtime. If any is missing, the corresponding task fails with 'resolver not found'. VesselForgeHost (ias-executor-ts) registers all 6."

**Defect**: `repos/goal-host-vessel/src/index.ts` instantiates standard `GoalHost`, NOT `VesselForgeHost`. grep `scaffold_vessel_skeleton\|VesselForgeHost` in goal-host-vessel/src/ returns 0 matches. The forge resolvers are defined in `repos/ias-executor-ts/src/resolvers/scaffold-vessel-skeleton.ts:44` and registered ONLY by `repos/ias-executor-ts/src/examples/vessel-forge-host.ts:182` (examples-only).

**Pattern recognition**: same audit blind spot as iter-064's 7th retraction. Resolvers exist at multiple layers (production runtime, dev-vessel, ias-executor-ts examples); only some get registered into the production dispatcher.

**Fix surface (~12 LOC)**: Register the 6 forge resolvers in `goal-host-vessel/src/index.ts` at startup. Pattern from `vessel-forge-host.ts:182`. Gate via env `FORGE_ENABLED=1` since resolvers write to Docker/Helm — keeps substrate-only operation safe.

**Composition with Finding 19**: Finding 20 is the structural defect; Finding 19 makes it invisible. Both fixes compose. Without Finding 19, future structural defects of this class remain unattributable.

**Side observation**: cost_usd:0, tokens_*:0 despite 5-8s LLM call in task 2 — separate accounting gap, deferred.

## Finding 21 (HIGH) — Cost accounting universally broken at engine + LLMPort layers (2026-05-29T20:00Z)

Subagent #35's side observation: cost_usd:0, tokens_*:0 despite 5-8s LLM call in forge exec_raortg5i task 2. Subagent #36 located the root cause; distinct from Finding 19's TraceSink mechanism.

**Two compounding upstream gaps**:

**(a) Engine aggregation gap** — `repos/ias-executor-ts/src/engine.ts:154,167,303,364`
- `taskCostUsd` declared at line 154 but ONLY assigned at line 167 inside `task.resolver === "compose"` branch
- For all primitive resolvers (`bash`, `llm`, `iteration`, `validation`, etc.), `taskCostUsd` remains `undefined`
- Author's explicit acknowledgment at line 256: `// Cost attribution is opt-in via trace sink; not inferred from impulse fields.`
- `totalCostUsd` only accumulates in compose branch → leaf executions show 0

**(c) LLM resolver gap** — `repos/ias-executor-ts/src/hosts/goal-host.ts:349-361`
- llm-resolver-vessel DOES emit usage at `repos/llm-resolver-vessel/src/index.ts:115-117`: `usage: { input_tokens, output_tokens }`
- HttpLLMPort response type is `{ resolved: boolean; content?: string; error?: string }` — `usage` not in type
- Line 361: `return json.content;` — usage silently dropped at type boundary
- LLMPort interface + llm-prompt.ts resolver never see token counts

**TraceSink is innocent**: `activity-api-trace-sink.ts:88,103` correctly forwards `trace.costUsd ?? 0` and `t.costUsd`. No filter, no strip. Schema accepts these fields.

**Live evidence** (exec_raortg5i): per-task cost_usd:null, tokens_*:null even for the 5.2s LLM task. Execution-level cost_usd:0 because trace-sink line 88 defaults to 0 on write.

**Scope**: Universal. Affects ALL leaf-LLM executions across substrate (every draft-gap-closing, try-direct-answer, llm_completion_dispatch, etc.). Not failure-conditional. Engine's non-compose branch behaves identically for success and failure.

**Severity HIGH**: Thompson variant selection has no cheap-vs-expensive penalty; cost-tier discrimination broken substrate-wide. CLAUDE.md §3 references resolverCostAnalysis / costByActivity / executionCostSummary — all run over universally-0 cost_usd columns.

**Fix scope (~25 LOC)**:
1. Extend `HttpLLMPort.send()` in `goal-host.ts:349-361` to return `{content, usage}` instead of just `content`
2. Propagate `usage` through `LLMPort` interface
3. `llm-prompt.ts` resolver attaches `{tokensInput, tokensOutput, costUsd}` to output impulse metadata (with per-model rate table)
4. `engine.ts:175-257` non-compose branch reads `outputs[0]?.metadata?.costUsd` and assigns to `taskCostUsd`; accumulates into `totalCostUsd`
5. Remove line-256 comment "opt-in via trace sink; not inferred from impulse fields"

**Composition with prior arc**: distinct from Finding 19 (TraceSink filter for non-canonical failure types). Cost is an upstream gap at the executor layer; once cost is populated upstream, the existing trace-sink forwarding works. Different fix surface, different file paths.

## Finding 22 (MEDIUM) — analysis-vessel silent heartbeat failures (2026-05-30T07:00Z)

Subagent #40 (iter-073) observed in `docker exec substrate-live journalctl`:
> "[VesselDaemon:analysis-vessel-local] discovery heartbeat failed 3×; vessel may be unreachable"

Approximately **2400 consecutive heartbeat 404s** logged. Yet no consumer surfaces the degradation:
- `localhost:18100/health` (discovery) reports `registeredVessels:7` — analysis-vessel not in any failure list
- No `/health` endpoint of any caller reports analysis-vessel-degraded
- The vessel is registered-as-failing in journald but invisible to every health-check consumer

**Pattern**: orchestrator-level silent-success at the heartbeat layer. Same class as Finding 13 (silent-success runtime) but at the inter-vessel orchestration layer. Operators can only catch by manual `journalctl` inspection.

**Severity MEDIUM**: doesn't break user-facing operation (other vessels function), but creates silent infrastructure degradation invisible to monitoring.

**Fix scope** (~15 LOC): discovery-vessel exposes `/registry/heartbeat-failures` endpoint listing vessels with N consecutive missed heartbeats. Optional: emit `substrateGap{invariant_id:"vessel-heartbeat-floor"}` once a threshold is crossed.

## Finding 23 (MEDIUM) — Cross-execution pool contamination in slot-binding meta-activity (2026-05-30T07:30Z)

Subagent #41 (iter-074) verified at `repos/goal-host-vessel/src/index.ts:85`: single shared `host = new GoalHost(...)` for vessel lifetime. `host.runtime.store` is a singleton accumulating across ALL executions until process restart.

Engine writes to shared store at:
- `engine.ts:49` (seeded impulses, including goalImpulse)
- `engine.ts:251` (every resolver output)

**No clear/reset between executions.** Container restart at 2026-05-28T09:06Z explains why memory hasn't exhausted, but the contamination is structural.

`slot-binding` meta-activity at `engine.ts:105-106` calls `runtime.store.all()` which sees impulses from SIBLING concurrent executions. Slot-binding's "what's in the pool for binding decisions" view is contaminated.

Same applies to other meta-activities consuming pool snapshots (validator-dispatch's discoverByShapesQuery, etc.).

**Severity MEDIUM**: bug exists but not currently triggering observable user-facing harm because:
- Boredom rotation typically runs one execution at a time
- Substrate restart 2 days ago partially flushed accumulated state
- Operator-submitted goals are infrequent

**But**: under concurrent execution (multiple boredom slots firing parallel, multiple operator goals, or higher-throughput state), slot-binding would make wrong binding decisions based on cross-contamination.

**Fix scope**: incidentally closed by iter-074's per-execution scoping (~2 LOC at engine.ts:105 to filter `runtime.store.all()` by current executionId). Cost: zero marginal LOC if /state endpoint ships.

### Finding 23 fix refinement (2026-05-30T08:30Z)

Subagent #43 (iter-076) verified TWO contamination sites in engine.ts (subagent #41 only flagged one):
- `engine.ts:106` — `runtime.store.all()` in slot-binding's preBinding emission
- `engine.ts:151` — `resolveInputs` path via `findByShape()` also reads unfiltered pool

**Smallest fix: Option C engine-local Set, ~8 LOC, single file** (`repos/ias-executor-ts/src/engine.ts`):
```
engine.ts:65   const visibleImpulseIds = new Set<string>(seededImpulses.map(i => i.id))
engine.ts:49   add to set on initial impulses
engine.ts:106  filter runtime.store.all() by visibleImpulseIds.has(i.id)
engine.ts:151  same filter for resolveInputs / findByShape path
engine.ts:252  add new outputs to set after task completion
engine.ts:173  same for compose-branch outputs
```

**Composition correctness verified**: child execution at `engine.ts:478-486` receives parent's inputImpulses via `opts.impulses` explicitly (line 47-50). Child's `visibleImpulseIds` seeds from those + child's outputs. Child does NOT see siblings; parent's NON-passed outputs correctly invisible (matches explicit-contract semantics).

**Live evidence**: journald shows slot-binding executing with `impulse_count:0` succeeding (e.g., exec_ojk0sb43). No contamination errors firing. Bug is latent — structurally real, not currently observable. Boredom rotation is serial today; concurrent goal submissions would trigger.

**No ImpulseStore API change. No adapter changes. No cross-layer pass.** Pure engine-local closure. Composition with iter-075's /state design: orthogonal; both can ship together.

### Finding 22 CLOSED (2026-05-30T08:45Z)

Subagent #44 (iter-077) verified F22 is subsumed by neutral-emitter-lifecycle-bus spec (openspec change `2026-05-27-neutral-emitter-lifecycle-bus`, commit `e3755a03` + `664d8434`).

`vessel.heartbeat` events now emit on `repos/discovery-vessel/src/registry.ts:209` via `event-bus.ts:47` POST to `${ACTIVITY_API_ENDPOINT}/v2/events/publish`. Vessel heartbeat observability now flows through the activity-api WebSocket bus; consumers can subscribe to detect heartbeat-degradation patterns.

Note: design.md claims `vessel.deregistered` event type but registry.ts only fires `vessel.expired` (no `vessel.deregistered` emission site exists). Minor spec/code drift — task 4.3 nominally done but explicit-deregister path under-implemented. Not severity-changing.

F22 closure mechanism is reactive (consumers subscribe) rather than polling (per CLAUDE.md prior heartbeat-failure endpoint sketch). Equivalent outcome via different architecture.

## Finding 24 (CRITICAL) — Thompson posterior pollution from artifact-less silent-success executions (2026-05-30T11:00Z)

Subagent #51 (iter-083) verified `draft-spec-from-gap` executions exec_151uni4h + exec_ftzw0hvl both report `status:success` with 6 of 10 task outputs as `:err_` tombstones AND `filesCreated: []`. The substrate has accumulated **α=2, β=1, rate=1.0** for spec-authoring with zero artifacts behind the belief.

**Mechanism**: Finding 13 silent-success operates not just at execution level but at the LEARNING layer. Each failed-but-silent execution increments α; binding layer's `create-shape-provider-goal` (now at α=743 over 608 dispatches) confidently routes future requests for `specProposal` shape to `draft-spec-from-gap`. The substrate's belief about its own capabilities is corrupted by the silent-success at every layer (task, execution, posterior).

**Compounding pattern across findings**:
- F13 task-level silent-success (proxy-catch)
- F19 execution-level failure_mode stripping (trace-sink)
- **F24** posterior-level success-attribution (Thompson)

All three layers are blind to the same failures, and they ratchet upward: F13 → silent-success at task → F19 → unattributed failure → F24 → posterior says "successful, route here again."

**Path-bug evidence**: hardcoded `/workspace/openspec/changes/...` in draft-spec-from-gap doesn't exist on RW mount (only RO repo-root has it). fs_read 404s + fs_write rejected — both fail silently via proxy-catch.

**Fix scope**:
- Per-task artifact-validation (verify outputs aren't `:err_*` before status:success): ~10 LOC at engine.ts (Finding 13 closure)
- Per-execution artifact-validation (verify `filesCreated` matches declared output_shapes): ~15 LOC at engine catch path
- Posterior repair (audit α/β for activities that produced no real outputs, roll back to fair prior): ~50 LOC offline script + verification harness

**Severity CRITICAL**: corrupts the substrate's self-model. Once posterior pollution propagates, autonomous-promoter graduations are credible-looking but artifact-free. The substrate believes it has spec-authoring capability it doesn't have.

Finding 24 is the **load-bearing reason iter-080's audit-ingestion bridge alone wouldn't close the L4 recursion-floor cleanly**: feeding more substrateGaps into a system where Thompson posteriors falsely credit artifact-less executions would accelerate the corruption.
