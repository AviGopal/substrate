# @avigopal/interaction-conformance

Zero-dependency static checker for the **canonical interaction contract**
(`openspec/changes/human-surface-stack/design.md` §3.2). It refuses a surface that
renders a status without its verdict, keys a live list on an array index, hides an
unknown content form behind a blank default, hard-codes a colour, or ships an
external host in its bundle.

Deliberately the same ergonomics as
[`@avigopal/shape-dispatch-check`](../shape-dispatch-check/) — same CLI shape, same
exit codes, same `[kind] name` / `at file:line` / `→ hint` reporting, same
preceding-line annotation walk. A second checker with different ergonomics gets
adopted by nobody.

## Usage

```bash
# Check a surface
bun packages/interaction-conformance/check.ts repos/human-surface-vessel/

# Check the current directory
bun packages/interaction-conformance/check.ts

# Print the rule table (including what each rule does NOT decide)
bun packages/interaction-conformance/check.ts --list

# Emit the concept-db lesson payloads generated from the same rule table
bun packages/interaction-conformance/check.ts --emit-concepts

# Source rules only, consciously skipping P12 (see "The dist/ hard error")
bun packages/interaction-conformance/check.ts . --no-dist
```

Exit **0** on a clean surface, exit **1** on any unsuppressed violation or on a
surface that could not be checked.

The checker takes the surface root as `argv`, so it never scans its own package —
`fixtures/` is deliberately full of violating code and is only ever fed to the
checker by `prove-refusal.ts`, which assembles each fixture into a scratch root.

**What is scanned:** `**/*.{ts,tsx,css}` under the root for the source rules
(skipping `node_modules`, `dist`, `build`, `out`, `.next`, `coverage`), and
`dist/**/*.{js,css,html}` for P12.

## The rule table

Tiers are not decoration. The vacuity test for any check is: *if I write the
violating code the rule is actually about, does the check still pass?*

