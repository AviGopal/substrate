# Design — the interface and layout stack, derived rather than inherited

Companion to `proposal.md`. Three parts: what the surface must do that constrains the stack,
the stack each constraint selects, and the design guide the result is validated against.

The instruction is to start from first principles and not carry the previous attempts. So
nothing below is justified by "the other repos use it." Where the answer happens to match
what a repo already has, it says so, but the reason given is the requirement.

---

## 1. What the surface must do

Eight requirements. Everything in §2 is chosen by one of them; anything not selected by one
of them is not in the stack.

**R1 — Render an open, ragged vocabulary.** The registry advertises hundreds of shapes and
the set grows by observation rather than declaration. Two live entries are prose sentences
that were registered as shape names. The surface therefore cannot hold a renderer per shape;
it dispatches on the *form* content takes, and the verbatim fallback is the common case.

**R2 — Never move under the reader.** Stable row identity across updates, total sort order,
cells that change while rows hold position, scroll and focus and selection preserved through
every update, arrivals above the viewport buffered rather than spliced. Layout shift without
user interaction is measurable, and the threshold is not a matter of taste.

**R3 — Suspend on interaction, and be pausable.** Updates hold while a pointer is in a live
region or an input in it has focus, and state is held rather than discarded so resuming does
not blank the surface. An explicit pause and an update-frequency control are required at
Level A, not offered as a nicety.

**R4 — Show content, not receipts.** Outputs are a set of shaped impulses; each is rendered
with its content, its true length, and whether what is shown is all of it.

**R5 — Address a run.** A run is a job with an identity, and the durable record is the trace.
That means a run has a URL — reachable tomorrow, by someone who was not there when it ran.

**R6 — Run anywhere, fetch nothing.** No CDN, no external font, no remote script at runtime.
The vessel serves its own built bundle.

**R7 — Be a compliant vessel.** Health, resolve endpoint dispatching on `pointer.type`,
discovery registration with a heartbeat, shape/dispatch agreement, `systemVessel`, traces for
every state-changing gesture.

**R8 — Be validated against the contract, by a machine.** The canonical patterns must be
checkable, and the check must be proven to refuse.

---

## 2. The stack, and what selects each piece

| Layer | Choice | Selected by |
|---|---|---|
| Language | TypeScript, `strict` | fleet invariant; R7 |
| Runtime | Bun | fleet invariant; the unit runs `bun src/index.ts` |
| Server | Hono | R7 — the vessel needs `/health` and a resolve switch and nothing more |
| Build | Vite | R6 — a build step is the only way to stop fetching React at runtime |
| View | React 19 | R2 — reconciliation with stable keys is precisely the primitive that lets a list update without losing identity, focus, or scroll |
| Data | TanStack Query | R3 — `enabled` suspends polling *without discarding cache*, which is the exact freeze-on-interaction semantic; plus retry/backoff for R5 |
| Routing | TanStack Router | R5 — a run needs a typed, addressable URL |
| Styling | Tailwind 4 | operator decision; its CSS-first config is what lets tokens live in a shared package rather than a JS config object |
| Tokens | `packages/design-tokens` | R8 — a value that is re-authored in three places cannot be checked in one |
| Conformance | `packages/interaction-conformance` | R8 |

**Deliberately excluded**, so the exclusions are decisions rather than omissions:

- **No component library, and no shadcn drop-in.** The primitive set is derived from the
  patterns in §3 — a verdict pill, a ledger entry, a stable row, a live region — and those do
  not exist in any general library. A generic set imports affordances the contract forbids.
- **No global state manager.** Server state is TanStack Query's; the only client state is
  selection, pause, and buffer, which are local. Reaching for a store here would put the
  board's truth somewhere other than the trace.
- **No animation library.** The only motion the contract wants is an in-place cell change,
  and it must respect reduced-motion.
- **No charting or graph library initially.** R1 says the common case is text; a chart
  primitive is earned when a shape's content form demands it, not bundled in advance.
- **No CSS-in-JS.** Tokens in CSS are checkable by reading CSS.

**On carrying nothing forward:** react-renderer's `src/primitives/` is the best existing
statement of what these primitives should be — `shape-slot` renders a resolved primitive with
a provenance strip, which is the ledger entry under another name. It is a **design input, not
a dependency**. Read it, then write the replacement against §3.

---

## 3. The design guide

The guide is three artifacts, because a guide with only one is either unenforceable or
unreadable.

### 3.1 Tokens — `packages/design-tokens`

One source for color, type scale, spacing, and radius, emitted as CSS custom properties and
consumed by Tailwind 4's CSS-first config.

The load-bearing part is the **semantic state palette**, which is separate from any accent
and is not a brand decision:

- `reached` and `not-reached` are defined at **equal visual weight**. Neither may be
  quieter than the other. This is the whole design encoded as a pair of tokens.
- `running`, `waiting`, `stalled`, and `accepted` are distinct from both and from each other.
- Every state token has a light and dark value meeting contrast on its own ground.
- **State is never carried by color alone** — each state has a token *and* a text label.

A surface that writes a hex value for a verdict state is non-conformant, and that is checkable
by reading the source for color literals outside the token package.

### 3.2 Patterns — the canonical interaction contract

