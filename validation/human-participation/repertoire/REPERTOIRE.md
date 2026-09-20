# Presentation repertoire — versioned baseline

Stage-3 deliverable: the initial candidate the system will learn to select and
improve. Versions are directories; a version is never edited after it is recorded —
improvements become v2+ with parentage. This entire baseline is an **attributable
human design contribution** (operator-authored); when the substrate later selects or
mutates it, credit for the starting point stays here.

## v1 — identity

| Field | Value |
|---|---|
| Content + renderer source | human-surface-vessel at super-repo `36b9ffae` (UI bundle `ui/dist/assets/index-Dp37Wg-Y.js`, `index-kAJOOTzY.css`) |
| Recorded | 2026-09-20, after stage-1 audit and stage-2 scenario freeze |
| Executable examples | `repos/human-surface-vessel/test/participation.test.ts` (isolated shape→adapter→shape suite) and `test/browser-participation.ts` (real Chromium probe) |
| Probe run evidence | PASS on 2026-09-19 22:0x PDT: structured answer, duplicate retry, stale-revision rejection, preserved draft, revised answer, reload, buffered arrivals, drafts retained across selection, keyboard, narrow viewport, dark theme, no JS errors |
| Probe recipe | `PLAYWRIGHT_MODULE=<playwright-core> CHROMIUM_EXECUTABLE=<chrome> bun run test/browser-participation.ts` — disposable Hono fixture, no live services |
| Screenshots | `docs/assets/human-participation-repertoire/v1/substrate-participation-{desktop,mobile,dark}.png` (binaries live under docs/assets per the placement hook) |

## Design rationale (why these arrangements support these activities)

**Region order encodes the encounter priority.** The first viewport is Ask ("What do
you want done?") then Questions-for-you: a person who arrives can either begin
(express an intention in their own words — law 13: the system owns decomposition) or
contribute (the system's open requests are surfaced immediately with a count and the
one-line reason "Bring context, evidence, or a different perspective to work in
progress"). Inspect (Runs → Detail) follows, because outcomes matter once something
exists to inspect.

**Question list and detail are side-by-side (wide).** Selecting among several open
questions while drafting is the S7 concurrency case; the master list keeps sibling
state ("Response recorded" / "Awaiting your input") visible while the detail pane
holds the draft. On narrow screens the list stacks above the detail — the current
activity concentrates, context remains one scroll away.

**Receipts tell the truth about the cycle.** After sending: "Your contribution is
recorded. The requesting activity can read it. Whether it has used it is not yet
known." This is deliberate: the stage-1 audit shows consumption is the severed link,
and a receipt claiming more would be a fabricated consequence. The delivery receipt
is expandable, not modal — verification is available without interrupting.

**Structured content is preserved, not interpreted.** The JSON contribution format
states "It is stored as supplied"; original question bodies render as key-value
pairs with the original available — unfamiliar content (S4) must survive the
renderer's ignorance.

**Verdict-first runs.** The runs board explains itself: "verdict first — reached or
not reached, never a status," and "A verdict here is what the walk recorded — open a
run to see what it actually produced." This encodes the reached-vs-status law for
humans, which S3 tests.

**The interface indicts itself in-place.** "Known wrong with this interface" merges
the substrate's own legibility findings with human complaints "so agreement and
disagreement between them are visible" — and its empty state distinguishes "detector
never ran" from "detector found nothing" ("this view cannot tell them apart" —
honest about its own observation limit).

**Revision discipline is visible.** New question versions never replace the text a
person is reading; "Review updates" is an explicit act; a stale answer is rejected
with the revision explanation (probe-verified).

## Interaction commitments (behavioral, probe-enforced)

Drafts survive selection changes and unrelated arrivals; identical resends return
the same receipt (journal shows one record); declining produces a distinct record;
keyboard focus order covers the contribution flow; dark theme and narrow viewport
render without loss; page errors fail the probe.

## Pre-registered expectation for the first scored run

On v1, scenarios **S1 and S5 are expected to fail at the presentation transition**:
their fixtures are `kind:"gap_needs_human"` panels, which v1's `uiQuestion` read
drops (filed gap `human-surface-uiquestion-read-drops-gap-needs-human-panels`).
A zero-render there is the predicted baseline score, not an anomaly. That gap's
closure is falsified by exactly these scenarios becoming runnable: seed the S1/S5
fixtures, and the panels must appear in `/api/questions`. S2/S4/S7/S8 fixtures are
`kind:"question"` and are expected to render.

## Known deficiencies carried into v1 (recorded, not hidden)

- **Escalations invisible**: the `uiQuestion` read drops `kind:gap_needs_human`
  panels — the substrate's primary invitation. Filed:
  `human-surface-uiquestion-read-drops-gap-needs-human-panels`. See the
  pre-registered expectation above.
- **Contributions unconsumable**: journal record format unreadable by both existing
  interactor-log consumers; the only uiQuestion consumer points at another vessel.
  Filed: `human-surface-participation-journal-records-unreadable-by-interactor-log-consumers`,
  `solicitation-outcome-scan-pins-one-ui-endpoint-instead-of-discovery`.
- First-viewport "relevant current work" is an empty runs board on a fresh surface;
  purpose communication relies on region copy rather than any oriented overview.
- Legacy interaction-conformance findings on the wider surface remain open; this
  repertoire versions the participation region's behavior, not a resolution of those.
- Unsent drafts do not survive page reload (documented contract, candidate for a v2).
- No accessibility conformance claim; the probe checks keyboard reach, not AT
  semantics.
- **Probe coverage limit (named, per the silent-skip law):** the passing run and
  screenshots exercise the probe's synthetic question, not the frozen fixtures;
  zoom, long material, and interrupted connections are unexercised in v1.

## v2 — one-page workbench (parent: v1)

| Field | Value |
|---|---|
| Source | super-repo `81f6394c`; bundle `index-DS9tAhiP.js` / `index-B0FxNuir.css` |
| Author | Operator (human design contribution; substrate did not select or author it) |
| What changed / target scenarios | At ≥1000px the surface is a single 100dvh grid — intent bar, questions+active detail (left), runs+run evidence (right), known-wrong strip (capped) — and only regions scroll, never the page. Targets S1 (orientation without navigation), S3 (verdict beside evidence), S7 (list and draft visible together). Below 1000px, v1's stacked narrow behavior is unchanged. |
| Probe evidence | `test/one-page-probe.ts` PASS: zero page scroll at 1440×900, 1280×800, and their 125 %-zoom-equivalent viewports; all five region headings inside the viewport; long material overflows its own region (assertion non-vacuous); no JS errors. Behavioral probe + 20-test shape suite still pass. Dark scheme verified by computed color (`#161b1e` panels on `#0e1214`). |
| Screenshots | `docs/assets/human-participation-repertoire/v2/substrate-onepage-1440{,-dark}.png` |
| Design rationale | The one-page constraint is itself an expectation: everything a person needs to begin, decide, inspect, and complain is co-present; scrolling is demoted to within-region reading. The Ask region compresses to an entry bar because an empty text box does not deserve a quarter of the viewport. |

## Versioning rules

A new version records: parent version, what changed and the scenario(s) it targets
(from `../SCENARIOS.md`), its own probe run + screenshots, and who authored it
(operator, substrate activity id, or mixed — attribution per stage-9). Selection
between versions must eventually be a substrate decision with recorded assignment
(stage 5); until then, whichever version a session used is recorded manually in the
run log. v1 remains available for recovery permanently.
