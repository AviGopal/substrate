# Substrate-Narration Protocol

**Status:** operator-side validation methodology. Operational tooling lives at
`validation/scripts/substrate-narrator.ts`; gap accumulation lives at
`validation/gaps/`.

## §A. Purpose

The substrate (the deployed vessel fleet — discovery-vessel + activity-api +
identity-vessel + development-vessel + concept-db + user-vessel + others)
has, at any moment `t`, a defined **knowledge surface**: everything the
substrate itself can resolve, query, or learn from. The narration protocol
enforces a single discipline:

> When an operator agent observes the substrate running, the operator MUST
> attempt to describe what the substrate is doing using ONLY the substrate's
> t-0 knowledge surface. When explanation requires reaching outside that
> surface, the deficit is a **gap** — knowledge that should be in the
> substrate but isn't.

Tracking gaps over time produces the **bridge-priority list**: which
operator-side knowledge is most frequently load-bearing for explaining
substrate behavior, and therefore highest-leverage to extract into
substrate-queryable form.

The protocol is the operator-vessel's observation channel
(`openspec/changes/2026-05-23-operator-and-public-contracts/`) and feeds the
intervention-tracking gap-as-impulse pattern
(`openspec/changes/2026-05-23-intervention-tracking/`). It is structurally a
counterpart to `chainStallReport` / `interventionRateReport` —
substrate-public reports describe substrate-internal state; gap records
describe operator-internal load-bearing knowledge.

## §B. The t-0 knowledge surface

At any moment `t`, the substrate's knowledge surface includes:

1. **concept-db** — concepts, edges, snapshots, usage stats. Queryable via
   `GET /concepts/...` on the concept-db vessel.
2. **activity templates** — the activity registry held by activity-api.
   Queryable via `GET /v2/activities/templates`.
3. **shapes** — the union of `output_shapes` advertised by templates and
   resolver shape declarations in discovery-vessel. Implicit; recoverable
   from a snapshot of templates + discovery registry.
4. **execution traces** — every recorded execution, including
   `composition_chain`, `failure_mode`, per-task `input_impulse_ids` /
   `output_impulse_ids`. Queryable via `/v2/activities/execution-traces`.
5. **vessel registry** — discovery-vessel's view of who is registered,
   their resolver contracts, and their advertised shapes.
6. **memoryNote impulses** — substrate-internal notes the substrate has
   chosen to persist for itself. Queryable via the standard impulse-resolve
   path.
7. **hash-chains** — `2026-05-23-trace-hash-chain` adds tamper-evident
   chaining; queryable per that spec.
8. **fs_read against substrate-extracted artifacts only** — a file is
   on the surface IF the substrate has extracted concepts / patterns /
   templates from it (via `extract-concepts-from-docs`, ribosome, etc.).
   A file that is readable via the filesystem but whose contents have
   NOT been concept-extracted does NOT count.

**Explicitly NOT on the t-0 surface:**

- Operator memory / conversation context
- Unread documentation (any markdown / openspec proposal the substrate
  has not concept-extracted)
- LLM general training knowledge invoked by an operator-Claude session
- Reasoning chains the operator constructs from outside artifacts

A description that draws on any of those is a **gap**.

## §C. Description record format

Each operator description attempt produces one YAML record under
`validation/gaps/<gap_id>.yaml`. Records are appended; existing records are
never edited (operator notes a recurrence by incrementing the index).

```yaml
event_id: <id from substrate event stream>
event_type: task.completed | task.failed | impulse.resolved | activityRegistryChange | ...
event_summary: <what happened>
substrate_state_at_t0:
  concept_count: <int>
  template_count: <int>
  recent_trace_count: <int>
  notable_concepts_present: [list]
  notable_concepts_absent: [list]
attempted_description: <what the substrate is doing>
knowledge_used:
  substrate_side:
    - concept: "<concept_id from concept-db>"
    - trace: "<trace_id reference>"
    - template: "<template_id reference>"
    - shape: "<shape_name>"
  operator_side_gaps:
    - kind: <category from §D>
      description: <what was needed>
      source: <where I got it>
      bridge_path: <category from §E>
verdict:
  description_completed_within_substrate_knowledge: true | false | partial
  gap_severity: none | minor | substantive | blocking
```

Each `operator_side_gaps[]` entry is its OWN gap-record candidate; gap IDs
are assigned in `validation/gaps/INDEX.md` and may recur across multiple
description records. The record is the unit of WORK; the gap is the unit
of ACCUMULATION.

## §D. Gap categories

Seven categories; pick the narrowest that fits. If a gap straddles two
categories, note both and let the bridge_path disambiguate.

1. **`missing_concept`** — explanation required a concept that the
   substrate plausibly should hold but does not have a record for in
   concept-db. Example: explaining a `task.failed` required the concept of
   "validator escalation policy" but no such concept exists.