- **static-easy** — the check decides the rule. Writing the violation trips it.
- **static-hard** — the check decides a **provable half** of the rule. The residue
  is semantic or runtime and belongs to the probe. Every one is listed under
  [WHAT THIS DOES NOT COVER](#what-this-does-not-cover) below.

| # | Rule | Tier | What the check decides |
|---|---|---|---|
| **P0** | An exemption names a real rule and carries a reason | static-easy | Every `@interaction:exempt` annotation names a rule id in the table and carries a reason of ≥12 non-whitespace characters |
| **P1** | A verdict and a status are never rendered at equal prominence, and status is never rendered alone | static-hard | A `.tsx` reading `.status` in a JSX expression must also reference `reached` in the same file |
| **P2** | A suggestion inserts into an input; it never dispatches | static-hard | Inside a declaration named `*starter*`/`*suggestion*`, rejects `dispatch*(` / `submit*(` / `mutate*(`, `use*Dispatch(Mutation)?`, `requestSubmit()` |
| **P3** | Arrivals above the viewport are buffered, not spliced | static-hard | A file with a liveness source that renders a `.map(` list must render it through `<LiveList>` with an explicit `buffer=` prop |
| **P4** | Lists render with a stable domain id, never an index key | **static-easy** | Captures the **second** `.map`/`.flatMap` callback parameter *by name* and rejects `key={IDX}`, ``key={`…${IDX}…`}``, `key={IDX + 1}` |
| **P5** | Every sort comparator ends in a unique tiebreaker, and no comparator reads a value that changes during a run | static-hard | Rejects volatile fields in a `.sort(` callback; otherwise requires ≥2 compared fields or an `id`/`dispatchId`/`traceId` comparison |
| **P6** | Every auto-updating region exposes pause and interval controls | static-hard | A file with a liveness source must bind both a `paused`/`isPaused` and an `interval`/`refreshInterval` identifier |
| **P7** | Feedback options are MECE, and no agree-affordance is offered | static-hard | `options=` must bind an **imported** identifier, not an inline literal; agree-shaped labels (`agree`, 👍, `thumbs up`, `looks good`, `lgtm`) are rejected |
| **P8** | Content is rendered before, and never replaced by, its length or identifier | static-hard | Inside `<EvidenceSlot>`, violation when every expression child is `chars\|length\|traceId\|trace_id\|dispatchId\|sizeBytes` and no `content\|preview\|body\|text` appears |
| **P9** | Rendering dispatches on content form, and an unknown form falls through to verbatim | **static-easy** | The content-form `switch` must have a `default:`, and that default must reference a **verbatim renderer** and must **not** `return null` / `return <></>` |
| **P10** | Acceptance is rendered distinctly from completion, and silence is rendered as stalled | static-hard | The exported run-state union must contain the literals `'accepted'` **and** `'stalled'` |
| **P11** | No colour literal outside the token package | **static-easy** | `#`-anchored hex, `rgb()/rgba()/hsl()/hsla()/oklch()/lab()/color-mix()`, Tailwind arbitrary `-[#rrggbb]`, over `**/*.{ts,tsx,css}` |
| **P12** | No external host in the built bundle | **static-easy** | Absolute URLs, protocol-relative hosts, and remote `@font-face url()` in **`dist/`**. Allowlists `http://www.w3.org/*`, sourcemap pragmas, license banners |
| **P13** | No confidence percentage is rendered anywhere | **static-easy** | A `%` on any line binding `confidence`/`certainty`/`probability`, or `toFixed(` on such a binding |

`P13` is not in the design's §3.2 table. It is the design's **standing omission**:
planner confidence is uncalibrated in this system — `conf 0.0` has outperformed
`conf 0.9` — so rendering it as a number launders a known-bad signal into something
that looks precise. Enforced here, and taught on the same channel as the rest.

### Deliberate non-vacuity, three places worth naming

- **P4 does not hardcode `i`.** It captures whatever the second callback parameter
  is called, so `key={idx}` and `key={n + 1}` are the same bug and both trip.
  `` key={`${row.id}-${i}`} `` is composite and passes.
- **P9 is strengthened past "has a default".** `default: return null` *is* the
  silent blank P9 exists to prevent, so a bare default-branch check would be
  decoration. The default must reference a verbatim renderer.
- **P11 is anchored on `#`.** A hex-*shaped* trace id such as `'994b5e'` has no
  hash and must never trip; a URL fragment such as `#section` is not hex after the
  hash. Both are pinned by fixtures.

### The `dist/` hard error

P12 is decidable only against build output. **If `<root>/dist` is absent, the
checker exits 1 with an error** — it does not skip P12 and report success. A silent
skip is a green gate that never looked, and this system has already paid for that
lesson more than once.

`--no-dist` exists for the case where you have consciously decided to run the
source rules alone. It says so in the success line (`P12 NOT checked`) so the
weaker result cannot be mistaken for the strong one.

## Exemptions

```tsx
// @interaction:exempt P4 — fixed legend rendered once, never reordered
<li key={idx}>{row.label}</li>
```

The annotation goes on the line **immediately preceding** the flagged line; blank
lines between are skipped, matching shape-dispatch's backward walk. `—`, `--`, and
`-` are all accepted as the separator.

File-level, within the **first 5 lines**:

```ts
// @interaction:exempt-file P11 — this module is the token emitter itself
```

Two things keep this channel from being a hole:

- **A bare exemption is itself a violation.** No rule id, or a reason under 12
  non-whitespace characters, reports as `P0` / `bare_exemption` — and suppresses
  nothing.
- **An exemption naming an unknown rule id is a violation** (`P0` /
  `unknown_rule`), so a typo fails loudly instead of silently exempting nothing.
  If a bad id suppressed, the cheapest way past the gate would be to misspell one.

## WHAT THIS DOES NOT COVER

Every `static-hard` rule is a **partial** check. Writing code that satisfies the
checker is not proof of conformance for any of these — the residue needs the
runtime probe (design.md §3.3), and until that exists these properties have **no
static enforcement at all**:

| Rule | Not covered |
|---|---|
| **P1** | **Relative prominence.** Both `status` and `reached` can be present while the verdict renders as 10px grey text beside a status pill. Needs the probe's verdict-legibility assertion against the token value. |
| **P2** | **Indirection.** A starter calling a locally-aliased helper, or dispatching through a context object under any other name, escapes entirely. Only direct, conventionally-named calls are seen. |
| **P3** | **Whether the buffer does anything.** `buffer={() => {}}` or `buffer={0}` passes — this is a presence check on the prop. Only the probe's layout-stability run under a simulated arrival stream can decide it. |
| **P5** | **Both arms are heuristic.** The volatile-field list is a denylist, not a proof of stability, and a comparator can be tie-broken correctly and still be fed a changing value at the call site. |
| **P6** | **Whether the controls are wired or reachable.** Two unused `useState` bindings satisfy it. Freeze-on-interaction and focus survival are the probe's. |
| **P7** | **MECE-ness itself.** Whether the declared option set actually partitions the outcome space is semantic and undecidable here. Declaration only makes the set reviewable in one place. |
| **P8** | **Semantics.** A slot rendering `{summary}` passes while showing a model-authored gloss instead of the payload. The check cannot tell content from a description of content. |
| **P10** | **Rendering.** The union can carry `'accepted'` and `'stalled'` while the component renders acceptance identically to completion and never derives `stalled` from silence at all. |

Properties from §3.3 with **no static enforcement whatsoever**, in this or any
other tier here — they exist only as probe assertions:

- Layout stability under an arrival stream (scroll offset unchanged, no row moves).
- Focus and selection survival across an update.
- Freeze on interaction, and no dropped events on resume.
- Verdict legibility asserted against the **token value** rather than a string.
- The fallback path actually rendering verbatim for a malformed shape name.

## Proving the gate refuses

```bash
cd packages/interaction-conformance
bun run prove-refusal
```

Every rule ships a `violating` and a `clean` fixture, and the suite asserts **exit 1
with the exact set of rule ids reported** on the violating one and **exit 0** on the
clean one. The exact-set assertion is load-bearing: asserting only `exit 1` would
let a fixture that trips a *different* rule count as proof of this one — a green
suite proving nothing.

The suite additionally pins the two P11 false-positive guards, the P12 allowlist,
the missing-`dist/` hard error, and all three exemption behaviours.

## Integration into a surface

```json
{
  "scripts": {
    "lint": "bun run lint:types && bun ../../packages/interaction-conformance/check.ts .",
    "check-interaction": "bun ../../packages/interaction-conformance/check.ts ."
  }
}
```

Run it **after** the build, so `dist/` exists and P12 is actually decided:

```json
{
  "scripts": {
    "verify": "bun run build && bun ../../packages/interaction-conformance/check.ts ."
  }
}
```

## The second reader

`rules.ts` is the single source. `check.ts` reads it to refuse; `emit-concepts.ts`
reads it to teach.

```bash
bun check.ts --emit-concepts > /tmp/interaction-concepts.json
```

emits class-grain concept payloads for concept-db, recalled into the code-authoring
prompt on the existing compose-lesson channel. The surface is substrate-editable, so
a pattern that only lives in this README would be re-violated by the first
substrate-authored change to it and the gate would just say no, repeatedly, without
teaching anything. One source, two readers — a rule cannot be enforced without also
being taught, or taught without being enforced.

Each payload carries its rule's `NOT COVERED` text **on purpose**: telling the
drafter a rule is only half-checked is more useful than implying the gate will catch
everything.

## Files

| File | Role |
|---|---|
| `check.ts` | Entry: arg parsing, file loading, exit codes |
| `rules.ts` | **The rule table** — id, slug, statement, tier, matcher, hint. Single source |
| `scan.ts` | File walk, length-preserving comment stripping, brace-depth region scanner |
| `exempt.ts` | Annotation parser, reason validation, `P0` findings |
| `report.ts` | Grouped stderr output and `--list` |
| `emit-concepts.ts` | `--emit-concepts`: rule table → concept-db payloads |
| `fixtures/` | A violating and a clean case per rule. Never scanned in ordinary use |
| `prove-refusal.ts` | Drives `check.ts` over every fixture in a scratch root |
