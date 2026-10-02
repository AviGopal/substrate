# Teaching the substrate to reach, from goals alone

`../../docs/assets/teaching-by-goals/teaching-by-goals.mp4` — 16m20s, 1280×800, recorded through
the real human surface at `:18310`. Every act is a goal typed into the box. No file is edited by
hand at any point, including by the operator.

## What is on screen

| act | goal (typed live) | outcome |
|---|---|---|
| BEFORE | "How plentiful are the vessels in the registry right now?" | not reached |
| TEACH | one goal carrying the exact line to replace and the exact line to replace it with | **REACHED — landed on the first attempt** |
| — | poll `substrate-pull-sync` until the change is genuinely in `/vessels`, restart goal-host | `mirrored=true` |
| AFTER | "How plentiful are the shapes the registry advertises?" | not reached — see below |

## The lesson the take exists to show: ANCHOR, DO NOT DESCRIBE

Every earlier attempt DESCRIBED the edit — "extend the counting-trigger alternation" — and left
the drafter to find the site. `registry-field.ts` holds TWO regexes: the counting-trigger
alternation in `counted`, and the canonical field-name list (`totalshapes|totalvessels|
healthycount`) in `named`. The drafter edited the wrong one roughly two attempts in three, even
when the spec named `counted` explicitly and said to leave `named` alone. Three consecutive
takes were lost that way.

Handing it the VERBATIM line to replace and the VERBATIM line to replace it with landed first
try, twice running. A drafter given text it can match cannot pick the wrong site.

    described  ->  ~1 attempt in 3 lands
    anchored   ->  first attempt, both times

The harness builds that anchor from the LIVE FILE at runtime rather than hardcoding it, and
verifies the string occurs exactly once before using it.

## What the AFTER act honestly shows

The dispatch says not reached. The walk log says the teaching worked:

    walk: DETERMINISTIC registry-count command for "shellResult"
          (field=totalShapes, chosen by the same rule the verifier applies)

The newly-taught phrase was recognised and the correct field selected. The dispatch was graded
down because the walk ALSO ran a web search and the judge found the combined output
unsynthesised. Same pattern on two other taught phrases; meanwhile 'What quantity of vessels is
discovery tracking?' (19), 'How much vessels does the registry list as healthy?' (healthyCount=19,
alpha+2) and 'What sum of vessels is discovery tracking?' (18) all reached cleanly.

So: the taught rule fires reliably, the end-to-end verdict does not. Filed as
`gap-taught-route-fires-but-selection-is-noisy` — it matters because a capability can be
correctly taught, correctly installed, and still not register as a reach, which both starves the
learning signal for the taught path and would tell an operator watching only `reached` that the
teaching had failed.

## Six capabilities taught by goal alone, 2026-08-18

| commit | taught | verified afterwards |
|---|---|---|
| `743a258` | `quantity of` | "What quantity of vessels is discovery tracking?" → reached, 19 |
| `96ea4fa0` | `how much` | "How much vessels does the registry list as healthy?" → reached, healthyCount=19, alpha+2 |
| `0804f9c1` | `how numerous` | rule fires; selection noisy |
| `16670817` | `sum of` | "What sum of vessels is discovery tracking?" → reached, 18 |
| `9192c0f6` | `headcount of` | landed first try from a verbatim anchor |
| (this take) | `how plentiful` | landed first try, on camera |

The alternation in `repos/goal-host-vessel/src/registry-field.ts` grew from four alternatives to
ten across the session, and that file was never hand-edited:

    how many|number of|total
      → how many|number of|total|count of|quantity of|how much|how numerous|sum of|headcount of|how plentiful

## Two things the take depends on that were broken and are now fixed

- **The answer was never sent to the surface.** `GET /executions/:dispatchId` built its JSON key
  by key and never named `answerBody`, so a reached run rendered a green badge with the answer
  sitting undelivered in the record (goal-host `36f5390`).
- **Grounding was served by a foreign substrate.** Compose refused every teach with "grounding
  window (0 bytes) contains none of the target file(s)" — naming the FILE, so it read as a
  missing file. The reads were answered by `local-tools-vessel@…@spoke-739b76f1`, a machine that
  is neither this workstation nor the hub and does not have our repository
  (development-vessel `a8fa348`). A peer answering with plausible content instead of nothing
  would have had the drafter patch a stranger's files.

## Reproducing

Ground truth comes from `:18100/registry/stats` before each dispatch. A landed commit is NOT live
code — Bun does not hot-reload — so the harness polls until the new alternative is actually
present in `/vessels`, then restarts goal-host, then asks the AFTER question. An earlier take
failed its AFTER act purely because it waited on a duration instead of that condition.