The ten patterns in `../do-anything-surface/design.md` §3.1 are the contract, restated here as
rules a check can read. Each is written as a refusable condition.

| # | Rule | Checkable as |
|---|---|---|
| P1 | A verdict and a status are never rendered at equal prominence, and status is never rendered alone | static: any component reading `status` must also read `reached` |
| P2 | A suggestion inserts into an input; it never dispatches | static: starter handlers must not call the dispatch mutation |
| P3 | Arrivals above the viewport are buffered, not spliced | static: live lists must declare a buffer strategy |
| P4 | Lists render with a stable domain id, never an index key | static: AST — reject `key={i}` |
| P5 | Every sort comparator ends in a unique tiebreaker, and no comparator reads a value that changes during a run | static: AST on comparator returns |
| P6 | Every auto-updating region exposes pause and interval controls | static: a live region must be declared with both |
| P7 | Feedback options are mutually exclusive and collectively exhaustive, and no agree-affordance is offered | static: verdict option sets are declared, not inline |
| P8 | Content is rendered before, and never replaced by, its length or identifier | static: a length or trace id may not be the sole child of an evidence slot |
| P9 | Rendering dispatches on content form, and an unknown form falls through to verbatim | static: the form switch must have a default branch |
| P10 | Acceptance is rendered distinctly from completion, and silence is rendered as stalled | static: the state union must include `accepted` and `stalled` |
| P11 | No color literal outside the token package | static: source scan |
| P12 | No external host in the built bundle | static: scan build output for absolute URLs |

Some of these are genuinely static. Some are not, and saying so is part of the spec:
**P3, P5, and P6 have runtime consequences a parser cannot see.** A comparator can be
tie-broken correctly and still be fed a changing value at the call site. Those need the probe.

### 3.3 Conformance — `packages/interaction-conformance`

Two tiers, mirroring how shape-dispatch agreement is already enforced: a shared checker each
surface wires into its own `lint` via a thin shim, plus a runtime probe.

**Static tier.** Exits 0 clean, 1 on any unsuppressed violation, with a
`// @interaction:exempt <rule> — <reason>` annotation for deliberate divergence. An exemption
without a reason is itself a violation. This is deliberately the same shape as the existing
shape-dispatch checker, because a second checker with different ergonomics will be adopted by
nobody.

**Runtime tier — the probe.** Drives the built surface headlessly and measures what static
analysis cannot:

- **Layout stability** under a simulated arrival stream, with a hard budget. The reader's
  scroll offset must be unchanged and no row may change position.
- **Focus and selection survival** across an update — focus a control, deliver an update,
  assert focus is on the same element.
- **Freeze on interaction** — pointer into a live region, assert no reorder and no dropped
  event on resume.
- **Verdict legibility** — a run with `status: completed, reached: false` must render the
  not-reached token, asserted against the token value rather than a string.
- **The fallback path** — feed an impulse whose shape is one of the malformed prose names and
  assert the content renders verbatim rather than blank.

**The gate must be proven to refuse.** Each rule ships with a fixture that violates it, and
the suite asserts the checker *fails* on that fixture. A gate whose refusal has never been
observed cannot be trusted when it passes — the same defect as a verification gate with no
call sites, and this system has already paid for that lesson more than once.

### 3.4 The runtime reader

A guide only humans read teaches only the person who opened it. The surface is substrate-
editable, so the patterns must reach the drafter at prompt-build time or the first
substrate-authored change to the surface will be written against them.

The patterns are therefore also carried as **class-grain concepts in concept-db**, recalled
into the code-authoring prompt on the existing compose-lesson channel. The checker and the
concepts are generated from the same rule table in §3.2 — one source, two readers — so a rule
cannot be enforced without also being taught, or taught without being enforced.

---

## 4. Retirement

Retire rather than migrate, and retire completely — a vessel left dark is worse than one
removed, because it reads as available.

- **react-renderer** — remove the repo. Not in the inventory, manifest, or unit directory
  today, so nothing to unwire. Read `src/primitives/` first; it is the design input for the
  ledger entry and the provenance strip.
- **workbench** — same status, same treatment. The chain-surface contract it was written
  against outlives it and applies to whatever serves that need next.
- **stateful-ui-vessel** — the only one that runs, so it is the only real cutover. Its shapes
  (`uiPanel_write`, `uiQuestion_write`, `uiFeedback`, `interactor*`) must be served by the
  replacement **before** its unit is masked, or the substrate loses its ability to author a
  panel and ask a question. Retiring the vessel must not retire the vocabulary.

The port is inherited (`8270 → 18270`), the inventory entry is edited rather than added, and
the `ui` role is unchanged — so a spoke that masks `ui` keeps masking it.

---

## 5. What this does not resolve

- **metabob-cloud-dashboard is a separate product.** It is on Tailwind 4 already and can
  consume the token package, but it is not a substrate surface and is not in scope.
- **obsidian-vessel stays.** It is an Obsidian plugin, not a systemd vessel, and its renderer
  is the Obsidian DOM API. It should consume the same tokens and the same pattern checker —
  the contract is about behavior, not about React — but it is not replaced.
- **CORS.** A browser surface still needs either a proxy through the vessel or a change to
  goal-host. The proxy keeps the API key server-side and is the smaller change; it is a task
  for the surface, not a stack decision.
