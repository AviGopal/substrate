# validation/ — benchmark harnesses

## Stage harness — measuring the layers between a goal and a landed change

`scripts/stage-harness.ts` calls each layer of the pathless-goal → landed-change
path directly, on inputs taken from real dispatches, and asserts the answer those
dispatches established.

```
bun run validation/scripts/stage-harness.ts [--root <dir>] [--out <report.json>] [--stage S3]
```

It exists because measuring that path end to end — dispatch a goal, see whether a
good commit lands — yields one bit about a ten-stage chain, costs 10-25 minutes,
and is destroyed by an unrelated vessel restart. The harness gives a per-layer
read in seconds, with no dispatch and no mutation.

**It is not a pass/fail gate.** Fixtures marked `known_open` record wrongness the
code genuinely does not catch today; they are expected to report OPEN, and that
split — not a score — is the headline. `regression` means an answer changed from
what a real trial established, which is either a break or a repair whose
expectation needs updating deliberately. Exit is non-zero only for `regression`
and `error`.

**Reading it honestly.** Every stage carries paired controls, because a stage that
declined everything would otherwise score well. S3 additionally records the
localiser's own tap next to each answer: "resolved to the right file" and
"resolved for the right reason" are different claims, and the first fixture
written here passed for the wrong reason until the tap showed it.

**Caveats stamped into every report:** S3 runs a *port* of goal-host's
`searchWorkspaceForTerm` (not importable without booting the vessel) — check
`production_search_digest` before believing S3 numbers. The report also compares
each vessel's HEAD against the tree the running substrate actually reads and
warns on drift. A green harness means every layer answers correctly *in
isolation*; it does not mean their composition lands a correct change.

## Activity Reuse Benchmark (Phase 18.2)

Tracks whether recommendation quality improves after each Phase 18 change. The
harness runs 20 curated goal-text prompts through `POST /v2/activities/recommend`
and measures how well the system surfaces the expected activity template.

**Metrics emitted:**
- **MRR** (Mean Reciprocal Rank) — primary quality signal; 1.0 = perfect, 0 = never found
- **Hit@1 / Hit@3 / Hit@5** — fraction of entries where expected template appears in top-k
- **Thompson snapshot** — α/β posteriors + CI width for top-50 templates
- **Improvise rate** — fraction of recent traces using the improvise fallback (lower = better)

### Run a benchmark

```bash
METABOB_API_KEY=<key> bun run validation/scripts/reuse-harness.ts [--baseline <date>] [--label <text>]
```

The `--label` tag is embedded in the JSON report for tracking. `--baseline <date>` loads a
prior report (e.g. `--baseline 2026-05-12`) and shows deltas inline.

Report is written to `validation/results/{ISO_DATE}-reuse-report.json`.

### Compare two reports

```bash
bun run validation/scripts/compare-reports.ts \
  validation/results/BEFORE.json \
  validation/results/AFTER.json
```

Emits a markdown table diff with MRR/hit-rate deltas, rank changes per entry, and
top-5 Thompson movers by EV change.

### Benchmark file

`validation/activity-reuse-benchmark.json` — 20 entries (8 bug-fix, 6 feature-add,
4 refactor, 2 documentation). Each entry has a `goal_text` and an `expected_activity_id`
drawn from real activity IDs in the live canary registry. Curate by querying
`GET /v2/activities/execution-traces?limit=100` for goal+activity_id pairs.

---

## Credit Propagation Integration Test (Phase 18.4.7)

Verifies that submitting an execution trace with a non-empty `composition_chain` causes
`propagateCreditAlongChain` to fire and increment α (Thompson success count) for ancestor
activities in the chain. Tests the F-V54 fix in activity-api 1.20.3.

### Purpose

`propagateCreditAlongChain` in `posterior-update.ts` walks the `composition_chain` array in
reverse (closest ancestor first) and applies `Δα = CREDIT_PROPAGATION_GAMMA^depth` to each
ancestor's `variant_performance_metrics` row. Before activity-api 1.20.3, this function was
never called on the `POST /v2/activities/execution-traces` route because `composition_chain`
was stored in the trace but not forwarded to `applyOutcomeToPosteriors` (F-V54).

### Run the test

```bash
METABOB_API_KEY=<key> bun run validation/scripts/test-18-4-7-credit-propagation.ts
```

Optional override:
```bash
METABOB_ENDPOINT=https://activity.metabob.com METABOB_API_KEY=<key> \
  bun run validation/scripts/test-18-4-7-credit-propagation.ts
```

### Expected output (passing)

```
=== Integration Test 18.4.7: credit propagation via composition_chain ===
...
Step 1: Reading baseline α for ancestor via /recommend…
  Ancestor "activity:⟨spec-to-enforcement-activity⟩" baseline α: N
Step 2: Submitting 5 leaf traces with composition_chain=[activity:⟨spec-to-enforcement-activity⟩]…
  5 traces submitted successfully.
Step 3: Waiting 3000ms for credit propagation to land…
Step 4: Re-reading ancestor α…
  Ancestor α after: N+2.5
── Results ──────────────────────────────────────────────────────────────────
  Baseline α : N
  After α    : N+2.5
  Δα         : +2.5000
  Expected   : ≈ +2.50 (5 × gamma=0.5)
  Threshold  : ≥ 0.75
  Result     : PASS ✓
RESULT: PASS ✓ — propagateCreditAlongChain fired; ancestor α increased as expected.
```

