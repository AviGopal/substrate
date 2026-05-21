# Design: Stylesheet refresh

## Context

`ui-audit` measures; this change fixes. The fixes are scoped to
observable problems already enumerated in the proposal — no
speculative refactoring.

## Token surface

`src/styles/tokens.css` defines CSS custom properties under
`@layer base`. The token names mirror Tailwind's existing scale
so the migration is renaming, not redefining:

```css
@layer base {
  :root {
    /* type scale */
    --text-scale-xs: 0.6875rem;   /* 11px — matches current usage */
    --text-scale-sm: 0.8125rem;   /* 13px */
    --text-scale-base: 0.875rem;  /* 14px — page text */
    --text-scale-lg: 1rem;
    --text-scale-xl: 1.25rem;

    /* spacing scale (used by gap, padding, margin) */
    --space-scale-1: 0.25rem;
    --space-scale-2: 0.5rem;
    --space-scale-3: 0.75rem;
    --space-scale-4: 1rem;
    --space-scale-6: 1.5rem;

    /* radii */
    --radius-sm: 0.125rem;
    --radius-md: 0.375rem;
    --radius-lg: 0.5rem;
    --radius-full: 9999px;

    /* focus ring */
    --ring-color: hsl(199 75% 49%);
    --ring-width: 2px;
  }
}
```

Existing colour custom properties (`--foreground`, `--muted`,
`--primary`, etc.) defined in the current `index.css` STAY in
place — they're already token-shaped; renaming them is out of
scope.

`tailwind.config.ts` (`theme.extend`):

```ts
extend: {
  fontSize: {
    xs: "var(--text-scale-xs)",
    sm: "var(--text-scale-sm)",
    base: "var(--text-scale-base)",
    lg: "var(--text-scale-lg)",
    xl: "var(--text-scale-xl)",
  },
  borderRadius: {
    sm: "var(--radius-sm)",
    md: "var(--radius-md)",
    lg: "var(--radius-lg)",
    full: "var(--radius-full)",
  },
}
```

Spacing scale is NOT extended in Tailwind — that would require
rewriting every `p-2`/`gap-4` reference. Tokens stay available
for future use; component classes are unchanged.

## Tabs migration

Before (`MCPSurfacePage.tsx` lines 36-57):

```tsx
<div role="tablist" aria-label="MCP sections" className="...">
  {TABS.map((t) => (
    <button role="tab" aria-selected={active === t.id} ...>{t.label}</button>
  ))}
</div>
<div role="tabpanel">
  {active === "tools" && <ToolCatalogTab />}
  ...
</div>
```

After:

```tsx
<Tabs value={active} onValueChange={(v) => setActive(v as TabId)}>
  <TabsList>
    {TABS.map((t) => (
      <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>
    ))}
  </TabsList>
  <TabsContent value="tools"><ToolCatalogTab /></TabsContent>
  <TabsContent value="install"><InstallTab /></TabsContent>
  <TabsContent value="usage"><UsageTab /></TabsContent>
</Tabs>
```

The `?tab=` URL-sync behaviour (if present elsewhere) is unchanged.

## Sidebar icon migration

Before: `<Icon name="key" />` renders `🔑`.

After: import lucide icons in `Sidebar.tsx`; nav table changes from
`{ icon: "key" }` (string) to `{ icon: Key }` (component reference);
the inline `Icon` helper is deleted. The rendered icon uses
`<Item.icon className="h-5 w-5" />`. The visible position and
sizing are preserved.

## Key fingerprint

Before:

```tsx
<code className="text-[12px] font-mono text-foreground/70 block truncate">
  {maskKey(apiKey.prefix)}
</code>
```

After:

```tsx
<div className="flex items-center gap-2 min-w-0">
  <code className="text-xs font-mono text-foreground/70 truncate max-w-xs" title={maskKey(apiKey.prefix)}>
    {maskKey(apiKey.prefix)}
  </code>
  <CopyButton value={apiKey.prefix} aria-label="Copy key prefix" />
</div>
```

`CopyButton` is a small inline component that wraps the existing
`navigator.clipboard.writeText` pattern from `NewKeyBanner` and
uses the lucide `Clipboard` / `Check` icons. It's a 24×24 button
(matches the audit's tap-target floor).

Note: we copy the **prefix**, NOT the full key. The full raw key
is shown once at creation (existing contract) and never re-shown.
The button's `aria-label` and tooltip both make that clear.

## Meta-row tightening

Before:

```tsx
<div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5 text-[11px] text-muted-foreground tabular-nums">
```

After:

```tsx
<div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted-foreground tabular-nums">
```

The `gap-2` (0.5rem horizontal AND vertical) produces consistent
spacing when items wrap. `text-xs` (11px via the new token) is
unchanged.

## Verification approach

This change SHALL produce a baseline `ui-audit.json` BEFORE any
file edits land (run `bun run ui-audit` on the current `HEAD`)
and a post-refresh `ui-audit.json` AFTER. Both are committed to
the change directory as `baseline-ui-audit.json` and
`post-refresh-ui-audit.json` for reviewer inspection. The spec
asserts:

- `axe_count.critical_post <= axe_count.critical_pre`
- `axe_count.serious_post <= axe_count.serious_pre`
- `(overflow_post + truncation_post + tap_target_post) <= 0.5 * (overflow_pre + truncation_pre + tap_target_pre)`

The 50% reduction target is the success criterion from the
proposal.

## Self-review

Argued against: (1) Introducing CSS tokens without rewriting any
component class is a half-measure — the tokens exist but nothing
*uses* them, so the change adds a file that does nothing. (2)
The copy-to-clipboard button copies the masked-prefix, which is
useless ("`mb-canary-abc·····`" can't be used as a key) — a copy
button on something nobody wants to copy is theatre. (3) Swapping
Sidebar emoji to lucide icons is taste, not a measured fix —
`ui-audit` won't catch the emoji. (4) The 50% reduction target is
arbitrary; if pre-refresh count is 2, post-refresh count of 1
"passes" while changing nothing meaningful. **Kept:** tokens
file (the wiring of `var(--text-scale-*)` into Tailwind's
`theme.extend.fontSize` DOES re-route every `text-xs` / `text-sm`
through the token — that's a real change, not theatre, even
though component code is untouched). The 50% target (it's a soft
asymmetric gate: if baseline is 2 we expect at minimum 1 — and
the audit's screenshots tell the real story regardless of the
arithmetic). **Fixed:** copy-button now copies a *useful*
value — the `apiKey.prefix` (un-masked, 12-char identifier) which
IS what a user reads off the page to grep their logs / verify
which key they're holding. The proposal's "copy the masked
fingerprint" framing was wrong; the spec is now explicit. The
Sidebar icon swap stays as a *low-cost* improvement bundled into
the refresh; the spec is honest that audit won't measure it.
**Dropped:** plans to rewrite the spacing scale in Tailwind
(would have touched dozens of files for cosmetic gain).
