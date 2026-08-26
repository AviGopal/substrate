# Feed the consequence verdict back into credit

## Why

Credit is assigned along the **structural** axis (composition-chain depth, `0.7^d` to
depth 4) at **reach time**, by a fallible oracle. But correctness is only decided along
the **temporal** axis — did the change *stay*, get *exercised*, and *not recur* — hours
to days later. Today nothing carries the temporal verdict back to the reward, so a
pathway that reached but produced an **inert or reverted** change banks full chain-credit
and keeps it. Measured this session:

- `4eedb4de` — a confabulated blob (external URL, never consumed) that scored structural-
  CORRECT and is durable; its pathway kept its reach-time α.
- `registryFieldFor` — the same small function rewritten **8×** (a keyed treadmill); every
  landing re-banked credit at reach time though the gap-class never went away.

The reach oracle grading surface-plausibility is the root cause of undifferentiated
posteriors (the audit's "signal smeared/starved"); this proposal closes the loop the
oracle can't: **let what actually happened correct what the oracle guessed.**

## Intent (advisor-confirmed) — the pipes exist; this is the reader

Reward is **revisable**, and the delivery plumbing is already built and verified:

- α/β write **late** at POST/reach — arbitrary execution→grade delay is already tolerated.
- The reach-verdict **spool** (`ea78fd7`) already persists delayed verdicts.
- Verdicts key on **execution_id**; substrate-authored commits carry dispatch identity
  (`a885631`'s subject names `route-edit-f79ac530`), so a verdict days later attaches to
  the exact execution and its chain.
- `goal_verification_labels` is the **designed intake** for independent/late verdicts —
  and it is currently **unread**. That unread corpus *is* the missing bridge.
- Reward is already **graded** (`α += y, β += 1 − y`), so a consequence-revised yield is
  native, not a bolt-on.

The **writer** half (a small detector activity emitting keyed verdict impulses) is filed
as a dispatchable gap — `consequence-verdict-writer-missing-for-goal-verification-labels`
— substrate-landable now (small new file, same class as the `config.ts` landing this
session). **This openspec is the reader half**, which lives in `posterior-update.ts` /
`impulses.ts` (large, compose-keystone-gated), and it exists chiefly to settle one
decision that must not be guessed.

## What changes

1. A reader in the credit path consumes `goal_verification_label` impulses keyed by
   `execution_id` and applies a correction through the **existing** cascade
   (`propagateCreditAlongChain`) with its normal decay/abstention discipline — no second
   credit system along the temporal axis (that would repeat the operator-load-bearing
   anti-pattern; the cascade is a carrier, not the problem).

2. The correction obeys four hard constraints:
   - **Keyed, never heuristic** — attaches to an `execution_id`/commit or does not write
     (fuzzy-similarity recurrence is the effect-as-cause trap, law 12).
   - **Asymmetric caution** — only *reverts* and *keyed recurrence* are confident
     negatives; *not-yet-exercised* is absence of evidence and **abstains** (false
     rejection worse than false reach).
   - **No double-count** — see the open decision below.
   - **Internal and shaped** (laws 1/2) — the verdict is a shaped impulse graded by the
     loop like anything else; the operator's `self-dev-reliability.mjs` remains the
     external probe half only.

## Open decision (this openspec must settle it — do NOT anchor it in code first)

Precedent: `decision_outcome → /decision-calibration` was deliberately kept **read-only
because folding it into credit double-counts** (`03e6c55`). The same hazard applies here.
Two admissible designs:

- **A. Supersede** — the verdict issues a *correcting delta on the same execution*: reverse
  the reach-time α that was banked (re-propagated along the same chain with the same
  `0.7^d` decay and the same exclusion set) and apply the temporal grade instead.
  *Pro:* actually corrects the offending pathway's posterior — the treadmill/confabulation
  pathway loses the credit it should never have kept. *Con:* must reverse an
  already-propagated cascade exactly (same keys, same decay, same sibling divisor), which
  is the harder implementation.
- **B. Distinct** — grade a *separate consequence-check event* with its own `execution_id`
  and posterior. *Pro:* simple, additive, no cascade reversal. *Con:* it learns
  "consequence-checks pass/fail," **not** "this pathway is good/bad" — the original
  reached-but-reverted pathway keeps its inflated α, so the core mismatch is not fixed.

**Recommendation (not a decision): A (supersede).** B is cheaper but does not correct the
pathway that is the whole point; only A makes plausible-not-correct executions actually
*cost* the pathway. The decision is deferred to implementation-with-evidence per law 12
(record the intervention, change one thing) and is gated on the large-file-edit
capability (`2026-08-26-large-file-edit-capability`) so the substrate can land the reader
in `posterior-update.ts` itself rather than by operator hand.

## Non-goals

- Not a new external harness as a landing gate (operator-load-bearing anti-pattern).
- Not fuzzy/similarity-based recurrence detection (law 12).
- Not the writer activity (separate dispatchable gap, above).
