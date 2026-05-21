# Design: MCP usage intent buckets

## Context

`UsageBadge` shows `N calls · last seen X · M failed`. The `/mcp` Usage
tab currently renders the same data inside summary cards. Both views
answer "how much" but not "what kind." The team-lead rubric (spec
`team-lead-key-overview`) defines the team-lead persona; this change
extends what that persona sees without expanding the data contract.

## Intent taxonomy

Four intents, sorted by funnel position:

| Intent | Definition | Tools | Why this bucket |
|---|---|---|---|
| **exploring** | Gathering context about the codebase or current problems. | `init_workspace`, `get_problems`, `search_codebase`, `analyze_impact`, `predict_cochanges`, `get_analysis_context`, `get_metrics` | All read-only / context-loading. High count here means "looking around." |
| **resolving** | Making a decision about a problem (endorse/discard). | `mark_complete` | The single tool that closes a problem. The conversion verb. |
| **documenting** | Adding human-readable notes on a problem. | `annotate_component` | Distinct from resolving — explains/recommends but doesn't close. |
| **shipping** | Linking analysis to a git changeset. | `assign_git_changes` | The verb that says "I'm changing code that affects these components." |

`get_metrics` is borderline (could be its own "monitoring" bucket) but
collapsing it into `exploring` keeps the count at four and avoids a
near-empty fifth column. If a future tool adds a clearly distinct
intent (e.g., `submit_pr`), the mapping table absorbs the change.

## Component shape

```tsx
// src/features/mcp/components/IntentBreakdown.tsx
interface IntentBreakdownProps {
  byTool: Record<string, number>;  // from McpUsageResponse.by_tool
  variant?: "inline" | "card";     // inline for APIKeysPage row, card for /mcp Usage tab
}
```

Derivation: build a `Map<intent, number>` by iterating `byTool` and
looking up each tool's `intent` in `MCP_TOOL_CATALOG`. Tools missing
from the catalog (forward-compat: new mcp version emits a tool the
dashboard release doesn't know about yet) bucket into a fifth
implicit `"unknown"` count that is logged once to the console and
NOT rendered — keeps the UI four-column even on version skew.

Rendering: a flex row of four `<span>` badges. Each badge is
`<icon> <count> <label>` where icon is a unicode glyph (proposal text
suggested emoji; the stylesheet-refresh change will swap to lucide
icons across the dashboard, so this component uses lucide icons
from the start to avoid double-touching). Counts of 0 render with
`text-muted-foreground` and `opacity-60`.

## Placement

- **APIKeysPage row** — `IntentBreakdown variant="inline"` rendered
  on a new line below `UsageBadge`. NOT inlined into the same flex
  row as the existing meta-row; the current row already overflows
  on narrow viewports (called out in stylesheet-refresh).
- **/mcp Usage tab** — `IntentBreakdown variant="card"` rendered as
  a single full-width card above the existing per-tool summary
  cards. Larger badges, intent labels include hover tooltips
  listing which tools count toward each bucket.

## Non-goals

- No time-windowed slicing ("exploring this week vs. last week").
- No per-user (vs. per-key) rollup.
- No persisting the bucket assignment server-side — pure UI derivation.
- No new telemetry events. `by_tool` is already collected.
- No change to `UsageBadge`. It stays as-is so the existing rubric
  assertion (`\d+ calls`) continues to pass.

## Open questions

- Should the badges link to a filtered view (click "exploring" →
  show only exploring-tool entries in `by_tool`)? **Deferred** —
  out of scope for this change; if the team lead asks for it,
  a follow-up adds the route.

## Self-review

Argued against: (1) Four buckets may be over-engineered when 7/10
tools land in `exploring` — the breakdown is degenerate today.
(2) Mapping `get_metrics` into `exploring` is a judgement call that
will look wrong to some readers. (3) Adding `IntentBreakdown`
*alongside* `UsageBadge` doubles the visual noise on each row.
(4) The "unknown" bucket for version-skew is invented complexity
when the catalog is hand-maintained anyway. **Kept:** the four-bucket
taxonomy (the value proposition IS the resolving→shipping funnel,
even if exploring dominates today; the imbalance is itself the
finding). **Fixed:** placement is now on a *new line below*
UsageBadge rather than next to it, addressing (3) and avoiding
horizontal-overflow pressure that stylesheet-refresh has to clean
up; the inline variant uses small text + lucide icons rather than
the emoji originally proposed, so the visual weight stays low.
**Dropped:** the "unknown" bucket from the rendered UI — it stays as
a console.warn but doesn't take pixels.
