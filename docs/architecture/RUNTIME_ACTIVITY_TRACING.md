# Runtime Activity Tracing

Runtime tracing applies the impulse/activity/trace model to request-time execution: an HTTP
request handled by a vessel is an activity, the functions it calls are resolvers, and the
record it leaves is an execution trace in the same store the development loop learns from.
This document states what such a trace must carry to be **learnable**, and what the substrate
is entitled to conclude from one. Foundational model:
[`IMPULSE_ACTIVITY_FOUNDATION.md`](./IMPULSE_ACTIVITY_FOUNDATION.md). Per-resolver
attribution: [`RESOLVER_TRACKING.md`](./RESOLVER_TRACKING.md).

The request-time instrument lives at `repos/activity-api/src/middleware/runtime-tracing.ts`,
which exports `RuntimeTracingConfig`, `RuntimeActivityContext`, `RuntimeExecutionTrace`,
`runtimeTracingMiddleware`, `withResolver`, and `RUNTIME_QUERIES`. It is a library with no
mounted call site — nothing installs the middleware on a route — so read what follows as the
contract instrumentation must satisfy, not as a description of traffic already flowing. A
module with no call sites cannot be observed failing, so it cannot be trusted when it passes;
mounting it is the precondition for any claim made from its output.

## Meta-Trace Types (L1/L2)

A single goal leaves more than one row, and the rows are stratified so the learner can grade
at the right altitude.

- **L1 `goal_resolve`** — one row per user-facing goal, wrapping the whole goal-seeking flow
  (recommendation, selection, execution). It lets cost and outcome be correlated with the
  originating goal without walking resolver-level detail.
- **L2 `activity_execute`** — one row per activity invocation, wrapping that activity's tasks
  and their resolver calls.
- **L3** — per-resolver entries in `impulse_resolutions`, the leaf layer described below.

Nesting is reconstructable from `execution.parent_execution_id` plus `execution.composition_chain`,
a denormalized root-first ancestor chain that makes a tree readable in one query.

Meta-trace rows carry a *synthetic* variant id (`_goal_resolve`, `_activity_execute`) and name
the real dispatched template in `metadata.template_id`. Trace ingest in activity-api resolves
both ids and propagates the outcome to each, because grading only the synthetic bucket would
mean a goal-level abort never moves the dispatched template's β — the system would learn from
successes alone. Any new meta-level must preserve that property: **a wrapper row must never
absorb a failure that belongs to the thing it wrapped.**

## Overview

The same machinery serves two timescales. Development-time activities (the substrate authoring
and landing its own changes) and runtime activities (a vessel serving a request) write into one
`execution` store, are selected by one Thompson learner, and are read back by one set of
queries. Nothing about the learning loop is specialized to the minute-scale case; extending it
to the millisecond-scale case is a matter of emitting conformant traces, not of building a
second observability system alongside the first.

## The Core Insight

**Applications are vessels executing activities.**

A goal walk receives an input impulse, executes an activity as a sequence of resolvers,
produces output impulses, and records a trace. A request handler receives an HTTP request
(input impulse), executes a route handler as a sequence of resolvers (auth, DB query,
serialization), returns a response (output impulse) — and can record a trace of exactly the
same shape. Same model, same infrastructure, different timescale. The only thing the request
path lacks by default is the last step.

## Why This Matters

Three things follow from putting runtime execution into the learning store rather than into a
separate metrics pipeline. Each is a claim about what the substrate can then *do*, not about
what a dashboard can then display: a number nothing reads at decision time is an archive, and
the point of unifying the stores is that the same reader already exists.

### 1. Unified Observability

Development activities, runtime request handling, and infrastructure operations resolve
through one query surface and feed one learner. The expectation is that answering "what did
this vessel spend its time on" requires no join across systems and no correlation by
timestamp — the composition chain already ties a slow resolver to the activity that called it
and the goal that dispatched that activity.

### 2. Continuous Optimization

From conformant traces the system can identify which code paths run most often, which
resolvers dominate latency, which impulse shapes precede failures, and which resolvers are
shared across many activities. Each of those is a query over fields the trace already carries,
so the derived work — cache this, batch that, extract this shared resolver — is a goal the
substrate can generate from its own observations rather than one an operator must author.

### 3. Evidence-Based Refactoring

The target of an optimization is chosen from recorded call counts and latencies, and the
result is confirmed by the same measurement taken after the change. This is the same
counterfactual discipline the walk applies to activity selection: change one thing, record
that you changed it, and read the delta from traces that span the change — never from a
before-and-after impression.

## Architecture

Runtime tracing is three nested scopes (request, function, full) written through one context
object into one trace row. The instrument is deliberately thin: a middleware that opens a
context per sampled request, a wrapper that appends a resolution per instrumented function,
and an asynchronous write at request end. Nothing in the hot path blocks on the trace store.

### Tracing Levels

`RuntimeTracingConfig.level` selects the scope:

- **`request`** — the whole HTTP request is one activity; the handler is a black box. Lowest
  overhead, and enough to answer which endpoints carry the traffic.
