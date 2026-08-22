# Which changes move the needle — re-evaluated against live traffic

Companion to `SEAM_CLOSURE_2026-08-22.md`. That report records what was repaired. This one
records **what the repairs actually did**, and what follows from measuring that.

The short version: **three of the four fixes deployed in the previous rounds are inert**,
and measuring *why* found a defect wider than all of them combined.

---

## 1. Re-evaluation — the confirmation queries, run

Stated in advance: *"If any stays flat, the fix is inert and that is the next
investigation."* All three stayed flat.

| fix | confirmation | result |
|---|---|---|
| blame attribution | `execution_error` rows carrying a `reason` | **0 of 96** since deploy |
| `correlation_id` | goal-host executions carrying a `correlation:` tag | **0 of 96** |
| decay 3→30d | post-deploy draws with `β > 1` | **0 of 358** |

The code is genuinely running — activity-api restarted 16:50:45 with the 30-day constant
on disk, goal-host 16:51:28 with the correlation threading, and all six consumers carry
`describeUnknownFailure` in their private `@avigopal/ias-executor-ts` copies. This is not
a propagation failure. **The fixes are live and the traffic does not go through them.**

## 2. Why — the traffic is not what the learning loop governs

Composition of one post-deploy window, 387 executions:

| activity | n | share |
|---|---|---|
| `development-vessel:gap-to-scenario-bridge-tick` | 113 | 29% |
| `development-vessel:detect-*` (detectors) | 97 | 25% |
| `validator-dispatch` | 68 | 18% |
| `docs-mgmt:docs-decision-solicit` | 15 | |
| `slot-binding` | 14 | |
| `auth_resolve_v1` | 18 | 4.7% |

**~95% is boredom-pool housekeeping.** Every fix in the previous rounds targets the
goal-walk path: `recommendExcluding` → Thompson draw → `/recommend`. The pool bypasses all
of it — boredom picks a `targetTemplateId` directly (`boredom index.ts:589`, *"bypasses
recommend() entirely for goals that name a specific template"*) and scores candidates with
its own UCB over its own locally-tracked outcomes.

So the previous fixes are not wrong. They govern a **minority path**, and their
confirmation is waiting on goal-walk traffic that barely occurs.

## 3. The needle-mover — found by asking what the dominant path reads

Boredom scores the pool from `GET /v2/activities/templates`. That endpoint read:

```ts
try {
  metricsResult = await surrealDB.query(`SELECT * FROM v_activity_score …`);
} catch {
  /* fallback to variant_performance_metrics */
}
```

`v_activity_score` does not exist. **SurrealDB reports a missing table as an empty one —
`status: OK`, zero rows, no exception — so the `catch` never ran.** Measured: the string
`"falling back to variant_performance_metrics"` appears **zero times** in activity-api's
entire journal. The fallback was correct and unreachable for its whole life.

Consequence: every template arrived with **no metrics**, so boredom's
`metrics?.thompson_alpha ?? 1` resolved to the uniform prior for all of them. In the
exercise path (`boredom index.ts:1048`) that is worse than noise — with every candidate at
α=1, `curAlpha > bestAlpha` is never true, so *"pick the template with the HIGHEST alpha"*
silently degrades to **"pick the first candidate."**

What the pool was denied, on the three arms it actually runs:

| arm | α | β | executions | mean |
|---|---|---|---|---|
| `validator-dispatch` | 151,324 | 585,780 | **788,023** | **0.205** |
| `slot-binding` | 148,976 | 230,564 | 221,924 | 0.393 |
| `gap-to-scenario-bridge-tick` | 6,030 | 1,949 | 12,310 | **0.756** |

A **3.7× spread** in success rate across the arms it selects between, invisible to it.
`validator-dispatch` — the template proven to execute **1 of its 5 tasks** — carries a
0.205 mean and is selected 68 times per window because nothing can see that. **2,894 of
3,425 metric rows carry a real posterior this endpoint never delivered.**

**Fixed and confirmed live.** The endpoint now reads `variant_performance_metrics`
directly, matches both id columns, and emits a counted `template_metrics_fetched` log:

```
"event":"template_metrics_fetched","requested":200,"matched":50
"event":"template_metrics_fetched","requested":120,"matched":31
```

Previously this would have been `matched: 0`. The 150 unmatched are templates with no
metrics row at all — never executed — which is correct: 3,428 metric rows against 3,856
activities.

---

## 4. What will move the needle, ranked

**Will move it, and now measurable:**

1. **Templates metrics (done).** Puts a 3.7× discrimination in front of 95% of traffic. The
   pool can now stop grinding a 0.205-mean arm 68 times a window. This is the single
   highest-leverage change found across the whole audit, and it was invisible until traffic
   composition was measured rather than assumed.

2. **A counted log at every cross-component read.** Every defect in four rounds is the same
   shape — *the system cannot distinguish "absent" from "empty" from "zero"*. Missing view
   → OK+empty. Stripped `org_id` → 0 matches. 8-hex vs 16-hex bucket → `matched: 0`.
   Boolean composite index → 0, then the global count. Decay → a rich posterior silently
   becomes `Beta(1,1)`. `failure_mode` with no reason → blame assigned blind. The two
   places that already log requested-vs-matched (`cts_lookup`, `cts_sig_lookup`) are the
   only ones where a dead join was self-evident instead of requiring an audit.

**Will move it, but only once goal traffic exists:**

3. Blame attribution, `correlation_id`, and the 30-day decay. All three are correct, live,
   and inert *because their path barely runs*. They become load-bearing the moment goal
   walks are a meaningful share of traffic — which makes **generating goal traffic** a
   prerequisite for measuring them, not an afterthought.

**Will not move it, on current evidence:**

4. Further seam-hunting on the Thompson/`recommend` path. It is now repaired end to end and
   carries ~5% of executions. More work there is optimising a path that is not being used.

5. The conditional-tier fallback. Structurally it is only reachable for signatures the
   credit path already saw — it exists precisely where it is not needed — and closing it is
   a latency decision in the recommend hot path, which is itself the minority path.

---

## 5. The method finding

The previous three rounds fixed real defects on a path chosen by *architecture diagrams*.
This round found a bigger one by asking a different question: **what does the traffic
actually execute, and what does that path read?**

Both questions were answerable in minutes with queries that had been available the whole
time. The difference was not effort or tooling — it was measuring the *denominator* before
optimising the *numerator*. The same error appears inside the audit itself: the "69%
missing reach tags" claim was withdrawn for measuring over the firehose rather than over
the gradable set.

**Open, and specified:** the blame fix remains inert for a reason not yet found. The engine
sets `{ type: "execution_error", reason: message }` at `engine.ts:1407`, all six consumers
carry the fixed sink, and light-dispatch already posts reasons on its own path — yet 96
reason-less `execution_error` rows landed post-deploy tagged `dispatcher_used:goal-host`.
The next step is to identify which poster produced those specific rows, rather than
assuming the sink is the only one.
