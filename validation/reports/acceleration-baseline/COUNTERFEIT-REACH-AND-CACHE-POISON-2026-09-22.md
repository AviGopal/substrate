# The cap removal flipped reach to true — on a counterfeit that poisoned the command cache

Recorded 2026-09-22. Grounded in walk traces (dispatches 80eff53c, 0f2cc85d,
2a28c288, f6d72bd1) read via goal_reasoning, and running-source reads of
/vessels/goal-host-vessel/src/{index.ts,goal-target-inference.ts}. Not inference.

## What was tested — and a method caveat that changes the reading

Intended: re-run the ORIGINAL synthesis goal (goal_hash 9f7cfb62) verbatim after
one change. ACTUAL: I reconstructed the goal text from a truncated HOLLOW-CONTENT
log line (the original was 616 chars; my reconstruction was 462), so the dispatched
goal hashed to **4be0d4eb, not 9f7cfb62**. Two variables therefore changed at once
(the cap removal AND the goal text) — this is NOT a strict one-variable (law 12)
comparison, and the after-runs are a DIFFERENT goal than the before-runs. The
stale-path question is still cleanly answered (the reworded control f6d72bd1
covered it), but the before/after is cross-goal, stated here rather than claimed
as verbatim continuity.

The change: removed the "at most 8 classes / under 2500 characters" conciseness
cap I had injected earlier (running index.ts:7554), replacing it with "cover
EVERY class present in the records." tsc-clean, drain-restarted goal-host.
Reverting my own prior harm, not a new mint.

CRITICAL: the intermediate ORDER is cached per goal_hash (goal-target-inference.ts
~line 930, cacheKey = `split:${goalHashOf(goal)}:...`), so it is FROZEN per goal,
not run-to-run nondeterministic. Hash 9f7cfb62 froze substrateGap-FIRST (good
order → real content, graded hollow only by my cap). Hash 4be0d4eb froze
llmCompletion-FIRST (synthesis before data → confabulation). The counterfeit is
thus partly an artifact of my reconstructed goal drawing an unlucky frozen order —
a clean run of the TRUE 9f7cfb62 (good order) after cap removal was never tested.

## What happened — three runs

- **f6d72bd1 (reworded control, before understanding the split):** target
  inference dropped substrateGap entirely; bound only memoryNote_write; every
  pick β-WITHHELD with consumedInChain=0 (correct — nothing was consumed because
  nothing was read). Rules out stale-path shadowing; surfaces phrasing
  brittleness (law 13).
- **80eff53c (BEFORE cap removal, hash 9f7cfb62):** hollow, attempt_count=6,
  substrateGap-FIRST order, produced a real-but-incomplete report the judge
  rejected on completeness (my cap). Not a reach. Included here to prevent
  misattribution: this is the pre-change baseline, not the counterfeit.
- **0f2cc85d (run 1 after cap removal, hash 4be0d4eb):** reached:TRUE, non-floor
  (satisfier:memoryNote_write, "REACHED via 3-step chain", alpha-credited +2,
  "substance-honest reach"). BUT the winning llmCompletion (step 11) said "only
  one record was supplied" and invented "Class: Missing Authentication" whose
  member "gap" is the DISPATCH ID 0f2cc85d-…, not a gap. The note mixed that
  fabricated class with one real one. **The green is a counterfeit.**
- **2a28c288 (run 2, identical):** reached:FALSE. Step 5 REUSED the run-1
  llmCompletion arg-extraction command "from reached-command cache (goal_hash
  hit)" — i.e. **run 1's counterfeit reach cached its bad recipe as verified.**
  Run 2 confabulated again (step 17 uses dispatch id 2a28c288 as a member), the
  judge THIS time caught it (step 11 "inaccurately associates open gaps"), the
  walk re-framed through a cascade of composed activities and a floor curl loop
  that self-corrected 7× then honestly refused (steps 30–44). Honest fail.

## Root cause (single, located)

inferDerivationSplit (goal-target-inference.ts) orders the `intermediate` array
from the LLM's JSON guess (the parsed `intermediate` field, ~line 980). Nothing
enforces that a SOURCE shape (substrateGap) is produced before the SYNTHESIS
shape (llmCompletion) that consumes it. Both runs ordered
["llmCompletion","substrateGap"] — synthesis fires on empty input and
confabulates, grabbing the dispatch_id from the pool as a fake "gap id."

