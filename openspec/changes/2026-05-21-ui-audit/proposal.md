# Proposal: UI audit scaffold

## Why

Refresh decisions for the cloud-dashboard have been taste-driven.
"That looks bad on mobile" is a real bug, but we have no way to
*detect* it — let alone regression-test that a refresh actually
improved things. The dashboard ships visible debt today: the
`/api-keys` key fingerprint overflows narrow viewports, the
`/mcp` tabs control was hand-rolled because the Tabs primitive
wasn't installed, and the Sidebar still uses emoji glyphs.
Without measurement, the stylesheet-refresh change (a sibling of
this one) can't prove it moved the needle and future regressions
will land silently.

This change ships the **measurement scaffold**: an automated UI
quality audit that runs as part of the existing
`bun run dev-loop` workflow and emits a machine-readable report.
Stylesheet-refresh consumes it; future refactors gate on it.

## What changes

- New devDependency: `@axe-core/playwright` for accessibility scan.
- New script `repos/metabob-cloud-dashboard/scripts/ui-audit.ts`:
  - Walks every authenticated route in the dashboard at three
    viewports (mobile 375×667, tablet 768×1024, desktop 1440×900).
  - For each (route, viewport): runs axe-core, then JS-side scans
    for overflow, truncation cliffs, and tap-target violations
    (interactive elements smaller than 24×24 CSS px).
  - Captures one screenshot per (route, viewport) to
    `e2e/results/ui-audit/<route-slug>--<viewport>.png`.
  - Emits `e2e/results/ui-audit.json` with violation entries plus
    a summary block.
- New `package.json` script: `bun run ui-audit`.
- `scripts/dev-loop.ts` (existing) invokes `ui-audit` after the
  rubric run and merges both into the printed summary. The audit
  uses the same dashboard process the rubric is already targeting
  (`BASE_URL`).
- New rubric spec `e2e/rubric/07-ui-quality.spec.ts`:
  - Reads `e2e/results/ui-audit.json`.
  - **Fails** when any axe violation has `serious` or `critical`
    severity.
  - **Warns** (logs but does not fail) on overflow, truncation,
    or tap-target violations.
  - Skips with a clear message when the JSON is missing
    (`ui-audit` not yet run).

## Impact

- `repos/metabob-cloud-dashboard/package.json` — devDep + script.
- `repos/metabob-cloud-dashboard/scripts/ui-audit.ts` — new.
- `repos/metabob-cloud-dashboard/scripts/dev-loop.ts` — invoke + merge.
- `repos/metabob-cloud-dashboard/e2e/rubric/07-ui-quality.spec.ts` — new.
- `repos/metabob-cloud-dashboard/e2e/results/ui-audit.json` — runtime artefact (gitignored).
- `repos/metabob-cloud-dashboard/e2e/results/ui-audit/*.png` — runtime artefacts (gitignored).

No production code changes; no env-var changes; no backend changes.

## Risks

- **Audit flakiness.** Headless Chromium occasionally renders
  text differently across runs; the overflow detector could
  flap. Mitigation: tolerate one retry per (route, viewport)
  inside the script before emitting a violation. The rubric
  spec only HARD-FAILS on axe violations, which are
  deterministic; the layout heuristics are advisory.
- **Audit duration.** 10 routes × 3 viewports × axe ≈ 60-90s on a
  reasonable laptop. The dev-loop's "tight loop" feel matters.
  Mitigation: viewports run sequentially per route but routes
  run in parallel (4-way). Target wall-clock: <30s.
- **Bikeshedding the rules.** The 24×24 tap-target threshold and
  the 1.3× overflow ratio are judgement calls. Mitigation:
  surface them as named constants at the top of `ui-audit.ts` so
  changing them is a one-line PR conversation.

## Non-goals

- No Storybook, Chromatic, or Percy.
- No screenshot diffing across runs (visual regression).
- No CI integration beyond the existing dev-loop.
- No fix-it suggestions — the audit reports, humans (or
  stylesheet-refresh) decide what to do.
