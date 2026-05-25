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

## Shared infrastructure from the validation adversary

The validation adversary (commit `8a904346`) shipped tooling that
this auditor uses as primary inputs. Treat these as the substrate's
own measurement instruments; our job is to verify them, not to
trust them.

### Runtime-transient capture

- **`validation/scripts/substrate-narrator.ts`** — captures the
  substrate's externally-observable knowledge surface every N
  minutes. Subscribes to activity-api `/ws`, snapshots template
  inventory + vessel registry + concept inventory, pulls a
  recent-trace window. Authoritative source for "what is the
  substrate's runtime-transient state at time T."
- **`validation/observations/`** — narrator output. Snapshots
  under `snapshots/`, event JSONL under `events-<date>.jsonl`,
  trace windows alongside. Gitignored by default; opt-in to
  commit specific observations under `validation/gaps/evidence/`
  when citing them in a finding.

When auditing, the investigator SHOULD:
1. Confirm the narrator is running (`ps ax | grep substrate-narrator`)
   or that recent snapshots exist (≤ 15 minutes old). If not,
   that itself is a finding: runtime-transient state went
   un-captured during the audit window.
2. Cross-reference each claim against the most recent snapshot.
   A claim that the registry contains template X is verified by
   finding X in `snapshots/snapshot-<latest>.json`'s
   `activity_api.templates` array, not by reading the activity
   template's source.

### Foundation compliance and idiom catalog

- **`docs/CORE_IDIOMS.md`** — 12 substrate idioms, classified
  lift-critical / borderline / S2→S3 extension. The canonical
  set we audit substrate behavior against. Changes to this doc
  are themselves audit-worthy (an idiom rename or reclassification
  changes what counts as compliance).
- **`docs/FOUNDATION_COMPLIANCE_CHECKS.md`** — 20 substrate-
  evaluable predicates: 15 REQUIRED (proposal-blocking on
  failure) + 5 RECOMMENDED (warning on failure) + 6 operator-
  judgment items. These are runnable against any substrate state.
  Auditing should periodically execute the REQUIRED set against
  live substrate and record results as findings.

### Adversarial probes

- **`validation/adversarial-probes/v1/`** — 13 probes (HIGH/MEDIUM/
  LOW severity) covering self-development, foundation compliance,
  scope discipline, and trust handling. Each probe carries
  `expected_failure_classification`. Our role: when a probe is
  fired, verify the substrate's actual response matches expectation.
  Probes returning a wrong response are findings; probes returning
  the expected response are evidence the corresponding idiom is
  load-bearing.

### Gap accumulation

- **`validation/gaps/INDEX.md`** — the validation adversary's
  accumulating-gaps table. Each entry: a moment when explaining
  substrate behavior required operator-side knowledge not present
  on the substrate's t-0 surface (per
  `docs/SUBSTRATE_NARRATION_PROTOCOL.md`).
- This auditor's relationship to gaps: gaps document where the
  substrate **lacks self-knowledge**; our findings document where
  the substrate's **claims diverge from runtime state**. The two
  are different signals. A gap can exist without divergence (the
  substrate doesn't know something but isn't lying about it). A
  divergence can exist without a gap (the substrate knows
  something internally but reports it falsely externally).

### Substrate liveness baseline

Before any audit, confirm:

- `curl -sf http://localhost:18080/health` returns 200 with
  `redis`, `surrealdb`, and `discovery` healthy. If not, the
  audit is degraded; runtime-transient comparison is impossible.
- A valid `~/.metabob/config.json` is present with an apiKey.
  Without it, only `/health` and other unauthenticated endpoints
  are queryable.
- An authenticated query against `/v2/activities/templates?limit=1`
  returns 200. If 401, identity-vessel and activity-api have
  diverged on credentials; this is itself a finding.

## Dev operator status (correction 2026-05-24)

Operator confirms the dev agent is **engaged and working**, but
**having challenges solving the issues** the audit and validator
have surfaced. The lack of visible commits on the five
highest-leverage 2026-05-23 changes (substrate-identity-
resolution, substrate-self-replacement-pipeline,
external-resolver-vesselization, external-resolver-grounding,
lift-criterion-hardening) is NOT idle — it reflects that the
structural problems (gap-004 binding, gap-003 failure_mode,
gap-005 template churn, F-014 embedding env, F-019 cross-vessel
auth, F-021 concept-db deployment) are genuinely difficult.

Auditor framing for future iterations:

- **F-009 / F-011** ("zero DEV on five audited"): true at the
  surface, but does not imply operator absence. The dev is
  working; the work is not yet shipping. Future reports should
  carry this caveat.
- **F-033** ("dev coordination stale"): the `last_updated`
  field in agent-coordination.json IS stale, but this is a
  metadata-update gap rather than evidence of idle dev. Severity
  should reflect that.
- **gap-006 framing** ("validation isolated from dev/audit"):
  the validator's framing was based on absence of commits; the
  operator was active, just not committing on the audited set.
- **F-024 / structural cascade**: the substrate's continuing
  failure to self-improve is not "operator absent" but
  "operator working on hard problems while substrate continues
  to fail." The audit's role is to keep producing evidence;
  remediation cadence is up to the operator.

The substrate's structural findings remain accurate — boredom
firings still fail, templates still thrash, LIFT CANDIDATE
still stamped on stale data. The framing about *who is
responding* needs the above correction.

## Deprecation context (2026-05-23 onward)

Two ongoing deprecations affect how findings should be interpreted:

1. **Pre-prod canary substrate** (`https://activity.metabob.com`,
   `https://identity.metabob.com`) is being deprecated. CLAUDE.md
   still references it as "canary / pre-prod" but the operational
   direction (per memory: 2026-05-23 substrate-only) is local
   single-container substrate as the primary development target.
   Auditors SHOULD prefer querying `http://localhost:18080` (local).
   Findings that flag canary as a stale or absent target are
   correct (canary is going away); findings that flag canary as
   the *expected* substrate are out-of-date and should be
   reframed against local.

2. **`metabob-*` / `*bob` vessel naming** is being phased out
   (per the substrate-self-replacement-pipeline spec and adjacent
   work). New vessels live under `github.com/AviGopal/<name>`
   with `@avigopal/<name>` npm scope and no prefix. Existing
   `metabob-*` vessels are migration candidates, not steady-state
   citizens. Findings that flag a `metabob-*` literal as a
   hardcoded default are still valid (the literal is the
   migration debt). Findings that assume a `metabob-*` name
   denotes a long-lived target should be re-cast: that name is
   transient.

Practical consequences for findings:

- F-005 / F-012 about substrate-anonymous cycle reports: still
  valid; the schema gap exists regardless of which substrate is
  active.
- F-006 (hardcoded `metabob.com` defaults): still valid; the
  literals are the work the substrate-identity-resolution change
  is meant to delete.
- Any new finding that names canary as a current operational
  target should instead name it as a transitioning target with
  the local-container substrate as the actual ground truth.

When in doubt: the **local-container substrate at
`http://localhost:18080`** is the substrate that matters for our
audit. Canary is a historical artifact the audit references but
does not validate.

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
