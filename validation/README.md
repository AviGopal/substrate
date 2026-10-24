# validation/ — benchmark harnesses

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
