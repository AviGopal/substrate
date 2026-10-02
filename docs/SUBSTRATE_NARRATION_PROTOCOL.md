# Substrate-Narration Protocol

An operator-side validation methodology. Operational tooling lives at
`validation/scripts/substrate-narrator.ts`; gap accumulation lives at
`validation/gaps/`.

The protocol is in force at every point on the S1 → S2 → S3 trajectory, and what
it measures shifts as the operator's role does. Early on, gaps mark what the
operator must supply for the substrate to be explicable at all. Later, they are
evidence for the push-away criterion: a gap the substrate closes on its own,
without operator prompting, is a gap that no longer needs an operator, and the
count of those trending upward is the same signal as the intervention rate
trending toward zero.

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

The protocol is the operator-vessel's observation channel, and it feeds the
gap-as-impulse pattern proposed in
`openspec/changes/2026-05-23-intervention-tracking/`. It is the mirror image of
a substrate-public report: those describe substrate-internal state to the
outside, while a gap record describes operator-internal load-bearing knowledge
to the substrate. Both are needed to say honestly what the system does and does
not know about itself.

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
   chosen to persist for itself. Queryable by resolving the `memoryNote`
   shape against development-vessel.
7. **fs_read against substrate-extracted artifacts only** — a file is
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

Each operator description attempt produces one Markdown record under
`validation/gaps/<gap-id>-<slug>.md` — YAML frontmatter carrying the
machine-readable fields, then prose. Records are appended; existing records are
not rewritten (a recurrence is noted by bumping `recurring_count` and
`last_observed`).

The frontmatter block:

```yaml
---
gap_id: gap-NNN                 # monotonic, zero-padded; matches the filename prefix
category: <category from §D>
severity: none | minor | substantive | blocking
observed_first: <ISO 8601>
last_observed: <ISO 8601>
recurring_count: <int>
bridge_path: <the §E mechanism expected to close it>
---
```

The body carries the narration itself, under these headings:

- `# Gap NNN — <one-line claim>` — the title states the deficit, not the event.
- `## Observation` — what the substrate did, quoted from the trace / event with
  its identifiers, so the record is re-checkable later.
- `## Attempted description (substrate-side only)` — the explanation built from
  the t-0 surface alone, and the precise point at which it ran out.
- `## Knowledge used` — split into `### Substrate-side:` (what the queries in §F
  actually returned) and `### Operator-side gaps:` (each gap tagged with its §D
  category, its severity, and its own `bridge_path`).
- `## Verdict` — `description_completed_within_substrate_knowledge` (true /
  false / partial) and `gap_severity`.
- `## Coordination` — optional; what each other party needs to do about it.

One description record may surface several gaps. Each entry under
`### Operator-side gaps:` is its own gap-record candidate, and gaps recur across
multiple description records. The record is the unit of WORK; the gap is the
unit of ACCUMULATION, tracked in `validation/gaps/INDEX.md`.

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
   substrate's t-0 surface per §B.7.
6. **`training_knowledge`** — explanation drew on LLM general training
   (Bun semantics, WebSocket protocol, SurrealDB syntax). Often
   irreducible at the LLM-resolver layer but sometimes refinable into a
   substrate concept.
7. **`irreducibly_operator`** — explanation drew on knowledge that is
   structurally outside the substrate's surface and should remain so
   (operator strategic intent, cross-substrate coordination, business
   context). These accumulate as the standing evidence for what the substrate
   cannot take over — the residue the operator role decays toward but never
   below.

## §E. Bridge paths

Each gap category has an expected mechanism to close it. Bridge paths are
the substrate-side activities that consume gap records as evidence.

