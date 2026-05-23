# Substrate Investigations

A standing audit loop. Each investigation produces a paired
`<timestamp>-investigation-NNN.json` (structured) and
`<timestamp>-investigation-NNN.md` (narrative). Reports are
externally verifiable — every claim must cite either a file:line
reference or a runnable command and its output, recorded at the
time of investigation.

## Three-agent topology

This loop is the third of three concurrent agents working on the
substrate. The roles are distinct and must not blur:

1. **Development operator.** Works through the openspec changes,
   alternating with internal validation. Writes specs, runs DEV
   tasks, lands implementations. Operates *with* the substrate —
   the substrate is its workshop.

2. **Validation adversary.** Adversarially checks whether the
   substrate's *self-description* matches external observation.
   Reads what the substrate claims about itself (registry entries,
   cycle reports, advertised shapes, proposal envelopes) and
   compares it against what an external observer would see. Its
   threat model is: the substrate is allowed to lie about itself,
   either through gameable criteria or through self-declared
   provenance.

3. **This loop — the runtime-transient auditor.** Our specific
   job: compare the substrate's *internal claims* (registry,
   cycle reports, traces, proposal envelopes) AND the *validation
   adversary's external observations* against the **actual
   runtime transient state** of the running substrate vessel.
   The substrate at `http://localhost:18080` is the ground truth;
   reports about it are claims subject to verification.

Where the three agents converge: each one's product is the next
one's input. The development operator's commits change what the
adversary observes externally. The adversary's reports name what
this auditor checks against runtime state. This auditor's
findings feed back into what the development operator should
prioritize. The triangle is closed only as long as each agent
honors its role.

Where they must not blur: this auditor MUST NOT do development
work (no commits to source, no spec edits, no DEV-task closure
on the operator's behalf). This auditor MUST NOT validate
correctness in the abstract — that's the adversary's job. Our
job is the narrow one: **does the substrate's claimed state
match its actual runtime state?**

## Our specific operational discipline

When auditing, the investigator MUST:

- **Query the running substrate** (`http://localhost:18080` and
  any other live endpoints) when verifying claims about substrate
  state. A repo-only audit is a degraded mode; flag it as such in
  the report's `substrate_target.kind = "repo-static-audit"` and
  note that runtime-transient verification was not performed.
- **Compare three layers per claim**: (a) what the substrate
  source/spec says; (b) what the substrate's runtime endpoints
  report when queried; (c) what the operational artifacts
  (cycle reports, proposals, traces) record. Disagreement
  between any two is a finding.
- **Treat the adversary's reports as input, not authority.** If
  the adversary reports that the substrate's self-description
  is incoherent, our job is to verify against runtime whether
  the incoherence is in the substrate's actual behavior or only
  in its self-description. Both are findings, but they're
  different findings.
- **Resist the urge to opine.** Findings are observations about
  the gap between claim and reality. Recommendations are
  acceptable in the narrative but must not contaminate the
  evidence layer.

## Why externally verifiable

The substrate's own LIFT CANDIDATE stamp on `cycle-8.json` was
issued against gameable criteria with no executed gap-closing
trace and proposals timestamped `1970-01-01T00:00:00.000Z`
(investigation-001, finding F-001). Reports that exist only as
narrative are not enough. A report must let a later reader run
the same commands and confirm or refute every claim.

## Report format

### Structured (`<timestamp>-investigation-NNN.json`)

```json
{
  "investigation_id": "<timestamp>-investigation-NNN",
  "generated_at": "<ISO 8601 UTC, real timestamp>",
  "investigator_session_id": "<opaque session hint>",
  "prior_investigation_id": "<previous id, or null>",
  "substrate_target": {
    "endpoint": "<URL of the substrate audited>",
    "kind": "local-container | canary | other"
  },
  "findings": [
    {
      "id": "F-NNN",
      "claim": "<one-sentence claim>",
      "category": "lift|provenance|validation|deployment|idiom|operational|other",
      "severity": "high|medium|low",
      "first_seen_in": "<investigation_id where this was first recorded>",
      "evidence": [
        {
          "kind": "file_ref | command | http_query | doc_quote",
          "command": "<runnable command, if kind=command/http_query>",
          "location": "<file:line, if kind=file_ref/doc_quote>",
          "excerpt": "<the actual content observed>",
          "verified_at": "<ISO 8601 UTC>"
        }
      ],
      "status": "open|resolved|regressed|unverifiable",
      "operator_remediation": "<what the operator can do, if anything>"
    }
  ],
  "regressions_since_prior": ["<F-ID>", ...],
  "resolutions_since_prior": ["<F-ID>", ...],
  "new_findings": ["<F-ID>", ...],
  "open_questions": ["<one-sentence>", ...],
  "next_wake_recommendation": {
    "delay_seconds": <integer>,
    "reason": "<one-sentence>"
  }
}
```

### Narrative (`<timestamp>-investigation-NNN.md`)

Free-form report by the investigator. Should be substantive
(2000–4000 words) and opinionated. References findings by F-ID.
The narrative is the agent's read; the JSON is the evidence the
reader can re-verify independently.

## Naming and ordering

`<timestamp>` is the investigation start time in
`YYYY-MM-DDTHH-MM-SS` form (UTC, dashes only — colons would be
filesystem-hostile). `NNN` is a monotonic counter restarting at
001 for each new day. Investigations within a day are ordered by
counter; across days, by timestamp prefix.

## Invariants

- Every claim in the narrative MUST map to at least one `evidence`
  entry in the JSON. Pure speculation is not a finding.
- `generated_at` MUST be a real timestamp. An investigation
  reporting `1970-01-01T00:00:00Z` is itself evidence of a
  provenance failure and triggers an immediate follow-up finding.
- `status: unverifiable` is legitimate. A claim the investigator
  cannot run a command to verify (e.g. requires admin scope they
  don't have) is recorded with that status and an explanation.
- Prior findings carry their `first_seen_in` across investigations.
  A finding that recurs unchanged is still tracked — the recurrence
  itself is the signal.

## The loop

A standing `/loop` invocation runs an investigator agent at
self-paced intervals. Each iteration:

1. Reads the most recent prior investigation under this directory.
2. Re-verifies every prior finding's evidence against current
   state.
3. Identifies new findings, regressions, and resolutions.
4. Writes a new investigation report (JSON + MD) with full evidence.
5. Schedules the next wake based on substrate activity (more
   frequent if cycles are landing; less frequent if quiescent).

## Privileged inputs

The investigator has read access to the entire repo. It does NOT
have privileged access to:

- Live canary substrate credentials (audits canary by reading
  the most recent committed cycle reports, not by hitting the
  endpoint).
- Operator-only artifacts like `validation/state/lift-status.json`
  (if absent, that's a finding).
- Production secrets (every secret file is gitignored; the
  investigator audits the absence, not the content).

## What this catches

Designed to catch:

- LIFT CANDIDATE stamps issued against gameable criteria.
- Proposals with epoch-zero or missing timestamps.
- Documentation-vs-implementation drift (e.g. the 63-mode failure
  matrix in CLAUDE.md vs. six scenarios on disk).
- Hardcoded deployment defaults reintroduced after removal.
- Vessel purity regressions (Tier 1+2 vessels acquiring
  non-resolver REST endpoints).
- Reports that themselves carry suspicious provenance.

Designed NOT to catch:

- Live runtime failures (that's the failure-mode harness's job).
- Correctness of activity execution (that's the validation
  harness's job).
- Operator competence (that's not the substrate's job).