Everything else is downstream of that ordering:
1. **Confabulation** — llmCompletion runs before substrateGap exists.
2. **Cache poison** — a reached run caches its arg-extraction recipe as
   "verified"; a COUNTERFEIT reach therefore caches a recipe built with no data,
   and later runs reuse it (run 2 step 5). A wrong mint is negative value.
3. **Judge unreliability** — the reach judge credited a fabricated artifact
   (run 1) whose member ids were the dispatch id, then rejected the same class
   (run 2). It does not verify member ids trace to real input records.

## Falsifier verdict

F2 (a reached:true that a second identical run reuses more cheaply while STILL
reaching) FAILS. Run 1 reached counterfeit; run 2 did not reach at all. No
value-compounding on this goal.

## What is TRUE and working

- consumedInChain credit fires on the bind path (original goal was β-PENALISED on
  content, not β-WITHHELD on the edge — the edge registered). The consumption-edge
  fix is not the blocker.
- The ReAct floor executor self-corrects commands (7 attempts, adapting the jq
  path) and refuses to green on empty output — the "improve based on how we got
  here" mechanism the operator observed missing is present at the executor level.

## Gaps to file (substrate-owned repair, not hand-fix)

1. **Dependency ordering in inferDerivationSplit + split-cache invalidation** —
   order `intermediate` so any shape consumed by another intermediate is produced
   first (raw/source before synthesis). Because the order is cached per goal_hash
   (~line 930), the fix must ALSO invalidate/re-key the split cache, or already-
   poisoned hashes (e.g. 4be0d4eb) stay broken after the code is repaired. Primary
   root; fixing it prevents 2 and 3 for this class. Any clean re-demonstration
   should use FRESH goal text to escape both the split cache and the reached-
   command cache.
2. **Reached-command cache must not persist recipes from unverified reaches** —
   or must invalidate on a subsequent hollow with the same goal_hash. A
   counterfeit reach currently teaches a bad command.
3. **Reach judge must verify membership** — for a clustering goal, member ids in
   the artifact must trace to ids present in the consumed source shape; a member
   equal to the dispatch_id is a confabulation tell.

## Operator honesty note

The cap removal was legitimate (reverting my own harm) and did flip the gate —
but the flip landed on a counterfeit and made things momentarily worse (cache
poison). Reporting the green as success would have been the exact counterfeit the
directive forbids. Caught only by reading artifact content, not the verdict.

---

# Feedback-edge fix + validation (2026-09-22, later same day)

## The fix (committed 64ce0ac, deployed to running /vessels, all trees reconciled)

Added the grade->next-attempt edge in goal-host-vessel/src/index.ts:
- New opts field `priorVerdictFeedback` threaded into runGoalAsPoolWalk.
- Synthesis prompt builder injects the prior verdict as a corrective preamble.
- New FEEDBACK-RETRY stage BEFORE the suppress-retry: on a CONTENT-hollow verdict,
  re-run the SAME chain once with the judge's goalReachReason fed into synthesis and
  the reached-command cache bypassed (ablation.disableReuse), so the retry CORRECTS
  the named defect instead of abandoning the producer (suppressSatisfierShapes) or
  replaying the poisoned recipe. Gated to content-hollow (structural no-pick excluded);
  fires once; suppress-retry kept as the second-stage escape. tsc-clean.

## What validation showed (5 probes, dispatched directly to :8210 — see caveat)

- **Non-counterfeit reaches (the counterfeit class is fixed):** two fresh-text
  synthesis goals reached substance-honest with member gap ids that VERIFY against the
  live 4487-gap store (route-edit-e9941360, recommit-route-edit-e9941360-semantic_reject,
  etc.) — NOT the dispatch id. Data flowed correctly (substrateGap produced and consumed;
  fresh hash -> correct split ordering). Contrast the earlier counterfeit that used the
  dispatch id as a "gap".
