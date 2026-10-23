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

## Activity Reuse Benchmark

Tracks whether recommendation quality improves after each change to selection. The
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
prior report by its date (`--baseline <YYYY-MM-DD>`) and shows deltas inline.

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