- **`function`** — key functions are wrapped as resolvers via `withResolver`, so latency is
  attributed rather than aggregated. This is the level at which bottleneck claims become
  defensible.
- **`full`** — every call traced, producing a complete impulse-transformation graph. Its cost
  is proportional to its detail; it belongs in development and staging.

### Sampling Strategy

`runtimeTracingMiddleware` short-circuits entirely when `config.enabled` is false, and
otherwise skips any request where a uniform draw exceeds `config.sampleRate`. Errors and slow
requests deserve to be sampled at a higher rate than the baseline, since they carry most of
the information and occur least often.

A caveat that matters more than the numbers: a rate frozen at process start from configuration
is bootstrap state, invisible to traces and to the walk, and therefore unlearnable. A sampling
policy the substrate can actually tune must be a shaped impulse read at use time — the
in-process constant is a floor, not the mechanism.

### Storage

Runtime traces need **no new table**. They are `execution` rows, distinguished only by
`metadata.runtime_trace = true`, and they use fields the table already defines:
`activity_id`, `vessel_id` and `vessel_version`, `input_impulses`/`output_impulses` with their
`input_impulse_shapes`/`output_impulse_shapes`, `success` and `error`, `duration_ms`,
`cost_usd`, `tokens_in`/`tokens_out`, `state_signature` and `git_state`, `parent_execution_id`
and `composition_chain`, and the honest verdict fields `reached` and `completion_shapes`.
Per-resolver detail lands in `impulse_resolutions`.

Content-heavy payloads (`tasks`, `state_snapshot`, `execution_trace`, `impulse_resolutions`,
`output_impulses`) split into `execution_trace_content`, joined on a unique `execution_id`, so
that scanning traces for learning does not drag full payloads through every query.

**What makes a trace learnable** is the subset that lets a later reader answer a
counterfactual: which activity ran, under which state signature, producing which output
shapes, and whether the goal was *reached* — not merely whether the process exited cleanly.
A row missing `reached` or missing its output shapes is storage, not evidence.

### Learning Queries

`RUNTIME_QUERIES` in the tracing module carries four query strings, each scoped by
`metadata.runtime_trace = true` over a recent window. What each is *intended* to report:

- **`hotPaths`** — execution count, mean and p95 duration, and failure count per activity.
- **`resolverPerformance`** — call count, mean and p95 latency, and summed cost per resolver
  and tier, ordered by total time so frequency and slowness are weighed together.
- **`errorPatterns`** — failures grouped by activity and status code, with the failing
  resolvers surfaced.
- **`reuseOpportunities`** — resolvers used across many distinct activities, ranked by reuse
  factor.

Read that list as intent rather than as results available today, because two defects sit
between the strings and the store they claim to read. First, `hotPaths`, `errorPatterns` and
`reuseOpportunities` each project or group on `activity_template_id`; the `execution` table is
declared `SCHEMAFULL` and defines `activity_id` instead, and nothing under
`repos/activity-api/sql/` defines the former field. Second, `errorPatterns` carries a subquery
selecting `FROM impulse_resolutions` — that name is a *field* (defined on `execution` and on
`execution_trace_content`), not a table anywhere under `repos/activity-api/sql/`.
`resolverPerformance` is the one query of the four that avoids both defects: it traverses
`execution.impulse_resolutions` as a field and groups by resolver and tier. A query naming a
table or a column the schema does not define is not a learning query; it is a wish, and
reconciling these strings against the schema is prerequisite work for anything this module
claims to measure.

## Alignment with Foundation

Runtime tracing introduces no new primitive. It reuses each foundational commitment as-is:

| Principle | How runtime tracing satisfies it |
|-----------|----------------------------------|
| Impulses are universal data | HTTP requests, DB rows, and function arguments are impulses |
| Activities constrain search | A request handler is a constrained workflow with declared entry and exit |
| Resolvers live where the data lives | The instrumented functions are already in the vessel that owns the data |
| Metadata first, content later | Signatures and shapes are traced; payloads stay in the content table |
| Record everything | The same `execution` schema, the same store |
| Learn from traces | Thompson sampling and pattern recognition are unchanged |
| LLMs are tools, not controllers | Runtime analysis is deterministic; no model is in this loop |

The corollary is a constraint on future work: a change that would require runtime traces to
diverge from the development trace schema is a change that removes runtime tracing from the
learning loop.

## Performance Considerations

Instrumentation that degrades the thing it measures gets disabled, and a disabled instrument
teaches nothing. The design therefore trades detail for predictability: metadata before
content, sampling before completeness, asynchronous writes before synchronous accuracy. The
budgets below are the expectations any instrumentation change must hold to.

### Overhead

Per-resolver wrapping costs a timestamp pair and an array append; impulse creation costs a
metadata object, with content left unloaded. Trace storage is off the request path — the
middleware fires the write and does not await it, with a bounded timeout so a slow or absent
trace store degrades to a logged warning rather than a stalled request.

The standing expectation at function level with sampling is single-digit-percent overhead,
established by comparing an instrumented deployment against an uninstrumented one. Overhead
asserted from reasoning about the code rather than measured against a control is not an
overhead figure.

