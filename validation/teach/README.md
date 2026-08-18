# Teaching the substrate to reach, from goals alone

`../../docs/assets/teaching-by-goals/teaching-by-goals.mp4` — 15m46s, 1280×800, recorded through
the real human surface at `:18310`. Every act is a goal typed into the box. No file is edited by
hand at any point, including by the operator.

## What the take shows, and what it does not

| act | goal (typed live) | outcome |
|---|---|---|
| BEFORE | "Give the headcount of vessels discovery is tracking." | not reached |
| TEACH ×3 | three differently-worded goals asking for one line of `registry-field.ts` | all three REJECTED |
| AFTER | "What headcount of vessels does the registry report as healthy?" | not reached |

**THE TEACHING DOES NOT SUCCEED IN THIS TAKE.** That is the honest result and it is not hidden
here. What the take does show is three bad patches being stopped by three DIFFERENT gates:

1. `verify failed` — the draft did not typecheck.
2. `landed 9a77a461 but the requested symbol is NOT observably present` — the commit LANDED and
   the change was not in it. An inert autonomous commit, caught and graded not-reached. This is
   a defect class that used to pass green.
3. `apply_failed — old_string not found in file` — the anchor did not exist.

Three attempts, three refusals, zero wrong patches accepted. The machinery is doing its job; the
drafter cannot reliably make this edit.

## The teaching loop does work — evidence outside this take

Four capabilities were taught on 2026-08-18 by goal alone, each landing a substrate-authored
commit on origin/dev with no operator hands:

| commit | taught | verified afterwards |
|---|---|---|
| `743a258` | `quantity of` | "What quantity of vessels is discovery tracking?" → reached, 19 |
| `96ea4fa0` | `how much` | "How much vessels does the registry list as healthy?" → reached, healthyCount=19, alpha+2 |
| `0804f9c1` | `how numerous` | landed; live in tree |
| `16670817` | `sum of` | landed; live in tree |

The counting-trigger alternation in `repos/goal-host-vessel/src/registry-field.ts` grew from four
alternatives to eight over the session without that file being hand-edited once:

    how many|number of|total  →  how many|number of|total|count of|quantity of|how much|how numerous|sum of

## Why it takes several attempts, and why that is filed rather than papered over

The drafter confuses the TWO regexes in this file — the counting-trigger alternation held in
`counted`, and the canonical field-name list (`totalshapes|totalvessels|healthycount`) held in
`named`. It edited the wrong one repeatedly, including with specs that name `counted` explicitly
and say to leave `named` alone. Measured rate across the session: roughly one attempt in three
lands. Filed as `gap-drafter-one-line-regex-edit-flaky`, with the observation that a file whose
two regexes are easy to confuse is information the drafter should receive at prompt-build time
(law 8) rather than something every spec has to re-explain — and that an operator writing
defensively ("do not add a second declaration") is law 13 inverted: the rewriting IS the gap.

## Two things the take depends on that were broken and are now fixed

- **The answer used to be invisible.** `GET /executions/:dispatchId` built its JSON key by key
  and never named `answerBody`, so a reached run rendered a green badge with the answer sitting
  undelivered in the record (goal-host `36f5390`).
- **Grounding was served by a foreign substrate.** `feature_compose` refused every teach with
  "grounding window (0 bytes) contains none of the target file(s)" — naming the FILE, so it read
  as a missing file. The reads were being answered by `local-tools-vessel@…@spoke-739b76f1`, a
  machine that is neither this workstation nor the hub and does not have our repository
  (development-vessel `a8fa348`). A peer answering with plausible content instead of nothing
  would have had the drafter patch a stranger's files.

## Reproducing

Ground truth is captured before each dispatch from `:18100/registry/stats`. A landed commit is
NOT live code — Bun does not hot-reload — so the harness polls `substrate-pull-sync` until the
new alternative is actually present in `/vessels`, then restarts goal-host, then asks the AFTER
question. An earlier take failed its AFTER act purely because it waited on a duration instead of
that condition.