Exit code 0 = pass. The test submits 5 leaf traces and expects cumulative Δα ≥ 0.75 (≥30% of
theoretical 5×0.5 = 2.5).

### Exit codes

| Code | Meaning |
|------|---------|
| `0` | PASS — ancestor α increased by ≥ threshold |
| `1` | FAIL — Δα below threshold (or = 0, indicating bug) |
| `2` | INCONCLUSIVE — ancestor not found in /recommend results (service degraded) |

### Cleanup

The test leaves leaf traces in `activity_execution_traces` (template IDs like
`activity:test-18-4-7-leaf-<timestamp>`). These are test-only rows; the operator can
clean them up via `activityExecutionTrace_delete` write resolver or by pruning zero-
execution templates with `prune-activity`.

The ancestor template (`activity:⟨spec-to-enforcement-activity⟩`) gets its α slightly
incremented on each test run — this is intentional since it's a real production template
with high execution count and a few extra successes are negligible.

---

## Head-to-head agent benchmark harness (Phase 13)

A manual benchmark for comparing **Claude Code** and **minibob** on the same
prompt + same workspace + same model. Each agent runs in an isolated Docker
container with a private bind-mounted copy of the workspace. The harness
diffs the two resulting workspaces and emits a side-by-side `report.md`.

This is a *prompt-iteration tool*, not CI. There is no scoring / verdict
automation — a human (or follow-up agent) reads the report and decides.

---

## Quick start

```
export ANTHROPIC_API_KEY=sk-ant-...
./run.sh prompts/01-fix-failing-test.md pristine-typescript-project
# ─ first run also builds the Claude Code image (~30s) and pulls minibob
# Output: runs/<timestamp>-01-fix-failing-test/report.md
```

Or invoke the orchestrator directly:

```
bun run lib/orchestrator.ts \
  --prompt prompts/02-add-feature.md \
  --workspace pristine-typescript-project \
  --model claude-sonnet-4-6 \
  --timeout 600
```

`bun run lib/orchestrator.ts --help` prints the full flag reference.

## Layout

```
validation/
├── README.md                 # this file
├── Dockerfile.claude-code    # builds metabob-validation/claude-code:local
├── containers.json           # canonical image refs + defaults
├── docs/
│   └── CLAUDE_CODE_CONTAINER.md  # why we build our own
├── prompts/                  # benchmark prompts (one per scenario)
├── workspaces/               # input seeds (self-contained, no git remote)
├── lib/
│   ├── orchestrator.ts       # main entry
│   ├── docker-runner.ts      # docker invocation per agent
│   ├── workspace-diff.ts     # tree + unified-diff helpers
│   └── transcript-capture.ts # parse JSONL transcripts
├── run.sh                    # thin shell wrapper
└── runs/                     # gitignored; one dir per invocation
    └── <ts>-<prompt>/
        ├── prompt.md
        ├── claude-code/{workspace.before,workspace.after,transcript.jsonl,stdout.log,stderr.log}
        ├── minibob/{workspace.before,workspace.after,transcript.jsonl,stdout.log,stderr.log}
        └── report.md
```

## Reading a report

The `report.md` is structured into five sections:

1. **File tree changes (side-by-side)** — every path that changed under
   either agent, with one column per agent (`created` / `modified` /
   `deleted` / `—`) and a `same?` column comparing SHA-256 of the file
   bytes between the two `workspace.after` snapshots.
2. **Per-file unified diffs** — a `diff -u` between the two agents'
   `workspace.after` versions, *not* between before and after. This is the
   high-signal section: it shows where the two agents disagreed.
3. **Transcript summary** — LLM call count, tool call count, token totals,
   final assistant message. Claude Code totals come from its `result`
   stream-json event; minibob totals are stubbed (TODO; see
   `lib/transcript-capture.ts`).
4. **Failure / timeout notes** — whether either agent timed out or
   non-zero-exited; pointers to `stderr.log`.
5. **Verdict (human-filled)** — empty scaffold for the operator's notes.

## Adding a new prompt

Drop a markdown file in `prompts/`. The whole file body is passed verbatim
as the goal/prompt to both agents. Keep prompts self-contained — the agent
sees only the prompt text and the workspace, not the filename.

## Adding a new workspace seed

Create `workspaces/<name>/` with whatever files the seed needs. Keep it
self-contained:

- **No git remote.** If you `git init`, do not add a remote — agents could
  otherwise accidentally push.
- **No secrets.** Anything in the seed gets bind-mounted into both
  containers.
- **Small.** Seeds are copied four times per run (before/after × 2 agents).