2. **`missing_idiom`** — explanation required a substrate-resident idiom
   or pattern (a recurring sequence of activities, a typical
   shape-chain) that has not been extracted into a template or concept.
   The substrate may have the raw traces but has not promoted the pattern.
3. **`missing_pattern`** — explanation required generalization across
   traces (e.g., "this failure mode follows the F-V58 dense-search
   pattern") that the substrate's posterior accumulator does not yet
   surface as queryable.
4. **`conversation_only`** — explanation drew on prior conversational
   context (this session, an earlier operator-Claude turn) that the
   substrate has never seen. Strong candidate for memoryNote extraction.
5. **`doc_unread`** — explanation drew on a document (markdown,
   openspec proposal, README, design doc) that the substrate has not yet
   concept-extracted. The artifact EXISTS in the repo but is NOT on the
   substrate's t-0 surface per §B.8.
6. **`training_knowledge`** — explanation drew on LLM general training
   (Bun semantics, WebSocket protocol, SurrealDB syntax). Often
   irreducible at the LLM-resolver layer but sometimes refinable into a
   substrate concept.
7. **`irreducibly_operator`** — explanation drew on knowledge that is
   structurally outside the substrate's surface and should remain so
   (operator strategic intent, cross-substrate coordination, business
   context). These accumulate as evidence for §27.S.6 — what the
   substrate CANNOT take over post-lift.

## §E. Bridge paths

Each gap category has an expected mechanism to close it. Bridge paths are
the substrate-side activities that consume gap records as evidence.

| Gap category | Bridge path | Mechanism |
|---|---|---|
| `missing_concept` | `extract-concepts-from-docs` / direct concept-db creation | Operator creates the concept; gap closes when concept is referenced by a trace |
| `missing_idiom` | ribosome (template extraction) | Substrate's `lifecycle:execution:succeeded` ribosome activity promotes the pattern to a template |
| `missing_pattern` | posterior surfacing (chainStallReport, interventionRateReport, new aggregator activity) | New aggregator activity emits the pattern as a queryable report shape |
| `conversation_only` | memoryNote extraction | Operator (or operator-Claude post-lift) writes a memoryNote impulse; substrate now holds the context |
| `doc_unread` | `extract-concepts-from-docs` | Run the doc through concept-extraction; the doc joins the t-0 surface |
| `training_knowledge` | accept (low priority) OR concept extraction (high priority) | If the training-knowledge fragment is load-bearing across many gaps, promote it to a substrate concept |
| `irreducibly_operator` | accept as operator-only | No bridge. Gap is evidence for §27.S.6's "operator role decays toward zero, but does not vanish" |

## §F. Workflow

1. **Operator starts the narrator**:
   ```bash
   bun run validation/scripts/substrate-narrator.ts
   ```
   The narrator subscribes to activity-api `/ws`, writes JSONL event logs
   under `validation/observations/events-<YYYY-MM-DD>.jsonl`, and snapshots
   the substrate's knowledge surface every 5 minutes under
   `validation/observations/snapshots/`.

2. **Operator selects events of interest**. Not every event needs
   narration — the protocol is sampling-based. Reasonable triggers:
   - Every `task.failed` (failure modes are highest-leverage).
   - Every `impulse.resolved` of an unfamiliar shape.
   - Every `activityRegistryChange` (templates appearing or disappearing).
   - A periodic sample (e.g., 1-in-N `task.completed` events).

3. **Operator queries the substrate's t-0 surface** before attempting
   description. Suggested first queries:
   - `GET /v2/activities/execution-traces?id=<event.execution_id>`
   - `GET /concepts/search?content=<event.task_summary>`
   - `GET /v2/activities/templates?q=<event.task_keywords>`
   - `GET /registry/stats` (vessel inventory)

4. **Operator attempts the description** using ONLY what those queries
   returned plus the snapshot at `validation/observations/snapshots/`. Any
   reach outside that → a gap, logged per §C.

5. **Operator writes the description record** to
   `validation/gaps/<gap_id>.yaml`.

6. **Operator updates `validation/gaps/INDEX.md`** — increments
   `recurring_count` for any gap that matches an existing entry; creates
   a new row otherwise.

7. **Periodic review**: the bridge-priority list is `INDEX.md` sorted by
   `recurring_count × gap_severity`. The top of the list is the highest-
   leverage substrate-side work.

The substrate's failure modes appear as gap **accumulation patterns**: a
class of events that consistently force the operator to reach into
`missing_concept` or `missing_idiom` is precisely what the substrate's
ribosome / concept-extractor should target next. This is the same logic as
§27.S.6's intervention-rate-trending-to-zero criterion, applied to the
narration channel rather than the action channel.
