# Tasks

## 1. Catalog mapping
- [x] 1.1 Add `intent` field to `McpToolEntry` type in `mcp-catalog.ts`.
- [x] 1.2 Populate `intent` on all 10 tools per the mapping in design.md.
- [x] 1.3 Export `McpIntent` union type.

## 2. Component
- [x] 2.1 Create `src/features/mcp/components/IntentBreakdown.tsx` with the `inline` and `card` variants.
- [x] 2.2 Use lucide icons (Search/Compass for exploring, CheckCircle2 for resolving, FileText for documenting, GitCommit for shipping).
- [x] 2.3 Log a single console.warn (once per session) when an unknown tool name appears in `by_tool`; do not render an "unknown" badge.
- [x] 2.4 Unit test: feed a synthetic `by_tool` map and assert bucket counts.

## 3. Wire into APIKeysPage
- [x] 3.1 Render `<IntentBreakdown variant="inline" byTool={usage?.by_tool ?? {}} />` on a new line below `UsageBadge` in `KeyRow`.
- [x] 3.2 Hide entirely when key is revoked (mirror the `UsageBadge` active-only treatment).
- [x] 3.3 Add `data-testid="intent-breakdown"` for E2E targeting.

## 4. Wire into /mcp Usage tab
- [x] 4.1 Render `<IntentBreakdown variant="card" byTool={snapshot.by_tool} />` above the existing per-tool summary cards.
- [x] 4.2 Render the card even on the zero-shape snapshot — all-zero counts are informative ("no activity in any intent").

## 5. Verification
- [x] 5.1 Manual visual check at 375×667, 768×1024, 1440×900: no overflow introduced.
- [x] 5.2 Confirm `bun run dev-loop` rubric still passes (no spec changes required; existing assertions are unaffected).
- [x] 5.3 Add a new rubric assertion (light): `/api-keys` row contains an element with `data-testid="intent-breakdown"`.