| Gap category | Bridge path | Mechanism |
|---|---|---|
| `missing_concept` | `extract-concepts-from-docs` / direct concept-db creation | Operator creates the concept; gap closes when concept is referenced by a trace |
| `missing_idiom` | ribosome (template extraction) | Substrate's `lifecycle:execution:succeeded` ribosome activity promotes the pattern to a template |
| `missing_pattern` | posterior surfacing (an aggregator activity over traces) | An aggregator activity emits the generalization as a queryable report shape |
| `conversation_only` | memoryNote extraction | A `memoryNote` impulse is written to development-vessel; the context is then substrate-held rather than session-held |
| `doc_unread` | `extract-concepts-from-docs` | Run the doc through concept-extraction; the doc joins the t-0 surface |
| `training_knowledge` | accept (low priority) OR concept extraction (high priority) | If the training-knowledge fragment is load-bearing across many gaps, promote it to a substrate concept |
| `irreducibly_operator` | accept as operator-only | No bridge. The gap is evidence that the operator role decays toward zero without vanishing |

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
   - `GET /v2/activities/execution-traces/<event.execution_id>` (one trace by
     id; the collection route `GET /v2/activities/execution-traces` filters by
     `activity_id`, `variant_id`, `success`, `parent_execution_id`, and a date
     window)
   - `GET /concepts/search?query=<event.task_summary>` — the search route reads
     `query`; it also accepts `shape`, `source_type`, `min_relevance`, `limit`,
     `offset`
   - `GET /v2/activities/templates?q=<event.task_keywords>` (BM25 full-text over
     the template registry)
   - `GET /registry/stats` (vessel inventory)

4. **Operator attempts the description** using ONLY what those queries
   returned plus the snapshot at `validation/observations/snapshots/`. Any
   reach outside that → a gap, logged per §C.

5. **Operator writes the description record** to
   `validation/gaps/<gap-id>-<slug>.md`, per §C.

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
the intervention-rate-trending-to-zero criterion, applied to the narration
channel rather than the action channel.

## §G. Intervention emission protocol

The narration protocol doubles as the channel through which operator actions are classified and recorded. An operator working alongside the substrate should watch for the following and log each one as an intervention record:

- **Commits from the operator's git author identity** that modify substrate vessel source files — detected by comparing `git log --author` against the set of operator-known identities versus the substrate's own author. In-container commits are made as `Substrate Autonomous <substrate-autonomous@substrate.local>` (overridable by `SUBSTRATE_GIT_AUTHOR_NAME` / `SUBSTRATE_GIT_AUTHOR_EMAIL`), so a commit touching `repos/development-vessel/src/` under an operator identity is an intervention while the same change under the substrate's identity is substrate-authored.
- **Direct `docker exec` commands** that mutate substrate state without going through the activity system — for example, manually editing `/etc/substrate/env`, running a SurrealDB SQL statement directly, or modifying a unit file.
- **Writes to `validation/state/` files** by the operator — lift-status updates, coordination file edits, manual gap overrides. These are actions against substrate-measured signals.
- **Forced closure gate passes** — any edit to `validation/scripts/closure-audit.ts` or a coordination file that makes a gate pass by assertion rather than by the substrate earning the pass.

Each intervention should be classified into one of three categories:

- `maintenance` — routine operational action that does not override substrate judgment (e.g. restarting a crashed unit, rotating a secret, fixing a broken port mapping).
- `intervention` — operator overriding or short-circuiting substrate judgment (e.g. manually editing a Thompson posterior, forcing a closure gate, reverting a substrate-authored commit).
- `redundant` — operator performing an action the substrate was already in the process of performing (e.g. manually seeding a template the ribosome was about to extract).

`maintenance` counts do not contribute to the intervention-rate signal; `intervention` and `redundant` counts do. The distinction matters for reading the S2→S3 trend correctly.

## §H. Operator-as-vessel framing

The structural shift the trajectory aims at changes the operator's relationship to the substrate. Rather than standing as an external authority above the system, the operator moves toward being a **registered participant within it**: an entity with an identity the substrate can model, an intervention history it can accumulate, and therefore a claim it can contradict.

`interventionRefused` is where that lands. It is served by `development-vessel` and is the push-away signal for S2→S3 — the substrate saying "I have evidence against this; here is the evidence; here is what you should do instead." A refusal is only meaningful if the substrate holds the evidence itself, which is why the memory and concept stores being substrate-resident is a precondition and not a nicety.

The operator's remaining role is not to be absent but to be the one entity the substrate cannot forge — the source of genuine adversarial intent for which the substrate has no prior. That is an irreducibly operator function; the rest is absorbable.

Until an operator registration exists as a first-class vessel with its own advertised shape contract, the narration protocol is the bridge: it is how operator actions enter the substrate's observation model at all, even when they are not yet emitted as typed impulses with a vessel origin.
