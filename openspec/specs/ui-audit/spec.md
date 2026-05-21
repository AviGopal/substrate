# Capability: ui-audit

Automated UI quality measurement for the cloud-dashboard.
Emits a machine-readable report alongside the existing rubric so
visual debt (axe-core findings, overflow, truncation cliffs,
sub-24px tap targets) is detected and trackable. Provides the
baseline that `stylesheet-refresh` measures itself against.

## Requirements

### R1 — `bun run ui-audit` exists

`repos/metabob-cloud-dashboard/package.json` SHALL declare a script
`"ui-audit": "bun run scripts/ui-audit.ts"`. Invocation SHALL:

- Read `BASE_URL` (default `http://localhost:3000`).
- Probe `${BASE_URL}/health`; exit 2 with a pointer message if the
  dashboard is not reachable (matches existing `dev-loop` contract).
- Read `playwright/.auth/rubric.json`; exit 2 with a clear message
  if missing.
- Emit `e2e/results/ui-audit.json` and screenshots under
  `e2e/results/ui-audit/<route-slug>--<viewport>.png`.
- Exit 0 unless setup fails (the rubric spec, not this script,
  enforces the policy gate on violations).

### R2 — Route × viewport coverage

The audit SHALL walk every entry in the hand-listed `ROUTES` table
declared at the top of `scripts/ui-audit.ts`, at every entry in
the `VIEWPORTS` table.

`VIEWPORTS` SHALL be exactly:

| Name | Width × Height |
|---|---|
| `mobile` | 375 × 667 |
| `tablet` | 768 × 1024 |
| `desktop` | 1440 × 900 |

`ROUTES` SHALL include at minimum `/api-keys`, `/mcp?tab=tools`,
`/mcp?tab=install`, `/mcp?tab=usage`, and `/settings`. Routes
that return HTTP 404 or fail to render SHALL emit a `route_unreachable`
warning in the audit log but SHALL NOT block the run.

### R3 — Detection rules

For each (route, viewport) pair, the audit SHALL emit violation
entries of the following types:

**`axe`** — one entry per (rule, node) pair returned by
`@axe-core/playwright`'s `AxeBuilder().analyze()`. The entry SHALL
carry the axe `rule_id`, the offending CSS `selector`, the rule's
`impact` mapped to `severity` (`critical` | `serious` | `moderate` |
`minor`), and the human-readable `message`.

**`overflow`** — one entry per element where
`scrollWidth > clientWidth`, `textContent.trim().length > 4`, and
`boundingRect.width > 0 && boundingRect.height > 0`. Capped at 50
entries per (route, viewport).

**`truncation`** — one entry per element with computed
`text-overflow: ellipsis` AND `scrollWidth > clientWidth * 1.3`.

**`tap-target`** — one entry per element matching
`button, a, input, select, [role="button"]` whose
`boundingRect.width < 24 || boundingRect.height < 24` AND that is
visible (display !== "none", visibility !== "hidden", opacity > 0).

All thresholds SHALL be exposed as named constants at the top of
`scripts/ui-audit.ts`: `TAP_TARGET_MIN_PX = 24`,
`TRUNCATION_RATIO = 1.3`, `OVERFLOW_MIN_TEXT_LEN = 4`,
`OVERFLOW_CAP_PER_VIEW = 50`.

### R4 — Heuristic stability via retry

For the heuristic detections (`overflow`, `truncation`,
`tap-target`), the audit SHALL run the detection TWICE per (route,
viewport) and emit a violation only when both runs agree on the
offending selector. This dampens headless-Chromium font-rendering
flap. `axe` results SHALL NOT use this filter (axe rules are
deterministic).

### R5 — Report shape

`e2e/results/ui-audit.json` SHALL match:

```jsonc
{
  "timestamp": "<ISO-8601>",
  "base_url": "<string>",
  "route_count": <int>,
  "viewport_count": 3,
  "duration_ms": <int>,
  "violations": [ <Violation>, ... ],
  "summary": {
    "axe_count": { "critical": <int>, "serious": <int>, "moderate": <int>, "minor": <int> },
    "overflow_count": <int>,
    "truncation_count": <int>,
    "tap_target_count": <int>
  }
}
```

`Violation` is a discriminated union by `type` as specified in
design.md. Every violation SHALL carry `route`, `viewport`,
`selector`, and `screenshot_path`.

### R6 — Wall-clock budget

The audit SHALL complete within 60 seconds wall-clock for the
v1 route set on a reasonable developer machine. To meet this:

- Routes SHALL be processed in parallel with concurrency 4.
- Viewports for a given route SHALL be processed sequentially
  (so the same browser context handles all three viewports
  per route).
- Each (route, viewport) processing SHALL have an upper-bound
  timeout of 15 seconds; on timeout the audit emits a
  `route_unreachable` warning for that pair and continues.

### R7 — dev-loop integration

`scripts/dev-loop.ts` SHALL invoke `bun run ui-audit` after the
existing rubric Playwright run and BEFORE printing its summary
line. The printed summary SHALL include both the rubric block
and an `UI audit:` block with the four summary counts.

The dev-loop exit code SHALL be
`max(rubric_exit, ui_audit_run_exit, rubric_spec_07_exit)`.

### R8 — Rubric gate spec

`e2e/rubric/07-ui-quality.spec.ts` SHALL:

- Read `e2e/results/ui-audit.json` from disk.
- If missing, mark the spec `skipped` with a message pointing to
  `bun run ui-audit`.
- Assert `summary.axe_count.critical === 0`.
- Assert `summary.axe_count.serious === 0`.
- Log (without asserting) the overflow, truncation, and
  tap-target counts so reviewers see the trend.

`bun run dev-loop` MUST return `failed: 0` against the seeded
canary state as of the moment this capability ships (i.e., the
audit on the current dashboard MUST NOT produce any axe critical
or serious violations; if it does, those are fixed as part of
this change or `stylesheet-refresh`, not deferred).

### R9 — Artefact hygiene

`e2e/results/ui-audit/` and `e2e/results/ui-audit.json` SHALL be
listed in `.gitignore`. They are runtime artefacts, never
committed.

The full audit JSON SHALL NOT be committed under
`openspec/changes/`. Instead, this change's `design.md` SHALL
carry a `baseline-counts:` block summarising the four headline
counts (`axe_count.critical`, `axe_count.serious`,
`overflow_count + truncation_count + tap_target_count` sum, and
`tap_target_count` alone) for the pre-refresh dashboard. The
post-refresh comparison from `stylesheet-refresh` R6 SHALL
reference these summary numbers, not a committed JSON artefact.

### R10 — Standalone surface and adjacent contracts preserved

This capability SHALL NOT introduce dependencies on
`activity-api`, `discovery-vessel`, or `rpc-api`. The audit SHALL
target ONLY the local dashboard (`BASE_URL`) and SHALL NOT call
identity-vessel, user-vessel, or any other backend directly.
Standalone-product-surface R1-R7, mcp-usage-telemetry R1-R9, and
team-lead-key-overview R1-R7 remain in force.

## Non-requirements

- This capability does NOT specify visual regression diffing
  across runs (no Percy / Chromatic equivalent).
- This capability does NOT specify Storybook coverage.
- This capability does NOT specify CI-side integration beyond
  `bun run dev-loop`.
- This capability does NOT specify fix-it suggestions.
- This capability does NOT specify a separate report viewer UI —
  reviewers read the JSON, look at the screenshots in
  `e2e/results/ui-audit/`, or open the Playwright HTML report.
- This capability does NOT specify accessibility audit beyond
  what axe-core ships out of the box (no custom rules,
  no manual screen-reader checks).
