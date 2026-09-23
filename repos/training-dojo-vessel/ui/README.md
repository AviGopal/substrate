# Training Dojo

A fork of human-surface-vessel's UI (the "do-anything surface" this README
originally described) — same component contract and the rules table below,
different palette and a different page split. Four pages: **Lessons** (give
the agent a task in plain language and watch it land — the do-anything
premise below still holds here unchanged), **Trace/Log** (one lesson's full
walk: what was asked, what happened, every impulse it produced, the walk
log), **Tables** (the shared SurrealDB's tables/columns/row-counts, as of the
last periodic scan), and **Diff history** (an append-only log of what changed
between scans).

The premise inherited from human-surface-vessel: a do-anything box adds no
capability — it only changes what a person can find and what they can trust.
So the design work is not in the box; it is in the two failures the box makes
possible: a reader who cannot tell what the system can do, and a reader who
is shown a status where they were looking for an outcome. Tables/Diff-history
extend that premise to the substrate's own database: a reader who cannot tell
what an agent did to the shared schema is in exactly the same position.

## Building

There is no bun on the host. Build in the container, from the **super-repo root**
— the design-token package lives outside this directory and must be inside the
mount:

```sh
cd <super-repo root>
docker run --rm -u "$(id -u):$(id -g)" \
  -e HOME=/w/repos/training-dojo-vessel/ui/.container-home \
  -v "$PWD":/w -w /w/repos/training-dojo-vessel/ui \
  oven/bun:1 sh -c "bun install && bun run build"
```

`bun run build` is `tsc --noEmit && vite build`: the typecheck is part of the
build, so a type error fails the build rather than shipping.

## What it talks to

Everything goes through **this vessel's own proxy**, same-origin and relative.
Nothing in this bundle names a host. goal-host has no CORS and no inbound auth —
the server is the security boundary, it holds the API key, and the browser never
sees one.

| Route | Purpose |
|---|---|
| `POST /api/run-goal` | dispatch |
| `POST /api/resolve` | `goalWalkState`, `activeDispatches`, `solicitationResponse_write`, `poolImpulse_write` |
| `GET /api/discovery/shapes` | the live shape vocabulary, for starters |
| `POST /api/discovery/resolve` | `vesselCapability`, to confirm a shape has a producer |
| `POST /api/grade` | a human verdict into the oracle corpus |
| `GET /api/schema/latest` | the latest schema snapshot (`schemaSnapshot`, on activity-api) |
| `GET /api/schema/diffs` | recent schema diffs (`schemaSnapshotDiff`, on activity-api) |
| `POST /api/schema/scan-now` | an on-demand scan (`db_admin` `schema_snapshot`, on activity-api) |

The schema-watch routes discovery-route to activity-api's `db_admin` resolver
the same way `/api/gaps` discovery-routes to `substrateGap` — by shape,
through discovery, never a hardcoded activity-api address. That capability
may not exist on whatever the registry finds; those routes 404/502 honestly
rather than fabricating a snapshot until it does.

The next two rows are the ones to check against the server: `/api/discovery/shapes`
is an assumed name for the proxied keyless `GET {discovery}/registry/shapes`, and
`/api/grade` **must** be added — a human verdict is `goal_verification_label_write`
against activity-api, which is not a goal-host shape and cannot go through
`/api/resolve`. See the contract note in `src/api/client.ts`.

## The rules this code is built to

Each is enforced in one place so it cannot drift:

| Rule | Where |
|---|---|
| P1 verdict over status | `lib/runState.ts` derives every verdict; each component that reads `status` also reads `reached` and renders only the derived verdict. The one place `status` appears on screen is the de-emphasised machine-record line in DETAIL, which prints `reached` beside it |
| P2 insert, never dispatch | `components/StarterChips.tsx` — the dispatch mutation is not reachable from it |
| P3 buffer, don't splice | `components/RunsRegion.tsx` |
| P4 stable domain keys | every list keys on `dispatchId` or a shape name |
| P5 comparator with a unique tiebreaker | `lib/sort.ts` — one comparator, and it ends on the tiebreaker |
| P6 pause + interval | `state/liveControls.tsx`, rendered in both live regions |
| P7 MECE verdicts, no agree button | `components/GradeGesture.tsx`, options from the token package |
| P8 content before its length | `components/EvidenceLedger.tsx` |
| P9 dispatch on form, verbatim default | `components/ContentRender.tsx` |
| P10 accepted and stalled are real states | `lib/runState.ts`, `lib/useProgressWatch.ts` |
| P11 no colour literal | `src/styles.css` — every colour is a `--sf-*` token. This vessel's dojo palette lives in `src/dojo-tokens.css`, a second token source imported after the shared package's — `styles.css` itself still carries none |
| P12 no external host | no CDN, no webfont, no remote module; scan `dist/` to confirm |

And the standing omission: **no confidence percentage anywhere.** Planner
confidence in this system is uncalibrated — runs at confidence 0.0 outperform runs
at 0.9 — so a number would launder a known-bad signal into something that reads as
a measurement. The run contract shows a duration *band* and says where the band
came from.
