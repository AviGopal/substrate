# Design: UI audit scaffold

## Context

`bun run dev-loop` (capability `playwright-dev-loop`) currently runs
6 rubric specs against the canary dashboard and emits
`e2e/results/last-run.json`. Specs cover *functional* paths
(onboarding, observing agent activity, managing the team).
They do NOT cover *visual quality*: nothing fails when text
overflows on a 375px viewport, nothing fails when interactive
buttons drop below the WCAG 2.5.5 tap-target minimum, nothing
fails when an axe-core scan flags missing aria labels.

The sibling `stylesheet-refresh` change ships visible UI
improvements. Without a measurement baseline, both the "before"
and "after" are subjective. This change provides the baseline.

## Audit shape

```
ui-audit.json
├── timestamp: ISO-8601
├── base_url: string (echoed from $BASE_URL)
├── route_count: int
├── viewport_count: int (always 3 in v1)
├── duration_ms: int
├── violations: Violation[]
└── summary:
    ├── axe_count: { critical, serious, moderate, minor }
    ├── overflow_count: int
    ├── truncation_count: int
    └── tap_target_count: int
```

`Violation` discriminated union by `type`:

```ts
type Violation =
  | {
      type: "axe";
      route: string;
      viewport: ViewportName;
      severity: "critical" | "serious" | "moderate" | "minor";
      rule_id: string;         // axe rule e.g. "color-contrast"
      selector: string;
      message: string;
      screenshot_path: string;
    }
  | {
      type: "overflow";
      route: string;
      viewport: ViewportName;
      selector: string;
      scroll_width: number;
      client_width: number;
      sample_text: string;     // first 80 chars of element textContent
      screenshot_path: string;
    }
  | {
      type: "truncation";
      route: string;
      viewport: ViewportName;
      selector: string;
      scroll_width: number;
      client_width: number;
      screenshot_path: string;
    }
  | {
      type: "tap-target";
      route: string;
      viewport: ViewportName;
      selector: string;
      width: number;
      height: number;
      screenshot_path: string;
    };
```

## Route walker

The dashboard uses TanStack Router (`src/routes/routeTree.ts`).
Rather than parsing the route tree at runtime (brittle), the audit
ships a **hand-listed route table** at the top of `ui-audit.ts`:

```ts
const ROUTES = [
  "/api-keys",
  "/mcp",
  "/mcp?tab=tools",
  "/mcp?tab=install",
  "/mcp?tab=usage",
  "/members",       // skipped if 404 (some standalone builds don't ship it)
  "/settings",
] as const;
```

This is intentionally small and human-curated. When a new route
is added, the audit table is updated in the same change. Drift
between the route tree and the audit list is acceptable: the audit
is a sample, not a coverage tool.

Pre-walk: navigate to `/api-keys` using the same `playwright/.auth/rubric.json`
storage state the rubric uses, so the audit runs *authenticated*.
This requires `bun run dev-loop` to have run setup first (or the
audit script lazily runs the rubric's globalSetup if `.auth` is
missing). The audit prints a clear error and exits 2 when the auth
state is unavailable.

## Viewport set

| Name | Size | Why |
|---|---|---|
| `mobile` | 375×667 | iPhone SE — the smallest viewport we commit to support |
| `tablet` | 768×1024 | iPad — split-screen and PWA contexts |
| `desktop` | 1440×900 | Median laptop |

These are NOT the Playwright `Pixel 5`/`iPhone 12` device profiles
(which simulate touch, DPR, and user-agent). Audit cares about
*layout*, not *device emulation*, so we set raw viewport sizes and
keep desktop Chromium otherwise.

## Detection heuristics

### Overflow

For every element whose `scrollWidth > clientWidth` AND that contains
non-whitespace text content longer than 4 chars AND is visible
(`getBoundingClientRect().width > 0 && height > 0`), emit one
`overflow` violation. Cap: 50 violations per (route, viewport)
to keep the report bounded.

### Truncation cliffs

For every element whose computed style has
`text-overflow: ellipsis` AND `scrollWidth > clientWidth * 1.3`,
emit one `truncation` violation. The 1.3× threshold is the call:
truncation is *fine* (it's a deliberate design choice for fingerprints,
long names, etc.) but truncating 30% past the visible width usually
means the original layout assumed more horizontal space than the
viewport gave it.

### Tap targets

For every element matching `button, a, input, select, [role="button"]`
whose bounding box is less than 24×24 CSS pixels (WCAG 2.5.5 "Target
Size (Minimum)"), emit one `tap-target` violation. We use 24 rather
than 44 (Apple HIG) or 48 (Material) because 24 is the WCAG floor —
violating 24 is unambiguous; violating 44 is a stricter judgement
call.

### Axe

Run `@axe-core/playwright`'s `AxeBuilder().analyze()` and emit
one violation per `(rule, node)` pair. `severity` maps from axe's
`impact` field.

## Severity policy

- **HARD FAIL (rubric exit non-zero):** axe `critical` or `serious`.
- **WARN (logged, exit 0):** axe `moderate` / `minor`; all overflow,
  truncation, tap-target.

This matches the proposal: refactor cycles aren't blocked by the
heuristic detections (which sometimes flap), but axe-detected
accessibility regressions ARE blocking.

## dev-loop integration

`scripts/dev-loop.ts` runs rubric first (existing), then `ui-audit`,
then prints a merged summary:

```
Rubric: passed=13 failed=0 skipped=2
UI audit: axe=5 (1 serious, 4 moderate) | overflow=3 | truncation=2 | tap-target=1
Exit: 1 (rubric failed=0; axe serious=1)
```

`ui-audit` exits non-zero on its own when it can't run (auth missing,
dashboard unreachable). The dev-loop's exit is `max(rubric_exit, audit_exit, rubric_07_exit)`.

## Self-review

Argued against: (1) The hand-listed `ROUTES` table will drift —
someone will add `/billing` and forget to update the audit list,
so the audit's "coverage" claim is hollow. (2) The 24×24 tap-target
threshold is below WCAG AAA (44px) and below platform conventions,
so passing the audit doesn't mean the UI is touch-friendly, just
that it isn't catastrophic. (3) Running axe + heuristics + screenshots
on 10 routes × 3 viewports could blow past the 30s wall-clock target.
(4) Tying `ui-audit` exit code to the dev-loop means a noisy axe
finding could block a deploy unrelated to UI work. **Kept:** the
hand-listed route table (the spec is explicit that drift is
acceptable; audit is a sample). The 24×24 floor (the choice is
documented; tightening to 44 is a one-line constant change later).
The rubric-spec-as-gate model (axe critical+serious failures SHOULD
block deploys — that's the point of the scaffold). **Fixed:** the
parallelism strategy is now explicit (routes parallel 4-way,
viewports sequential per route) and the script has a 60s timeout
per route+viewport so it can't hang indefinitely. **Dropped:** the
implicit assumption that the audit can run without auth — the spec
now requires the rubric's `.auth/rubric.json` and exits 2 with a
clear message when it's missing.