### Mitigation Strategies

1. **Sampling** — trace a fraction of ordinary requests; oversample errors and slow requests.
2. **Asynchronous storage** — never block a response on a trace write.
3. **Lazy impulses** — carry metadata and shape; load content only when something reads it.
4. **Selective instrumentation** — wrap the paths under investigation, not every function.
5. **Retention** — aggregate old traces, keep recent detail; retention is a policy the system
   should be able to read and revise, not a constant compiled into a query.

### Memory

Trace size scales with the level: request-level rows carry request and response metadata only,
function-level rows add one entry per instrumented resolver, and full instrumentation carries
the call graph. The content split into `execution_trace_content` is what keeps that growth off
the learning path — scans read the `execution` row, and pay for payload only on an explicit
join.

The expectation is that trace volume is governed by the sampling rate and the retention
policy, both of which must be adjustable without a deployment. When the store grows faster
than retention reclaims, the defect is in the policy, not in the schema.

## Use Cases

These are the questions runtime traces exist to answer. Each is stated as an expectation about
what the substrate should be able to conclude on its own, because a use case that only works
when an operator runs the query by hand is a report, not a capability — and the missing
generator is itself a gap worth filing.

### 1. Performance Regression Detection

When a deployment slows a path, the expectation is that the trace record shows it before a
user reports it: per-resolver latency shifts against the pre-deployment window, and the
composition chain names the call that changed. `vessel_version` on every row is what makes the
comparison attributable to a specific build rather than to a time range.

### 2. Refactoring Guidance

Resolvers shared across many activities are extraction candidates, and the evidence is the
recorded reuse factor rather than a reviewer's impression of duplication.
`RUNTIME_QUERIES.reuseOpportunities` is the draft of that query, but as written it counts
distinct `execution.activity_template_id` — a field the table does not define — so it has to be
reconciled against the schema before it yields a reuse factor at all. Once it does, a high
reuse factor is a reason to look, and the trace of the resolver's own failures is what decides
whether the shared version should be hardened before it is shared further.

### 3. A/B Testing Code Variants

Two implementations of the same behavior can be deployed as distinct variants, traced
identically, and separated by the same Thompson sampling that grades activity templates.
This works only if the variants are distinguishable in the trace and the outcome is graded by
reach rather than exit status — otherwise the arm that fails silently and quickly wins.

### 4. Cost Optimization

Summing `cost_usd` per resolver over a window ranks spend against usage, and the expected
action is to demote an expensive resolver where a cheaper tier suffices. One honest caveat
about the current instrument: `withResolver` attributes a fixed placeholder cost to
LLM-tier calls rather than a token-derived one, so per-resolver cost from that path ranks
call frequency, not spend. Cost claims must come from token-derived figures until that
placeholder is replaced.

## Risks and Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Performance overhead | Slower requests | Sampling, asynchronous storage, selective instrumentation |
| Trace volume growth | Storage cost | Retention policy, aggregation, content-table split |
| Sensitive data in traces | Privacy and security exposure | Metadata-only mode, field filtering, hashed identifiers |
| False bottleneck detection | Misdirected optimization | Minimum sample size and significance checks before acting |
| Instrument left unmounted | Silent absence of evidence | Treat "no traces" as a failure signal, not as a healthy quiet |

The last row is the one that bites hardest: an instrument that is present in the tree but
wired to nothing produces the same empty result set as a system with nothing to report.

## Future Extensions

The extensions below are directions, not commitments. Each becomes real only when an activity
depends on it and grades it; until then it is a shape the architecture leaves room for. They
are listed so that a change that would foreclose one is recognized as a cost rather than made
by accident.

### Cross-Vessel Tracing

Impulse lineage should survive a vessel boundary: a goal dispatched on one vessel, served by a
second, and backed by a third should reconstruct as one tree. `parent_execution_id` and
`composition_chain` already carry the structure; what a distributed case additionally needs is
that the identifiers propagate across the transport rather than being minted afresh at each
hop.

### Predictive Optimization

With enough recorded runtime history, the system can anticipate rather than react: which paths
are trending toward hot, which impulse shapes precede failures, what cache and pool sizes the
observed distribution implies. This is ordinary learning over the trace store — its value
depends on the traces being conformant, not on the sophistication of the model applied.

### Self-Healing

The end state is that a detected runtime failure becomes a goal without an operator in the
loop: investigate the failing resolver from its own traces, propose a change, deploy it
narrowly, and let the subsequent traces decide whether it is promoted or reverted. The
verdict must be the reach gate on the confirming execution — a deployment that exits cleanly
and fixes nothing must not be promotable.

## Conclusion

Runtime activity tracing extends the process of becoming from writing code to executing it,
using the same store, the same schema, and the same learner. Its value is entirely a function
of trace conformance: a row that names its activity, its state signature, its input and output
shapes, its per-resolver attribution, and its honest `reached` verdict is evidence the
substrate can compound. A row missing any of those is a log line.

The application becomes a vessel that learns how to optimize itself — but only once the
instrument is mounted, its output is graded, and something reads the result at the moment a
decision is made.
