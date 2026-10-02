# The human surface stack — one vessel, first principles, validated against a design guide

**Vessel:** a new human-surface vessel, replacing stateful-ui-vessel and react-renderer
**Lever:** the fleet has three UI stacks, one of which runs. Replace the layer root-and-stem
with a single compliant vessel whose interaction contract is *mechanically checkable*, so a
UX starts at a place that feels good to use and cannot silently drift away from it.

## Problem

The UI layer is three implementations of the same idea, and the evidence says none of them
is load-bearing:

- **react-renderer** advertises deterministic `ui_component` resolution with Thompson-graded
  composition learning, and carries the right primitives — `shape-slot` with a provenance
  strip, `ImpulseRenderer`, `data-table`, `code`, `chart`, `graph`. It appears in **neither
  the inventory nor the manifest, and has no unit file.** It has never run. Its composition
  learning is declared, never walked — hollow by law 4.
- **workbench** is a React SPA pointed at activity-api. Also absent from inventory and
  manifest. Also never runs.
- **stateful-ui-vessel** is the only UI-role vessel that runs. It renders from a
  hand-written HTML string and **pulls React from esm.sh at runtime**, with no build step,
  keeping its own client-side shape→renderer registry.

So the fleet carries three shape→renderer registries, of which the live one depends on an
external CDN at request time — which cannot hold under location independence, and fails
closed in an air-gapped or offline deployment. Meanwhile Tailwind is forked across a major
version between repos, and there is no shared token package: design values are re-authored in
a Tailwind config, a `design-token` component, and a `:root` CSS block.

Underneath the duplication is the real gap: **there is no interaction contract anything can
be validated against.** The panel failures this system has already paid for — a board that
reflowed under a reader, a grade panel that refused the rows worth grading, a status field
read as an outcome, a receipt shown where content belonged — were each found by a human
noticing, after shipping. Nothing could have caught them earlier because nothing states them
in a form a check can read.

## Decision

Replace the surface layer root-and-stem with **one human-facing vessel**, designed from
first principles rather than by inheriting the three attempts. Retire react-renderer and
stateful-ui-vessel rather than migrating them.

This is cheap in exactly the way that matters: two of the three never ran, so almost no
earned posterior is discarded. The one that runs keeps its entire UI in a template literal.

## Behavior (expectations a reader can hold the system to)

**1. One surface vessel, fully compliant.** It advertises its shapes, registers with
discovery, agrees with its own dispatch switch, serves `/health`, and emits traces for every
state-changing gesture. It earns no private endpoints — a gesture that cannot be expressed
as a shaped impulse is a missing activity, and the activity is the gap to file.

**2. Nothing is fetched from outside the deployment at runtime.** No CDN, no external font,
no remote script. The vessel serves a built bundle from its own image. A surface that needs
the public internet to render is not location-independent.

**3. The interaction contract is a checkable artifact, not prose.** The canonical patterns
ship as a conformance package that fails a build, in the same shape as the existing
shape-dispatch checker — a shared implementation each vessel wires into its own `lint`, so
one checker keeps every surface honest.

**4. The design guide has a runtime reader.** The patterns are also carried as concepts the
drafter reads at prompt-build, so a substrate-authored change to the surface is written
*with* the contract rather than against it. A guide that only humans read teaches only the
person who opened it, and will drift the first time the system edits its own surface.

**5. Design values live in one place.** A shared token package is the single source for
color, type, spacing, and the semantic state palette. A surface that hardcodes a hex value
for a verdict state is not conformant.

**6. The open shape vocabulary renders by form.** The registry advertises hundreds of shapes
and the set is open by construction, so the surface dispatches on the form content takes —
prose, text, rows, diff, empty — and the verbatim fallback is the designed common case. Two
live shape names are prose sentences; a renderer keyed on shape names would have to decide
what they mean.

**7. Human-focused means the honest thing is also the easy thing.** Verdict before status,
content before receipt, a board that holds still, a verdict cheap to record. These are the
canonical patterns; they are enumerated in `design.md` §3 and each is checkable.

## Non-goals

- **Not a chain editor.** Composition remains the workbench contract's concern.
- **Not a replacement for the Obsidian surface.** That vessel holds a specific human's local
  information and a vault write boundary; it stays, and it consumes the same token package
  and the same pattern checker.
- **Not a new dispatch path.** Every action maps onto a goal-host route that exists.
- **Not a migration.** react-renderer and stateful-ui-vessel are retired, not ported.

## Shape contract

**Consumed** (all served today): `goalWalkState`, `activeDispatches` (goal-host-vessel);
`vesselCapability` (discovery-vessel); `execution_trace` (activity-api).

**Produced** (all served today): `goal_dispatch_async`, `poolImpulse_write`,
`solicitationResponse_write`, `solicitationHeartbeat_write` (goal-host-vessel).

**Producer sought before minting:** react-renderer produces `ui_component` and is the
existing producer for shape-keyed rendering — it was checked, and it is being retired rather
than composed with, because it has never run and its earned standing is nil. Its primitives
are the design input for the replacement. **No new shape is required and none is proposed.**

**Inherited, not re-minted:** `uiPanel_write`, `uiQuestion_write`, `uiFeedback`, and the
`interactor*` family are live shapes served by stateful-ui-vessel today. The replacement
vessel must serve them on day one or the substrate loses its ability to author a panel and
ask a question — retiring the vessel must not retire the vocabulary.

## What would falsify this

Not "the new surface renders." The observables:

1. A person who has never seen this system gets an outcome they can act on without typing a
   shape name, a template id, or a file path.
2. The conformance checker **fails a real violation** introduced deliberately — and has been
   proven to complete, not merely to exist. A gate with no demonstrated refusal is not a gate.
3. A substrate-authored edit to the surface is written in conformance with the patterns
   because the drafter read them, not because a human corrected it afterwards.
4. The built bundle makes zero requests to any host outside the deployment.
5. `react-renderer` and `stateful-ui-vessel` are gone from the tree, the inventory, the
   manifest, and the unit directory — not left dark.
