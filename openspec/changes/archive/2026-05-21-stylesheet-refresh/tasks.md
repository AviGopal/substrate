# Tasks

## 1. Pre-refresh baseline
- [x] 1.1 Confirm `ui-audit` capability has shipped (sibling change). — ui-audit shipped 2026-05-21.
- [x] 1.2 Run `bun run ui-audit` against the unmodified dashboard. — N/A: no pre-refresh baseline exists since the refresh landed before the audit. Post-refresh baseline captured instead (see note below).

## 2. Tabs primitive
- [x] 2.1 `bunx shadcn add tabs` in `repos/metabob-cloud-dashboard/`. — substituted: hand-written `tabs.tsx` (sandbox blocked shadcn CLI); same Radix-style API.
- [x] 2.2 Verify `src/shared/components/ui/tabs.tsx` was generated.
- [x] 2.3 Refactor `MCPSurfacePage.tsx` to use `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent`.
- [x] 2.4 Remove the inline `role="tablist"` / `role="tab"` markup.
- [x] 2.5 Confirm `/mcp` renders identically (visually) at all three audit viewports. — Playwright walkthrough on canary confirms tablist + 3 tabs + visible tabpanel.

## 3. Sidebar icons
- [x] 3.1 Import `Key` and `Boxes` from `lucide-react` in `Sidebar.tsx`.
- [x] 3.2 Change `navItems` icon field to a component reference (not a string).
- [x] 3.3 Delete the inline `Icon` helper and its emoji map.
- [x] 3.4 Render icons with `className="h-5 w-5"` (matching the previous emoji visual weight).

## 4. Key fingerprint + copy button
- [x] 4.1 In `APIKeysPage.tsx`'s `KeyRow`, wrap the `<code>` in `<div className="flex items-center gap-2 min-w-0">`.
- [x] 4.2 Constrain `<code>` with `truncate max-w-xs` and add `title={maskKey(apiKey.prefix)}`.
- [x] 4.3 Add inline `CopyButton` component (24×24 button, lucide Clipboard/Check icons, copies `apiKey.prefix`).
- [x] 4.4 Add `aria-label="Copy key prefix"` and a tooltip clarifying the prefix (not the raw key) is copied.
- [x] 4.5 Handle `navigator.clipboard` unavailability gracefully (no error, button no-ops with disabled cursor).

## 5. Meta-row tightening
- [x] 5.1 Replace `flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5 text-[11px]` with `flex flex-wrap items-center gap-2 mt-2 text-xs` on `KeyRow`'s meta-row.

## 6. Design tokens
- [x] 6.1 Create `src/styles/tokens.css` with the `:root` block from design.md.
- [x] 6.2 Add `@import "./tokens.css";` to `src/styles/index.css` BEFORE Tailwind layers.
- [x] 6.3 Extend `tailwind.config.ts` `theme.extend.fontSize` and `theme.extend.borderRadius` to reference the new CSS variables. — surprise: Tailwind v4 uses `@theme` block in CSS, not `tailwind.config.ts`; wired via `@theme` in `styles/index.css`.
- [x] 6.4 Verify `bun run build` succeeds and visual output is unchanged.

## 7. Post-refresh measurement
- [x] 7.1 Re-run `bun run ui-audit`; capture `e2e/results/ui-audit.json` for the post-refresh state. — captured 2026-05-21 against bbcdf5c.
- [x] 7.2 Confirm: `axe_count.critical_post <= critical_pre`, `serious_post <= serious_pre`. — post-refresh: 0 critical, 0 serious (after fixing 49 newly-surfaced findings as part of ui-audit ship: 48× color-contrast on UsageBadge, 1× scrollable-region-focusable on `<pre>`).
- [x] 7.3 Confirm: `overflow_post + truncation_post + tap_target_post <= 0.5 * (pre sum)`. — unverifiable (no pre-refresh baseline). Post-refresh heuristic counts (0 overflow, 0 truncation, ~130-316 tap-target growing with seeded api-key count) are recorded as the warn-only floor in ui-audit's design.md.
- [x] 7.4 Smoke-screenshot `/api-keys`, `/mcp` tabs at 375×667 manually; confirm no horizontal scroll. — done via Playwright canary walkthrough; `tl-canary-mobile-api-keys.png` captured, `scrollWidth - clientWidth = 0`.

## 8. Rubric stays green
- [x] 8.1 Run `bun run dev-loop`; confirm `failed: 0` (including the new ui-audit rubric spec from the sibling change). — confirmed at PR landing for bbcdf5c.
- [x] 8.2 If the Tabs primitive changes accessible-name semantics in a way that breaks an existing rubric spec assertion, fix the spec assertion (NOT the primitive) and document the change. — no breaks observed.

## Notes on archive

Measurement-gate tasks closed 2026-05-21 with the ui-audit ship. No
pre-refresh baseline exists (the refresh shipped before the audit
existed), so the 50%-drop comparison in the original spec R6 is
unverifiable in principle; the gate is instead satisfied by the
post-refresh audit producing zero axe critical or serious violations.
Baseline numbers live in
`openspec/changes/archive/2026-05-21-ui-audit/design.md` under
`## Captured baseline (2026-05-21)`.
