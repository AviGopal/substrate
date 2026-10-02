# activity-reuse-validation-harness Specification

## Purpose

Today we cannot quantitatively answer "is the system getting better at finding and reusing the right activity?" Validation campaigns are ad-hoc, one-shot, and don't compare against a baseline. This spec defines a reproducible benchmark suite that runs a fixed set of prompts, captures retrieval ranks + Thompson posterior trajectories + reuse rates, and emits a longitudinal report. It transforms learning-loop quality from a qualitative observation into a measured property.

## Requirements

### Requirement: Versioned benchmark set

A benchmark set SHALL exist at `validation/activity-reuse-benchmark.json` containing 20 entries. Each entry has:

```json
{
  "id": "bug-fix-multiply",
  "goal_text": "fix the bug in src/math.ts where multiply(3,4) returns 16",
  "expected_activity_id": "activity:fix-bug-complete",
  "expected_output_shapes": ["fileEdit", "testResult"],
  "category": "bug-fix",
  "seed_impulse_pool": ["file:src/math.ts", "directoryTree:src"]
}
```

The set SHALL contain at least 8 bug-fix, 6 feature-add, 4 refactor, and 2 documentation entries. Each entry's `expected_activity_id` SHALL exist in the registry as of the benchmark's commit date.

#### Scenario: Benchmark set is versioned

- **WHEN** the benchmark set is updated with new or changed entries
- **THEN** the file's git history records the change
- **AND** the harness records `benchmark_version: <commit-sha>` in every report so reports are comparable across runs of the same version

### Requirement: MRR computation against the recommend endpoint

The harness `validation/scripts/reuse-harness.ts` SHALL call `POST /v2/activities/recommend` for each benchmark entry with the entry's `goal_text` and `seed_impulse_pool`, then compute the rank position of `expected_activity_id` in the returned recommendations.

Mean Reciprocal Rank (MRR) SHALL be computed as `mean(1/rank_i)` across the 20 entries; entries where the expected activity does not appear in the top-20 contribute `0` to the mean.

#### Scenario: MRR captured per run

- **WHEN** the harness runs the full benchmark set
- **THEN** each entry's rank is recorded in the report
- **AND** the aggregate MRR is reported with breakdown by category (bug-fix, feature-add, refactor, docs)

### Requirement: Thompson posterior snapshot

The harness SHALL capture a snapshot of the top-50 templates by `total_executions`, recording for each: `(activity_id, alpha, beta, total_executions, success_rate, ci_width)`. `ci_width` is the difference between the 0.975 and 0.025 quantiles of the Beta(α, β) distribution.

#### Scenario: CI width narrows over weeks

- **WHEN** the harness runs at week N and again at week N+4
- **THEN** the report at week N+4 shows `ci_width_delta` per activity vs week N
- **AND** activities with significant new execution volume show `ci_width_delta < 0` (narrower CI = more confident posterior)

### Requirement: Reuse rate computation

The harness SHALL compute the 7-day reuse rate as `reused_executions / total_executions` over `trace_digest`, where:

- `total_executions` = count of rows with `executed_at > now() - 7d`
- `reused_executions` = same with `activity_id != 'improvise'` AND `activity_template.created_at < (executed_at - 24h)` (template existed 24h+ before this execution)

The harness SHALL also compute `improvise_share = improvise_executions / total_executions` for the same window.

#### Scenario: Reuse rate emitted with deltas

- **WHEN** the harness runs after a baseline has been captured
- **THEN** the report includes current reuse rate, current improvise share, and deltas from the baseline
- **AND** a `trend` field indicates `up` / `down` / `flat` based on whether reuse rate moved by ≥ 1 percentage point

### Requirement: Versioned report output

Each harness run SHALL emit a JSON report at `validation/results/{ISO_DATE}-reuse-report.json` with schema:

```json
{
  "harness_version": "<commit-sha>",
  "benchmark_version": "<commit-sha>",
  "ran_at": "<ISO datetime>",
  "baseline_ref": "<filename or null>",
  "mrr": { "overall": 0.62, "by_category": { ... } },
  "reuse_rate_7d": 0.71,
  "improvise_share_7d": 0.18,
  "thompson_snapshot": [ { "activity_id": "...", "alpha": ..., "beta": ..., "ci_width": ... }, ... ],
  "deltas_vs_baseline": { "mrr_delta": 0.05, "reuse_rate_delta": 0.03, ... },
  "raw_ranks": [ { "benchmark_id": "...", "rank": 2, "found": true }, ... ]
}
```

#### Scenario: Report is self-contained

- **WHEN** a report file is opened standalone
- **THEN** all metrics, the benchmark version used, and the comparison baseline (if any) are present in the file
- **AND** no external lookup is required to interpret the numbers

### Requirement: Report comparison tool

A companion script `validation/scripts/compare-reports.ts` SHALL accept two report paths and emit a markdown-formatted diff to stdout, including: MRR delta with significance, reuse rate delta, top-10 templates by α growth, top-10 templates by CI width reduction.

#### Scenario: Diff highlights regressions

- **WHEN** report B has lower MRR than report A by more than 0.05
- **THEN** the diff output flags `⚠️ MRR regression` prominently
- **AND** the affected categories are listed

### Requirement: Single-command invocation

The harness SHALL be runnable as `bun run validation/scripts/reuse-harness.ts [--baseline <date>]`. With no baseline argument, the report has `baseline_ref: null`. With a baseline, deltas are computed against that baseline file.

#### Scenario: First run sets baseline

- **WHEN** the harness runs for the first time with no baseline argument
- **THEN** the report is emitted with `baseline_ref: null` and no `deltas_vs_baseline` field
- **AND** the file is suitable for use as a future baseline

#### Scenario: Subsequent run compares to baseline

- **WHEN** the harness runs with `--baseline 2026-05-06`
- **THEN** the report computes deltas vs `validation/results/2026-05-06-reuse-report.json`
- **AND** the deltas section is populated

### Requirement: Cost cap

The harness SHALL not exceed a total cost ceiling of `$5` per run (Anthropic API + activity-api compute). The harness SHALL abort with a clear error if the projected cost exceeds the cap.

#### Scenario: Cost cap respected

- **WHEN** the harness has accumulated `$4.50` across the first 18 of 20 benchmark entries
- **AND** the projected cost of the remaining 2 entries would exceed `$5`
- **THEN** the harness logs the partial result, emits a partial report flagged `truncated: true`, and exits with non-zero status