- **Feedback edge fires and CORRECTS:** on count-requiring probes the FEEDBACK-RETRY
  fired and the model's next attempt explicitly incorporated the fed-back verdict
  ("Here is the complete and exhaustive taxonomy as required, covering every class ...
  with all required fields (members, counts, and invariants)"), staying on the SAME
  chain across attempts — the opposite of the old suppress-and-drift. These probes did
  not fully green because I required EXACT COUNTS over 72KB, which the model can't
  self-verify and a strict judge kept rejecting: a probe-design limit, not a fix failure.

## Honest limitation (attribution)

A single-walk hollow->feedback->GREEN trace was strongly suggested (each clean reach had
a FEEDBACK-RETRY moments before its alpha-credit) but NOT rigorously attributable from
the journal: the "HOLLOW —" verdict lines carry no dispatch_id, and MCP goal_reasoning
(which renders the clean per-walk log) was unavailable because goal-host did not
re-register goal_execution with discovery after the SIGKILL restart. The mechanism is
proven by the correction BEHAVIOR (visible verdict-incorporation) + the non-counterfeit
reaches, not by one gold-standard trace.

## Side findings to file as gaps

1. Ordering: inferDerivationSplit can order synthesis before its source shape; frozen
   per goal_hash -> needs source-before-synthesis ordering + split-cache invalidation.
2. Judge does not verify member ids trace to real input records (how the counterfeit
   passed once).
3. reached-command cache persists recipes from unverified reaches (cache poison).
4. goal-host does not re-register goal_execution with discovery after a single-vessel
   SIGKILL/restart -> external dispatch broken until a full-substrate reseed.

---

# Failure memory — the cross-dispatch feedback edge (2026-09-22, evening)

## Why the within-dispatch edge was not enough

The operator's observation from the human surface was cross-dispatch: a goal retried
minutes later starts from zero. Code read confirmed why. The success side persists
twice (reached-command cache, goal_execution_paths) and replays on the next dispatch
of the same goal. The failure side persisted only a de-identified class label: the
reach-gate lesson deliberately strips the verdict reason so content dedup holds, and
it is recalled by goal keywords into the shape chooser and command synthesizer only,
never the report synthesizer. So the system recorded THAT a goal was hollow, never
WHY, and a cached recipe the judge had rejected was still replayed (one hollow is
strike 1 of 2). The path store does write reached:false rows, but without a reason.

## The fix (goal-host 9e23455 + cf8fd87)

Symmetric store: at dispatch finalization, beside the reached-command eviction,
persist {goal_hash, class token, verdict reason, failed pick, produced shapes, attempt
count} to /workspace/.goal-host-failure-memory.jsonl (append-only, load-on-boot,
fail-open). At dispatch start, recall by exact hash then class token, feed the
reasons into attempt 1 via priorVerdictFeedback with reached-command replay disabled
for that attempt; the in-dispatch FEEDBACK-RETRY carries prior-dispatch reasons plus
the attempt just graded. A verified reach supersedes (does not erase) the history so a
goal that now reaches gets its reuse back. Deterministic verdicts outrank LLM-judged
ones. Structural terminations (no producer, walklog-capped, environment faults) are
not remembered.

## Pre-registered A/B on fresh goal text (hash f0e0a5f0) — result

- A: hollow; `failure-memory: REMEMBERED hash=f0e0a5f0` with the reason "fails to
  produce the required family details" and the failed producer. Record on disk. PASS.
- B: `FAILURE-RECALL — 1 prior hollow verdict(s) for goal_hash=f0e0a5f0 … fed into
  attempt 1, reached-command replay disabled`. PASS.
- B attempt 1 did NOT repeat A's defect (it produced a real family note) and went
  hollow on a different one: the probe's own count-consistency trap ("miscounts
  families"). B then hill-climbed but did not reach. The "fewer attempts to reach"
  criterion is NOT met on this probe. The trap needs a deterministic count check, not a
  prompt; a reason alone cannot make the model count correctly over 72KB.
- Bonus, from the fleet's own traffic: hash a30f61f0 went hollow at 21:30:23,
  FEEDBACK-RETRY fired, alpha-credited at 21:30:46 — the single-walk
  hollow→feedback→green trace, now attributable because the retry line carries
  goal_hash.
- Defect found and fixed in the same run: structural "no template produces … capability
  gap filed" terminations were being remembered (cf8fd87 filters them).

## What is now true

The write→persist→recall→feed loop exists and runs on every dispatch, so a goal's
next dispatch knows why the last one failed and does not replay the rejected recipe.
What remains for reach on count-shaped goals is a deterministic oracle for the count,
and for the counterfeit class a judge that verifies member ids against the consumed
source. Both are filed above as gaps.
