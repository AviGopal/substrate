# Frozen human-participation scenarios (baseline denominator v1)

Stage-2 deliverable of the human-interface program. This set is **frozen**: its
membership and assessment keys never change, so scores are comparable across interface
versions. New discoveries go to `exploration/` and may be promoted into a future v2
denominator — never merged into v1. Companion baseline:
`validation/reports/human-participation-baseline-2026-09-20/MATRIX.md`.

Every scenario names a human purpose and observable success criteria. "The page
rendered" never counts. Preference statements ("I'd choose this presentation") are
recorded but scored separately from outcomes (correct assessment, completed
contribution) — they answer different questions at different horizons.

## Encounter coverage

| Scenario | Encounter | Situation covered |
|---|---|---|
| S1 | Begin | first arrival, expressing an intention |
| S2 | Return | interrupted activity, restart, revision awareness |
| S3 | Inspect | disputed result (real status/failure_mode dissonance) |
| S4 | Explore | unfamiliar content carried by a generic shape |
| S5 | Decide | real escalation with alternatives and consequences |
| S6 | Contribute | supported vs unsupported claims; usable correction |
| S7 | Begin+Return | several concurrent activities, mid-session revision |
| S8 | Decide+Contribute | missing information made explicit |

## Common protocol

- Fixtures are seeded through the vessel's own shaped writes (`uiPanel_write`), never
  by editing its stores — the run must exercise the same path the substrate uses.
- Success evidence is read from the participation journal and receipts (deterministic),
  plus a short scored comprehension check where the criterion is understanding
  (`assessment_key` in the fixture; predefined, never judged ad hoc).
- Record per run: interface version (content + renderer versions), participant id
  (pseudonymous), assistance given (verbatim), time to completion, and every deviation.
- Counterbalance task order across participants when comparing interface variants;
  never reuse a participant on the same scenario's comprehension key twice without
  recording practice exposure.

## The scenarios

### S1 — Begin: arrive and start something real
**Purpose:** a person with no prior context wants to know what this system is, what it
is currently working on, and to start one small piece of work.
**Fixture:** default surface + `fixtures/live-escalation-panels-2026-09-20.json`
(6 real panels seeded).
**Success (observable):** (a) unaided, the person states in their own words what two of
the visible items are asking for, matching the assessment key's gist; (b) they express
one intention through the surface that arrives as a well-formed record (journal
evidence); (c) they can say what will happen next with their submission — the honest
answer ("storage confirmed, consumption not") counts as correct, a confabulated
promise counts as failure *of the interface*.

### S2 — Return: recover interrupted work
**Purpose:** the person answered part of a multi-part question yesterday; the vessel
restarted; they return to finish.
**Fixture:** a two-ask question panel; part 1 answered and journaled; vessel restarted
before the session.
**Success:** (a) they locate the pending part without assistance; (b) the completed
part is visible as answered with its original content; (c) finishing does not
duplicate part 1 (journal shows exactly one record per part); (d) they correctly state
whether the question changed while they were away.

### S3 — Inspect: examine a disputed outcome
**Purpose:** decide whether an activity outcome can be trusted.
**Fixture:** `fixtures/disputed-trace-exec_0pjz9wt6.json` — a real trace reporting
`status: success` and `failure_mode: execution_error` simultaneously.
**Success:** (a) the person identifies the contradiction between the two fields;
(b) they correctly sort the fixture's statements into supported / not-supported per
the assessment key (≥5 of 6); (c) they can point to the specific evidence element
behind each judgment. Preference for how it was displayed is recorded separately.

### S4 — Explore: unfamiliar content, original preserved
**Purpose:** investigate material the interface does not know how to interpret and
develop a question about it.
**Fixture:** a panel whose body is an unfamiliar structured record (a raw gap payload
with nested metadata; no renderer mapping).
**Success:** (a) the person can always reach the byte-faithful original; (b) they
formulate one concrete question about the material and submit it as a contribution;
(c) the interpreted rendering never silently drops fields — the person, comparing
rendering and original, finds no undisclosed omission (any found = interface failure,
logged as a gap).

### S5 — Decide: dispose of a real escalation
**Purpose:** the substrate has asked for a human decision after 8+ failed auto-repairs;
choose among alternatives with consequences.
**Fixture:** the `needs-human-orphaned-capability-mcp:tool_call` panel (frozen, real);
alternatives: author an activity / rewire / provide information / drop.
**Success:** (a) the person restates the situation and the four dispositions correctly;
(b) their chosen disposition is recorded against the exact panel revision they read
(receipt evidence); (c) their stated reasoning cites at least one fact from the panel
body; (d) declining is exercised in at least one run and produces a decline record
distinct from an answer.

### S6 — Contribute: correct an incident handoff
**Purpose:** the stage-6 goal scenario — distinguish supported conclusions from
unresolved claims and supply a usable correction.
**Fixture:** `fixtures/incident-handoff-v1.json` (6 claims, 2 deliberately unsupported,
scored key, max 8).
**Success:** per the fixture's scoring rule; a run is successful at ≥6/8 with at least
one usable correction. The correction must arrive as a stored contribution addressed
to the handoff artifact (journal + receipt evidence).

### S7 — Concurrent activities with a mid-session revision
**Purpose:** keep several strands straight while one changes underneath.
**Fixture:** three active question panels; a scripted `uiQuestion_write` revises one
panel mid-session while the person drafts an answer to another.
**Success:** (a) the primary draft survives the unrelated revision (journal shows the
intended answer landing on the intended panel/revision); (b) a late answer to the
revised panel is rejected with the revision explanation, and the person successfully
re-reviews and resubmits; (c) at session end the person correctly reports which of the
three changed.

### S8 — Missing information, honestly absent
**Purpose:** distinguish "unavailable" from "hidden", then either supply the missing
piece or decline with a reason.
**Fixture:** a question that references an artifact link the system cannot produce,
rendered with the missing link explicit (per the explicability contract: pending /
unavailable states are first-class).
**Success:** (a) the person correctly states that the artifact is unavailable rather
than assuming it exists elsewhere; (b) they either supply the missing information as
a contribution or decline citing its absence; (c) no run ends with the person believing
they saw evidence that was never presented (checked by one key question).

## Exploration set

`exploration/` holds candidate scenarios discovered during real use (new content
types, new failure shapes, new encounter mixes). Each entry records the observation
that motivated it. Promotion to a frozen v2 requires: a defined purpose, an
assessment key authored **before** first scored use, and a reason the v1 set could
not measure the same thing. The v1 denominator is never edited.

## What this set does not measure

Willingness to return, long-horizon appeal, and learning-loop consequences have
longer horizons than a scenario run; they are tracked by the stage-7/9 machinery
against these same fixtures, not by adding criteria here.
