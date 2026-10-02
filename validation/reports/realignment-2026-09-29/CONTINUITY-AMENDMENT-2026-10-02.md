# Proposed amendment: continuity, experimentation, and reduction

2026-10-02. **Draft for review; not an adopted policy or an implementation claim.**

This amends the existing [REALIGNMENT](REALIGNMENT.md), rather than creating a
parallel repair program. Its basis is the user's clarification in this review:
outputs are validated through their use as inputs; variation, experimentation,
and reduction characterize confined state transitions; autonomy sustains that
continuity, with humans participating as sources of purpose, information,
authority, and judgment.

Version basis: the working-copy report at superproject `a8202605` ends at §8.
The locally available report revision `e028a7f9` adds §9 on 2026-10-01. This draft
includes that amendment as a dependency; no remote fetch or runtime revalidation
was performed. Preserve §9's locality, authentication, and trust requirements.
The report's dated observations remain historical evidence, not current facts.

## 1. Purpose and completion — amend §§1 and 7

The mechanism preserves continuity from a need through produced outputs, actual
downstream consumption, observed consequences, and changed future behavior.
Variation supplies alternatives; experimentation characterizes their effects;
reduction makes useful transitions reusable under identifiable conditions.
Code, activity templates, and compositions are different representations of
behavioral structure, with different modification and deployment mechanics.

An execution completing, a consumer successfully using its output, a learning
update being stored, and that update influencing later execution are separate
claims. Record which has been established. A successful slice demonstrates the
connection; repeated observations characterize reliability. No single successful
run establishes a general probability or unlimited applicability.

Retain the verified autonomous commit as a **self-development milestone**.
The broader autonomy criterion is sustained continuation and learning within
granted authority. Legitimate human participation is not an autonomy failure;
repeated human reconstruction of lost inputs, context, or history is a continuity
defect. Record both kinds of participation accurately.

## 2. Observations, learning, and acceptance — amend §2.2 and canon K3

Separate three uses of evidence within the existing trace/verdict/credit paths:

1. **Observation:** a specific consumer used a specific producer output under
   identified conditions, with an observed consequence.
2. **Learning:** an attributed observation updates a particular transition's
   characterization, including uncertainty and applicability.
3. **Acceptance:** accumulated evidence satisfies the requirements for a named
   action such as delivery, landing, closure, or scope expansion.

A terminal verdict is one observation, not the sole source of learning. A useful
intermediate transition may be observed even when the overall goal fails. Actual
consumption establishes use, not automatically causal benefit; comparisons and
controlled variations strengthen attribution.

The minimum information to preserve is the source execution and step, producer
and consumer identities/versions, actual input/output references, binding,
relevant conditions and variation, observed consequence, observation horizon,
instrument, and provenance. Inspect existing fields and readers before choosing
schema changes; this is an information contract, not a mandate for a new store.

An outcome estimate must identify what event it estimates, under which conditions
and at which horizon. Unobserved or delayed consequences remain unresolved.
Consumption, short-horizon success, and later failure may coexist without
contradiction. Later observations extend the history; a correction identifies the
observation and derived update it supersedes. Give updates stable identities and
an idempotent ingestion path so retries and replication do not multiply evidence.

Keep the existing landing, authentication, and closure safeguards. An incomplete
view cannot certify the unseen outcome. Partial learning does not authorize
deployment. A verifier is itself a characterized consumer with tested limits.

**Acceptance:** one chain with a successful intermediate consumer and a later
failure yields separately attributable observations; an unavailable observation
does not become a negative outcome; duplicate delivery does not duplicate an
update; selection demonstrably reads the resulting characterization.

## 3. Reduction and partially known cases — amend §§1, 2.0b, and 2.6

Shape signatures retrieve candidates; they do not prove that two concrete inputs
are interchangeable. A reduced activity preserves actual dependencies and
distinguishes instance values, variable parameters, preconditions, relevant
context, implementation versions, and characterized outcomes.

Begin with the narrow applicability supported by observation. Proposed wider
applicability is a hypothesis tested through variation. Preserve inspectable
source evidence when internal steps are encapsulated.

Replace "adapts only the first or last mile" with: **reuse characterized portions
and adapt the uncertain connections wherever they occur**. Keep useful inputs
and intermediate results across retries. A mismatch may require information,
translation, another consumer, a new composition, or changed code; it does not
automatically require a new resolver or weaker validation.

Record workarounds by the unmet consumer requirement and relevant conditions,
as well as the missing/failed producer. Recurrence supplies demand, but frequency
alone does not demonstrate that the workaround is effective or worth encapsulating.

**Acceptance:** a reusable activity retains the source dependencies, works with
changed instance values, and recognizes an incompatible precondition. An internal
mismatch can be investigated without discarding the characterized remainder.

## 4. Human-originated experiments — amend §§4.2 and 6.2

Separate autonomy attribution from evidence quality. Operator-authored work does
not count as autonomous authorship, but can supply useful observations.

Retain author, intervention, experimental conditions, and source execution on
evidence. Keep benchmark and synthetic outcomes distinguishable from operational
outcomes; do not transfer their estimates without an applicability argument.
Preserve existing isolation requirements for experiments.