Pass the directory name (not path) via `--workspace`.

## Containers

`containers.json` pins the image refs:

- **minibob**: `metabobapp/minibob:<version>-<sha>` from Docker Hub
  (published by the deploy chain). Bump the tag to test newer minibob
  builds. Reuses the existing image — never rebuilt here.
- **Claude Code**: `metabob-validation/claude-code:local`, built from
  `Dockerfile.claude-code` on first run. Anthropic does not publish a
  public pre-built image; see `docs/CLAUDE_CODE_CONTAINER.md`.

## Authentication

Both agents need `ANTHROPIC_API_KEY` exported in the host environment; it
is forwarded into both containers via `-e`. Minibob additionally needs
`~/.metabob/config.json` (METABOB_API_KEY, endpoint, provider config),
which is bind-mounted read-only from the host.

## Network

Both containers retain outbound network access — agents need to reach
`api.anthropic.com`, and minibob also reaches `activity.metabob.com`.
There is no per-container firewall. The only sandboxing is filesystem:
the bind-mount restricts writes to `/workspace`.

## Standalone-parity mode (`--no-backend`)

The Phase 13 target is **standalone parity**: minibob in the harness should
behave like Claude Code — one process, one workspace, no external coordination.
Pass `--no-backend` to disable both discovery-vessel registration and
activity-api trace POSTs:

```
bun run lib/orchestrator.ts \
  --prompt prompts/01-fix-failing-test.md \
  --workspace pristine-typescript-project \
  --no-backend \
  --timeout 1200
```

Internally this sets `DISCOVERY_ENABLED=false`, unsets `METABOB_API_KEY`, and
sets `MINIBOB_OFFLINE_MODE=true` in the minibob container. Without it, minibob
will attempt to register with discovery and POST execution traces to
activity-api — useful when you want the full learning-loop wiring exercised,
but it confounds the head-to-head comparison.

## Transcript capture

minibob's container is given a host-writable mount at `/tmp/minibob-transcript/`
and `MINIBOB_TRANSCRIPT_FILE=/tmp/minibob-transcript/transcript.jsonl`. The
LLM client (`repos/minibob/src/transcript.ts`) appends one JSONL line per LLM
request, LLM response, tool call, and tool result. After the run, the
harness copies `transcript.jsonl` out to `runs/<ts>/minibob/transcript.jsonl`
and counts the records into the report's Section 3 (Run summary).

The Claude Code transcript continues to come from
`claude -p ... --output-format stream-json`.

## Test audit loop (OpenSpec 2026-05-18-test-audit-loop)

Every test under `validation/scripts/` is treated as an activity producing a
`test_report` impulse. The audit machinery — three meta-activities embedded in
minibob (`audit-test-report`, `run-sensitivity-probe`, `debug-failing-audit`)
plus impulse shapes in activity-api (`test_registration`, `test_report`,
`test_audit_report`, `sensitivity_evidence`, `code_modification_proposal`) —
audits each report against two criteria:

1. **Representativeness** — true outcome witnessed by ≥ 1 multi-witness type,
   sensitivity demonstrated over a ≥ 7-day perturbation window, decision
   record complete.
2. **Goal alignment** — declared mapping to one or more of the six IAL
   success criteria, with a plausible discrimination claim.

### How tests register

Tests call `ensureTestRegistration({test_id, goal_alignment, witness_types,
…})` from `validation/scripts/_test-audit-loop.ts` at the top of their
`main()` (or top-level body for sequential scripts) and `installExitHandler`
to emit a `test_report` on process exit. Tests grandfathered by Phase F ship
with `perturbation_schedule: []` — the audit will tag those reports
`missing_sensitivity_history` until a real schedule is filled in.

### Reading audit results

`reuse-harness.ts` adds an `audit_summary` block to every
`<date>-reuse-report.json`:

```json
"audit_summary": {
  "total_audits": 12,
  "passed": 10,
  "passed_with_caveat": 6,
  "failed_by_subtype": { "audit_insensitive": 1, "audit_misaligned": 1 },
  "caveats": { "missing_sensitivity_history": 5, "unregistered": 1 },
  "open_proposals": 0,
  "window_start": "2026-04-16T00:00:00.000Z"
}
```

The weekly harness (`run-weekly-harness.sh`) additionally dispatches
`run-sensitivity-probe` for every registered test and writes a sidecar
`<date>-sensitivity-report.json` recording per-test dispatch outcomes.

### Spec

`openspec/changes/2026-05-18-test-audit-loop/` — proposal, design, tasks,
and the canonical `specs/test-audit-loop/spec.md`.

## Known TODOs

- **Claude Code `--output-format stream-json`** flag may change between
  CLI releases. If parsing breaks, the orchestrator falls back to plain
  stdout capture; the transcript section will simply note 0 LLM calls.
- **minibob transcript token counts** are best-effort: only `usage` fields
  recorded by the LLM resolver land in the report. Cost USD is not yet
  computed from the transcript (minibob would need to inline pricing).
