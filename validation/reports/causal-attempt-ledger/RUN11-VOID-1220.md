# Graded run 11 (attempt 1): VOID, stopped at 12:33Z 09-25 before grading

## Cause: an autonomous goal-host landing inside the announced window broke edit routing
- 12:05:50Z: the substrate landed goal-host `8c31cdb` ("walk-posts-a-named-shape-pointer-to-the-executor-satisfiers-producer-…"),
  a 52-line block in `src/index.ts` that replaces `globalThis.fetch`. Every POST to a URL ending in `/resolve` is first sent to
  discovery as `{pointer:{type}, body}`, with every other pointer field dropped, and when discovery answers ok that answer
  replaces the real call. goal-host restarted onto it at 12:09:06Z. Run 11's pre-check passed it: the process had started after its
  source, and a clean check can't judge behaviour.
- Effects seen during run 11: the EARLY EDIT-INTENT discovery lookup for feature_compose lost its `shape`, so the pick had no
  endpoint (no "producer resolved via discovery" line; run 10 logged one). Each R dispatch reached development-vessel as an empty
  pointer: `[feature_compose] REFUSED before slot claim … Keys offered: []` (12:28:43, 12:30:56). R: 3 tries, no landing.
- Stopped deliberately: no edit goal could land through goal-host while 8c31cdb ran.

## Pass count
Run 10 passed. Whether a void run 11 breaks "consecutive" is the user's call. Neither the ledger nor the harness failed; the
graded system was changed under the run by an unannounced autonomous landing. The conservative reading restarts at run 10.

## Repair
The revert is dispatched as a traced development-vessel feature_compose, called directly because goal-host's own routing is
broken. Spec: `src/index.ts` must equal `60833b4:src/index.ts`. Verify: `git diff 60833b4 -- src/index.ts` empty, runtime equals
the clone, a feature_compose call arrives with non-empty keys.

## Gaps
- A landing gate passed a process-global `fetch` monkey-patch; nothing checks new code for process-global side effects (the
  coordinator is filing it).
- Autonomous landings on a graded vessel inside an announced window (class #56; the coordinator's held window-lease gap).
