# Proposal: MCP usage intent buckets

## Why

The current `UsageBadge` and `/mcp` Usage tab surface `total_calls` and a
per-tool count map. For the team-lead persona, `total_calls` is a vanity
number — "Alice called metabob 12 times" doesn't tell a manager what
Alice was *doing*. The persona's actual question is:

> "Is my team exploring problems, resolving them, documenting them, or
> shipping fixes? Is anyone stuck on exploration without converting to
> resolutions?"

The `by_tool` map already encodes that signal: `init_workspace +
search_codebase + analyze_impact` are exploration verbs; `mark_complete`
is a resolution verb; `annotate_component` is documentation; the
`assign_git_changes` tool is the shipping verb (links analysis to a
commit/PR scope).

This change re-buckets the existing `by_tool` data into four **intent**
categories and renders them as small inline badges. No new telemetry,
no schema changes — pure UI derivation on data we already collect.

## What changes

- Add an `intent` field to each entry in
  `repos/metabob-cloud-dashboard/src/data/mcp-catalog.ts`. Values:
  `"exploring" | "resolving" | "documenting" | "shipping"`. Mapping
  (10 tools total):
  - `exploring`: `init_workspace`, `get_problems`, `search_codebase`,
    `analyze_impact`, `predict_cochanges`, `get_analysis_context`,
    `get_metrics` (7 tools — observation/context gathering).
  - `resolving`: `mark_complete` (1 tool — the explicit
    "this is fixed / this is wrong" decision).
  - `documenting`: `annotate_component` (1 tool — explain/recommend
    notes).
  - `shipping`: `assign_git_changes` (1 tool — links analysis to a
    git changeset, i.e. work that is being shipped).
- New `IntentBreakdown` component
  (`src/features/mcp/components/IntentBreakdown.tsx`) that, given a
  snapshot, derives intent counts from `by_tool` and the catalog
  mapping, then renders four small badges sorted
  `exploring → resolving → documenting → shipping`. Empty intents
  render dimmed (not hidden) so the team lead sees "0 resolving"
  rather than a missing badge.
- Wire `IntentBreakdown` into `APIKeysPage` (next to the existing
  `UsageBadge`, which keeps its current shape — total + last_seen +
  failed sub-badge) and into the `/mcp` Usage tab summary section.
- Add an `intent` type-export from `mcp-catalog.ts` so other call
  sites can import it; `tier` field stays untouched for backward
  compat.
- No changes to `metabob-mcp`, `user-vessel`, or rpc-api.

## Impact

- `repos/metabob-cloud-dashboard/src/data/mcp-catalog.ts` — add field.
- `repos/metabob-cloud-dashboard/src/features/mcp/components/IntentBreakdown.tsx` — new.
- `repos/metabob-cloud-dashboard/src/features/api-keys/APIKeysPage.tsx` — render new component.
- `repos/metabob-cloud-dashboard/src/features/mcp/UsageTab.tsx` — render new component.

No backend impact. No env-var changes. No new dependencies.

## Risks

- **Mapping disagreement.** Engineers and team leads may disagree on
  whether `get_metrics` is "exploring" or its own category. Mitigation:
  ship the mapping in `mcp-catalog.ts` next to the tool definitions so
  future tool additions force a one-line decision rather than a
  scattered patch.
- **Intent skew.** If 7/10 tools are exploring, the exploring bucket
  will dominate almost every account. That's actually informative
  (it confirms metabob is currently exploration-heavy) but it means
  the breakdown is mostly "how much exploring vs. how much of
  everything else." Spec acknowledges this — the design is
  intentionally optimised for the team-lead question, not for a
  balanced four-quadrant chart.