Review the three named operator variants on their distinct hypotheses,
applicability, evidence, duplication, and cost. Human origin alone is not a reason
to retire useful behavior. Retiring an executable variant does not erase its
experimental history. Unsupported duplicate proliferation remains a defect.

**Acceptance:** autonomous-achievement counts exclude operator work while an
applicable experimental result can influence selection with its provenance intact.

## 5. Authority and evaluator evolution — reconcile §§2.1 and 7.9

The report currently says evaluator paths remain permanently excluded and also
that the excluded paths may earn their way out. Resolve this explicitly in the
existing `autonomyScope` policy:

- Human-governed authority boundaries: evidence alone does not grant permission.
- Implementations eligible for earned modification: scope changes require
  evidence relevant to that behavior and its consequences.
- Temporary restrictions: retain reason, release condition, and existing expiry
  or quarantine semantics.

Do not infer permission to modify an evaluator from successful changes in nearby
files. Test a candidate evaluator separately while retaining the accepted one.
Compare them on known-valid cases, known-invalid cases, and downstream use.
A candidate cannot approve its own promotion by weakening its evidence source,
control, or acceptance rule. The authority governing promotion must be named.

This amendment grants no new runtime authority. The permanent boundary remains
an explicit design decision to settle when adopting this section.

**Acceptance:** an unauthorized operation remains refused despite high confidence;
scope changes cite relevant evidence; a weakened evaluator cannot certify its own
promotion; dispatchers consume the effective scope decision.

## 6. Correct the inputs to generated expectations — amend §8 and the canon

Reconcile the canon before generating runtime rows from it. Its §1 still calls
30.8% versus 3.0% "reach" and states approximately 2% floor reach; REALIGNMENT §1
explicitly corrects those claims. Preserve the correction history and prevent the
withdrawn interpretations from becoming current thresholds.

Classify source statements as:

- **Observations:** time-, node-, version-, and method-bounded measurements.
- **Expectations:** behavior required by a stated contract or purpose.
- **Hypotheses:** proposed relationships awaiting experiments.

Generated records retain source revision/location, statement kind, and the reader
that gives them an operational role. Source changes trigger refresh or explicit
invalidation of derived records. Deterministic validation can establish faithful
extraction and structural validity; it does not establish arbitrary prose as true.
Unparsed or unsupported claims stay explicit rather than being fabricated into
predicates. Exercise a generated row through its existing evaluator/consumer.

**Acceptance:** withdrawn interpretations cannot become active expectations; a
source correction reaches derived readers; hypotheses remain distinguishable from
measured facts and established contracts.

## 7. One execution-and-learning slice — extend §7 step 1

Use one useful need and its actual consumer, on the nodes already required by
the plan. Recheck deployed revisions and existing work before selecting it.

1. Run a case requiring an uncertain connection or workaround. Preserve inputs,
   scoped identities, bindings, outputs, and the route taken.
2. Have a real downstream operation consume the output. Observe its consequence;
   a shape declaration or log-only dependency is insufficient.
3. Follow the observation through the stored characterization or reduced activity
   to its named selection reader.
4. Run a related case with changed input values. Record precisely what was reused
   and which acquired information selection read. A controlled comparison without
   that information strengthens the claim that learning made the difference.
5. Vary one relevant representation or precondition. Observe adaptation at that
   connection while retaining usable state and characterized operations.
6. Exercise a must-fail case: stale input, crossed execution binding, missing
   content, or an invalid applicability condition. It must not count as supported
   continuation merely because a process exits successfully.
7. Follow later consequences at a stated horizon. Record what remains pending and
   what must trigger its reader. Report support and uncertainty without inventing
   reliability from a single run.

Use isolated fixtures for deliberately broken cases. Do not modify live bookings,
policies, services, or production data merely to supply a negative control.

**Completion evidence:** source and consumer execution identities; actual content
references and bindings; versioned operations and variations; observations and
horizons; attributed/idempotent learning writes; the later selection's reads;
reused and adapted portions; human contributions; unresolved consequences.

## 8. Integration order and readers

1. Correct source contradictions (§6 here); do not generate policy from stale claims.
2. Define the observation/update boundary and reduced transition contract (§§2–3)
   at existing trace, verdict, extraction, and selection seams.
3. Apply provenance separation (§4) to every experiment from the outset.
4. Settle authority boundaries (§5) before any protected modification.
5. Exercise the single slice (§7). Let its first demonstrated break determine which
   existing repair to advance; do not start six parallel implementations.

The agentic-runner approach remains the implementation sequencing reference named
by the October 2 companion reports. Map this slice into that work and the existing
ledger/realignment changes; it is not another runner or new gate program.

The operational readers are the existing consumers, trace ingestion and credit
paths, activity selection, extraction, expectation evaluator, and dispatch scope
checks. Each implemented amendment must name its concrete writer and reader and
demonstrate consumption. This draft itself has no runtime effect. Adoption should
integrate these replacements into REALIGNMENT and CANON and reconcile their
existing specifications; retaining only this companion would repeat the report's
own warning about prose without readers.
