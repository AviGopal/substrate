# Autonomy: what remains, what we should see, and how to bring it about

Companion to `AUDIT_EXPECTATIONS_2026-08-22.md`. That document says what an audit
of the learning loop should be expected to find. This one answers a narrower
question: **what is left before autonomy is demonstrable, rather than merely
observed?**

Every claim here is anchored to evidence already in the tree or in the running
`substrate-live` container. No new audit was run.

---

## 1. The hard criterion is already met — on mechanism

CLAUDE.md's success criterion is "a substrate-authored commit landing on the
remote working branch with no operator hands." That is satisfied, today:

```
3e58e73  Substrate Autonomous  2026-08-22 09:18 UTC
  substrate-authored: apply route-edit-5481c624-compose-report via mitosis cutover
  Applied autonomously by apply_proposal_as_patch + vessel_mitosis_cutover.
  Gap: route-edit-5481c624   Base SHA at staging: 7207670f3eb4
  src/db/paradigm.ts | 14 insertions(+), 37 deletions(-)

$ git merge-base --is-ancestor 3e58e73 origin/dev   →  YES
```

Twelve such commits exist in `activity-api` alone across 08-11 → 08-22, plus
others in `local-tools-vessel`, `metric-collector-vessel`, and the super-repo
itself (`f344ac5f`, `1bec4b88`, 08-17). *(A first pass also credited
`clock-vessel`, `human-surface-vessel` and `relevance-sink-vessel`; those three
listings were identical to each other and to the super-repo's log — `git -C`
into an uninitialised submodule walks up to the parent. A positive read through
a fall-through, which is the same class as a zero read through a filter.)*
The pipeline is complete and named in code:
`vessel_mitosis_start` (copy tree, apply source changes, port override) →
`vessel_mitosis_evaluate` (segment recent traces by `version_id` →
FAVORABLE/NEUTRAL/UNFAVORABLE/INSUFFICIENT_DATA) → `vessel_mitosis_cutover`
(refuses unless FAVORABLE, archives base, promotes to canonical path, and on
`staged_files` commits **and pushes**, emitting `cutoverApplied` with
`new_git_sha + push_status`). The running vessel tree is current — the
mirrored `/vessels/activity-api` carries the same `org_id_prefix` binding as
`origin/dev`, so the loop closes into running code, not just into git.

**So "it fired" is settled. CLAUDE.md also says "it fired" is not success.**

## 2. Why it is not yet demonstrable — every quality check is the operator

The same commit that proves the mechanism also shows the frontier — and the
precise way it does is more interesting than the way I first described it.

`3e58e73` rewrote `getCanonicalPosteriors`, the single most load-bearing repair
in the audit: the one that took every Thompson draw off `Beta(1,1)`. **It did
not break the behaviour.** Checked at the commit itself, the SQL placeholder
`$org_id_prefix` still matches a bound `org_id_prefix` param; the fix works. What
the commit deleted was the **20-line measured evidence comment** recording *why*
both `org_id` forms are required — the row counts, the zero-match measurement,
the reason the strip was a back-compat shim. 37 deletions, 14 insertions, one
file, no test touched.

That is a subtler defect than a regression and a worse one for a system that is
supposed to learn. The comment was the artifact preventing the next agent from
"simplifying" the query back to the bare form and silently re-zeroing every
posterior draw. `origin/dev` now carries a strengthened version of it — *"BOTH
FORMS ARE REQUIRED — do not 'simplify' this back to the bare one"* — plus a
pinning test, because an operator noticed and restored the guardrail.

**Every automated gate passed this commit**, and each was right on its own terms:
typecheck clean, shape-dispatch clean, the semantic gate recording
`addresses=true, on_live_path=true, reason="composed change applied
successfully"`. Nothing in the pipeline reads for *evidence deletion*, because
no gate is looking at what a diff removes from the system's ability to reason
about itself. This is law 8 turned against the substrate by its own hand:
information that was load-bearing at the point of use, removed by a commit that
every correctness check endorsed.

That is not an isolated event. The record holds:

| observation | source |
|---|---|
| ~1 in 5 autonomous commits reverted | memory, 08-12 |
| 5 fixes inert on arrival, all passing their tests; "inert-diff closure detection" named as the load-bearing gap | 08-14 consolidated verdict |
| A judge graded a 6,177-char prose summary as `reached=true`; the deterministic hollow gate had fired correctly on the *same goal* via a different path | `RECTIFICATION_AND_DEMONSTRATION.md`, 08-21 |
| An autonomous commit deleted a fix's measured evidence comment; all gates passed | `3e58e73`, today |

**But "every quality check is the operator" is too strong, and §3 shows why.**
The substrate caught and correctly attributed today's *test* regression by
itself, within 54 seconds, and filed it as a `substrate_detected` gap. What the
operator caught that the system could not was the **evidence deletion** — a class
with no detector anywhere in the pipeline. The accurate statement is narrower and
more useful: *autonomy's mechanism is substrate-owned; its correctness checking
is substrate-owned for regressions that a test can express, and operator-owned
for everything else — including the class that actually occurred today.*

## 3. What the gate actually did — measured, not inferred

An earlier draft of this section asserted that the cutover gate is a live-traffic
A/B and therefore denominator-blind on a 95%-housekeeping traffic mix. **That was
inference, and the journal refutes it.** The gate for this commit was not a
traffic A/B at all:

```
09:18:25 [mitosis-cutover] verdict=FAVORABLE
         cited_checks=["typecheck","shape-dispatch","bun test (baseline-delta, flake-confirmed)"]
         cited_traces=0   base_sha=7207670f3eb4
09:18:25 [mitosis-cutover] freshness  staged_base_sha=7207670f3eb4
         current_live_sha=7207670f3eb4  freshnessOK=true  net_new=false
09:19:19 [mitosis-cutover] post-land suite vessel=activity-api
         commit=3e58e737d0  ran=true  pass=1216  fail=186
```

Three corrections follow, and they change §5:

**`cited_traces=0`.** The FAVORABLE verdict cited no traces whatsoever. The
denominator argument does not apply here because there was no trace-based
evidence in the verdict to have a denominator. The gate is *static checks plus a
suite*.

**The suite ran, and it ran *after* the commit landed.** `post-land suite …
commit=3e58e737d0`. The pinning test `paradigm.org-id-binding.test.ts` was
present at that commit (added by `baca870`, the original fix), so — contrary to
my §2 draft — it was almost certainly executed. It could not have failed, because
the behaviour was preserved. The gate's real weakness is elsewhere.

**The 186 failures are not absorbed as a scalar — and this is where I was most
wrong.** I assumed `pass=1216 fail=186` was the whole signal and recommended
gating on a per-test set difference instead. **That gate already exists**, at
`vessel-mitosis-cutover.ts:2334-2374`, added after a measured 08-17 incident
where a count-based gate blamed `31f1d67` for four pre-existing failures. It
persists the failing-test *names* per vessel under
`/workspace/post-land-baseline/`, diffs the new set against the baseline, and
files a gap only for what is *newly* failing — recording a baseline and filing
nothing on first observation, because "nothing can be attributed on the first
observation, and guessing is what this replaces."

**It ran on `3e58e73`, and it worked.** The self-filed gap:

> `post-land-suite-red-activity-api` · source: **`substrate_detected`**
> "Post-landing suite for activity-api: **2 test(s) NEWLY failing after
> 3e58e737d0** (suite total 186 failing / 1216 passing; the rest were already
> failing before this commit). Newly failing: *mock.module factories must not
> amputate a module's exports > no NEW incomplete factory is introduced* ;
> *… > records the debt honestly rather than hiding it*"

Two tests, correctly attributed, filed autonomously within 54 seconds of the
landing. Not the org-id pinning test — which confirms independently that the
behaviour really was preserved. **The substitution test I was about to propose,
the system already passes for this class.**

So the honest frontier is narrower and sharper than "the gate is weak":

1. **It observes, it does not gate.** By explicit design — the code says "this
   observes the landing, it does not gate it, and a reporting failure must never
   fail a cutover that already succeeded." The commit exists before its
   verification does. Making the suite *pre*-cutover is a real remaining step;
   making it per-test is not, because it already is.
2. **Nothing reads what a diff removes.** `3e58e73` deleted the measured evidence
   comment, and no gate is shaped to see that. The two newly-failing tests it
   *did* trip are about mock-factory debt, not about the deletion. This class is
   genuinely uncaught, and the operator is still the only detector.

**The pipeline already knows this limitation and says so out loud.** From the
same unit's log, on a different target:

> `[fc-coverage] TARGET HAS NO TEST FILE: … every gate below this point READS the
> diff; only a test RUNS it. A FAVORABLE verdict here means the c…`

So the honest statement of the frontier is not "the gate is blind." It is: **the
gate reads the diff well, runs the suite late, and reports its result as a scalar
that cannot separate a real regression from flake — and no gate at all reads for
what a diff *removes*.** `3e58e73` passed because it broke nothing and deleted
the reasoning; that is a hole no correctness check is shaped to catch.

## 4. What we should see — a falsifiable protocol, declared in advance

Three things, and none of them is "more commits landed."

**(a) One clean closed-loop instance, every leg evidenced.**

| leg | status today |
|---|---|
| substrate detects the gap itself (not operator-authored) | ✅ **evidenced today** — it minted `post-land-suite-red-activity-api` and `pull-sync-test-regression-activity-api` from its own red suite, unprompted |
| substrate mints the goal from its own observation | ✅ **evidenced** — `gap-compose unit started` fired for both, 09:18–09:19 |
| the *originating* gap was self-detected, not operator-dispatched | ⚠️ **not for this instance** — `route-edit-5481c624` is the operator-dispatch path; the self-minted gaps above are downstream of the landing, not upstream of it |
| compose drafts + typechecks | ✅ evidenced |
| lands on `origin/dev`, no hands | ✅ evidenced (`3e58e73`) |
| reaches *running code* | ✅ evidenced (mirrored tree current) |
| honest `reached`, not prose | ⚠️ hollow-judge path open (08-21) |
| landed regression detected + attributed to the right commit | ✅ **evidenced today** — 2 newly-failing tests named, 184 pre-existing correctly excluded |
| that detection *gates* the landing | ❌ post-land by design |
| diff does not delete load-bearing evidence | ❌ no detector — the class that occurred today |
| diff is non-inert | ❌ no detector; 5 known inert lands |
| gap stays closed ≥7 days, no rehat | ❌ law 7 triple computed nowhere |

The leg to establish first is now the third one: the substrate demonstrably
detects and mints gaps *from consequences of its own landings*, but this
instance's originating gap came from operator dispatch. **A single end-to-end
instance where the substrate both opens and closes the loop is the missing
demonstration** — everything needed for it has now been observed firing, just
never in one chain.

**(b) A rate, over a window declared before it starts.** Law 7's triple — gap
close rate, detection→close latency, solution durability — computed over a
stated hands-off window. Currently computed nowhere, so the demonstration has no
scoreboard and can be graded retroactively, which is not a demonstration. Live
baseline to beat: 92% of gaps open, 23% recurrence.

**(c) The substitution test.** The class of error caught by hand today —
autonomous rewrite of a pinned fix — caught by a system gate instead. This is
the single cleanest signal, because it is the operator's own function being
transferred. Concretely: re-stage `3e58e73`'s diff and require the pipeline to
refuse it.

## 5. How to bring it about — ordered, and all of it already in the repo

1. **Make the existing per-test delta *gate*, not merely observe.** The
   attribution machinery is already correct and already fires — it is only
   downstream of the landing. Run the same `resolveTestSuite` +
   baseline-set-difference in the mitosis track *before* cutover and refuse on a
   non-empty newly-failing set. This is a small change to an already-proven
   mechanism, not new machinery, and today's commit is the ready-made fixture:
   it would have been refused on two named tests.
2. **Add an evidence-deletion gate.** No check in the pipeline reads what a diff
   *removes*. `3e58e73` passed typecheck, shape-dispatch, semantic-gate and the
   suite while deleting the measured comment that prevents the regression from
   recurring. A diff that removes measurement, row counts, or a "do not simplify
   this back" guardrail from a file it does not otherwise change behaviourally
   should require justification. This is the cleanest available instance of law
   8 — and the `fc-coverage` logger shows the pipeline is already capable of
   reasoning about its own gate coverage out loud.
3. **Generate goal traffic.** `NEEDLE_MOVERS` §4 already names this a
   prerequisite rather than an afterthought: the three correct-but-inert fixes
   (blame, `correlation_id`, 30-day decay) only become measurable once goal walks
   are more than 0.19% of executions. It is also what makes the *originating*
   leg of §4(a) reachable — goal traffic is where self-detected gaps come from.
   `validation/scripts/goal-generator.ts` and `run-learning-campaign.sh` exist.
4. **Add inert-diff detection.** Named as the load-bearing gap on 08-14 and
   still absent. A commit whose diff cannot change behaviour should not close a
   gap. Pair it with the existing `self_alteration_funnel_scan`, which already
   localises stuck stages in this pipeline.
5. **Compute the gap triple.** Without it there is no scoreboard, and step 6
   cannot be graded.
6. **Declare the hands-off window** — duration, metrics, and stopping rule
   stated in advance, operator restricted to intractable blockers only.

**File 1, 2, 4 and 5 as gaps through the cockpit rather than hand-implementing
them.** Law 6 is explicit: hand-completing the substrate's self-development
steals the lesson, and each is exactly the "what activity would detect this class
without me" question. Step 3 is operator work — generating traffic is bootstrap,
not self-development.

## 6. Found while acting on §5: the operator's ACT plane was pointed at a dead hub

Attempting to dispatch the §5 goals through the cockpit returned *"could not find
goal-host-vessel via discovery."* Discovery was healthy and **did** serve
`goal_execution` — `found:true`, `lastSeen` seconds earlier — so the failure was
not what it appeared to be.

`.mcp.json` pins `METABOB_CONFIG_PATH` to `<repo>/.metabob/config.json`, and that
file read:

```json
{ "metabob": { "endpoint": "http://syzygy.host:18080" } }
```

**The cockpit was talking to the remote hub, not the local substrate.** And the
hub's self-development plane is still down — the 08-20 finding, unchanged at
08-23:

| shape | hub | local |
|---|---|---|
| `concept` | ✅ concept-db | ✅ |
| `llmCompletion` | ✅ 9 resolvers | ✅ |
| `activityTemplate` | ✅ activity-api | ✅ |
| **`goal_execution`** | ❌ `found:false` | ✅ |
| **`activity_execution`** | ❌ | ✅ |
| **`substrateGap`** | ❌ | ✅ |
| **`memoryNote`** | ❌ | ✅ |

`syzygy.host:18210` refuses TCP outright while `:18080` and `:18100` answer 200.
So the hub runs its data and LLM planes and none of its self-development plane,
and **every operator goal dispatch through the cockpit has been going nowhere.**
This is the blocker beneath the blockers: it invalidates the ACT plane of the
canonical loop, and it is invisible because a dead-plane discovery miss and a
genuine "no producer" are the same response — the audit's absent-vs-empty
signature, one layer up.

*Unblocked locally* by repointing the project config at `http://localhost:18080`
with the local key (original preserved at `.metabob/config.json.hub-backup`;
the file is gitignored and untracked). **The MCP server loads its config at
launch, so the cockpit tools stay pointed at the hub until it reconnects** —
until then, dispatch goes directly to the local goal-host, which accepts and
runs it (three goals dispatched and running).

**A lead, explicitly not a finding.** `.mcp.json`'s mtime is **2026-08-01
12:18** — the same date activity minting collapsed from 79/week to 4-in-21-days.
The mechanism would be clean: operator goal traffic is the main source of reached
goal executions, reached executions are what the ribosome extracts from, so
pointing the cockpit at a substrate that cannot accept goals starves extraction.
But the config's *contents* on 08-01 are not known — the file was rewritten today
at 19:24 — so this is correlation with a plausible mechanism, nothing more. It is
now a live experiment: goal traffic is flowing locally again, and if extraction
resumes minting, the chain is confirmed.

## 7. Blocker status after acting on §5

Working the list changed it. Three items I inherited or wrote were **already
implemented** — a base rate worth as much as the findings themselves.

| blocker | status after probing |
|---|---|
| Per-test regression attribution on landings | ✅ **already implemented** and firing correctly (§3) |
| Law 7's gap triple "computed nowhere" | ✅ **already implemented** — `gap-lifecycle-scan.ts:586-624` emits `close_rate`, `median_latency_ms` and `churned_closed` as a durable series. The audit's claim, which I repeated, is wrong |
| Cutover gates on evidence, not just exit status | ✅ already implemented (`FAVORABLE` + freshness + semantic gate) |
| **Gap-triple series is stale** | ❌ **the real defect** — `gap_lifecycle_scan` has not *run* in 48h; all 14 journal mentions are `patch-with-tools` editing the file, none is an execution. A scheduling failure, not a missing capability |
| **Two divergent gap stores** | ❌ **new** — `/workspace/gaps/` holds 2,540 series rows over 2,666 gaps at `close_rate 0.79`, frozen 2026-08-09; `/workspace/git/super-repo/gaps/` holds 5 rows over 629 gaps at `close_rate 0.083`, last 2026-08-18, with a live `gaps.json` written minutes ago. `workspaceRoot()` moved and the old series was orphaned. The audit's "92% of gaps open" matches only the second store (576/629) |
| **The cockpit pointed at a dead hub** | ⚠️ **unblocked locally**, needs an MCP reconnect (§6) |
| **`concept-db` saturated on the walk's critical path** | ❌ **new** — `/health` unresponsive at >10.9s while `active/running`, `NRestarts=0`. `walk-concepts` recall timed out 37 times in 6h at a 12s budget × 3 attempts, so a stalled walk burns 36s before proceeding *without* its concepts. Positive control: recall succeeded 50 times in 24h with `rows=1..5`, so this is intermittent saturation, not a dead vessel. This is law 8 exactly — the load-bearing fact is unavailable at the moment of use |
| Pre-cutover gating · evidence-deletion gate · ribosome-extract output shape | 🔄 **dispatched as goals** to the local goal-host, in flight |
| Blame `reason` | ❌ still unmeasurable from operator surfaces — `failure_mode` is absent from the executions endpoint's projection, and `execution_trace` is not a resolvable shape on activity-api |
| Hub self-development plane | ⛔ **intractable from here** — needs host access the operator does not have (no SSH, verified 08-17) |

**A correction to §6's own probe.** I earlier read 93 of 100 executions on
`gap-to-scenario-bridge-tick` and offered it as possible evidence the pool had
concentrated on its best arm. A later sample of the same endpoint reads 28
bridge-tick and 20 `validator-dispatch`. The first read was a window artifact;
the concentration claim does not survive, and the hedge on it was warranted.

## 8. The livelock: the substrate asks a question nothing can read

The single most concrete growth blocker found by working the list, and it was not
in any prior report.

`gap-to-feature`'s picker selects a gap, finds it flagged pending, and skips it:

```
02:27:54 [gap-to-feature] pick {"gap_id":"route-edit-56849210", …
         "target":"repos/development-vessel/src/resolvers/rhythm-conductor-tick.ts"}
02:27:54 [gap-to-feature] gap route-edit-56849210 PENDING verification at pick time — skipping re-compose
```

**432 picks of that one gap in 48 hours, never once composed.** Seven gaps are in
this state, and between them they account for the top of the pick distribution:

| gap | picks / 24h |
|---|---|
| `recommit-route-edit-9077062c-typecheck_dangling_reference-narrowed` | 200 |
| `route-edit-56849210` | 121 |
| `route-edit-a95b959a` | 83 |
| `gap-env-gated-substrate-auto-draft-enabled` | 65 |
| `route-edit-1d843a2a` · `route-edit-f79ac530` · `route-edit-c770e288` | 138 |

**Why they are stuck.** I got this wrong twice before getting it right, and both
wrong answers are instructive.

*First wrong answer: a broken sweep.* `sweepPendingLandVerifications` appears in
the journal only inside stack traces, 56 times, all `ConnectionRefused` against
activity-api. But every one of those errors falls in a **17-minute window on
2026-08-22, 08:33–08:50**; in the last 6 hours the sweep throws zero times.

*Second wrong answer: a stale flag from that outage.* This is what I committed,
and it is refuted by the flag's own timestamp — `pending_set_at` on the affected
gaps reads **`2026-08-23T02:33`, minutes before I looked**. The sweep is not
failing to clear a stale flag; it is **actively re-stamping** it on every run,
because the condition that sets it is still true.

*What is actually happening.* `markPendingVerification` is deliberate and
correct. When a gap has landed once but the close-oracle has **no way to measure**
whether the change resolved the condition, the gap is held open with
`disposition: 'pending_verification'` rather than closed green on the commit
alone — the code names this precisely as avoiding "the inert-diff hole." The
picker then skips it so a second landing cannot manufacture a false close. This
is the substrate correctly refusing to mark its own unverifiable work as done.

**The exit transition is a human, and the channel to reach one is half-built.**
The escalation writes a `uiQuestion`: *"Gap landed but is unverified — did the
change actually fix it? … did the landed change actually fix this, or is it
inert/wrong?"* The journal shows `uiQuestion_write accepted` 1,000 times in 24h.
But in the registry:

```
uiQuestion_write  ->  FOUND  stateful-ui-vessel, development-vessel-local, human-surface-vessel
uiQuestion        ->  none
uiFeedback        ->  FOUND  stateful-ui-vessel, human-surface-vessel     ← positive control
```

**The write shape has three producers. The read shape has none.** The sibling
`uiFeedback` resolves, so this is a real absence and not a query artifact. The
substrate has asked the operator the same question a thousand times through a
channel with no reader on the other end — the write≠read defect this codebase has
now hit in a dozen places, landing this time on the one transition that releases
autonomous repair capacity.

So the disposition is not "clear seven stale flags." It is:

- **Instance:** answer the seven questions — a verdict per gap, which is exactly
  the operator's job under law 13 and the one thing genuinely blocked on a human.
- **Class 1:** advertise a `uiQuestion` read shape so pending questions can be
  enumerated by any surface. Without it every escalation this system makes is
  write-only.
- **Class 2:** give the close-oracle a measurement predicate for the
  `edit_intent_route` class, so the common case never needs a human at all.
- **The missing detector:** *a gap picked N times and never composed is a
  livelock* — the picker is the component positioned to notice, and it currently
  logs the skip without ever counting it.

It also explains a symptom already in the record. `route-edit-56849210` targets
`rhythm-conductor-tick.ts` — the fix for the open gap
`rhythm-cadence-registry_unmappable` ("all 1 rhythm(s) were skipped with
no_goal_mapping, so the conductor scores due-ness and has nothing to enqueue",
open since 2026-08-17). So law 5's cadence plane is broken, its repair is one of
the seven livelocked gaps, and **the periodic scans that plane is supposed to
enqueue are exactly the ones measured stale above** — `gap_lifecycle_scan` has not
run in 48h, which is why the gap-triple series stops on 08-18. One livelock,
three symptoms.

## 9. What the seven pending gaps turned out to be

Answering them is the operator verdict the system has been waiting for since
08-18. Reading the diffs settled two classes, and the second is the more
important finding of the session.

**One inert landing.** `route-edit-56849210` → `dbb2917`: two comment lines
restating the gap text pasted into an unrelated `substrateGap_write` literal,
plus a whitespace-only reindent of `category: "other"` that breaks the
surrounding indentation. It does nothing about the drafter regex flakiness the
gap names — which is also what the semantic gate said when it rejected an earlier
attempt at the same gap. The gap is *also* mis-targeted: drafter flakiness routed
to `rhythm-conductor-tick.ts`, a law-13 mis-target on top of an inert diff.
**Verdict: inert, re-compose authorised.** The pending guard was right to fire.

**Three landings that are individually valid and collectively a treadmill.**
Between 12:48 and 14:42 on 2026-08-18, three distinct gaps produced three
substrate-authored commits to **the same line** of
`repos/goal-host-vessel/src/registry-field.ts`, each adding one more synonym to
one regex alternation:

| sha | gap | added to the alternation |
|---|---|---|
| `743a258f` | `route-edit-1d843a2a` | `quantity of` |
| `0804f9c1` | `route-edit-c770e288` | `how much` · `how numerous` |
| `16670817` | `route-edit-a95b959a` | `sum of` |

Every one typechecks, lands, closes its gap, and counts toward the autonomy
record. And the capability does not improve, because natural-language synonyms
are unbounded and an alternation cannot enumerate them — every new phrasing of a
counting question mints another gap and consumes another autonomous landing.

**This is law 13 implemented as a regex.** The system is supposed to own
decomposition and path inference from natural language; instead the goal
vocabulary is a hand-grown word list growing at one word per commit. It is the
sharpest example available of law 3's warning that *a wrong mint is negative
value, not zero* — and of why "it fired" is not success: these four landings are
four of the twelve that make the autonomy record look healthy.

**Verdict: non-inert but do not re-compose.** Filed as
`goal-vocabulary-is-a-synonym-treadmill` with the three shas as evidence.

## 10. Two mistakes of my own, both predicted in advance

**I dispatched three goals concurrently into a single-occupancy lane.** Two were
refused `feature_compose:busy` and graded `reached:false`, and the learning record
shows `dBeta: 2` applied to `activity:⟨audit-then-debug-tests⟩` — an arm
penalised for a capacity refusal it had nothing to do with.

None of that is new, and that is the point. The gap
`gap-edit-intent-compose-lane-lands-nothing`, filed by the substrate at
2026-08-22 08:52, already says it:

> "Two of the capacity refusals were **operator-caused by dispatching three goals
> concurrently into a lane that cannot serve them**, which is itself worth
> surfacing: nothing told the operator the lane was saturated until the refusal."

The substrate documented my mistake seventeen hours before I made it. The
unconditional β-penalty is likewise already filed as `gap-mt0kcoyt`
(`index.ts:5196` returns `{dAlpha: 0, dBeta: 2}` unconditionally). **Both were
rediscoveries, and checking first is what kept them from being re-filed** — the
third and fourth things this session that I nearly reported as new.

The actionable residue is small and real: *nothing tells a dispatcher the lane is
saturated before it accepts the goal*, so the correct operator behaviour is to
dispatch edit-intent goals **serially**, which is what the remaining two are
waiting on.

## 11. Checked and cleared — the lesson channel is not starving the drafter

Recorded because it cost real probe time and would have been a confident,
wrong filing.

Re-dispatching the ribosome goal produced a clean end-to-end run of the intended
loop — goal → gap `route-edit-c2f83378` → compose → draft → **typecheck refused**
(`typecheck_dangling_reference`), lesson recorded, and this time no spurious
β-penalty (`alphaBetaDelta: []`). The gate did its job.

The lesson it wrote looked broken. Both sampled lessons are **exactly 200
characters**, and in both the entire budget is consumed by package-install
preamble, cutting off mid-path exactly where the compiler error starts:

```
… [11.00ms] done\n== typecheck ==\n$ bun run check:types\n$ tsc --noEmit\nsrc/se
… [11.00ms] done\n== typecheck ==\n$ tsc --noEmit\nsrc/routes/impuls
```

The source confirms the truncation — `feature-compose.ts:2259` writes
`reason: reason.slice(0, 200)`. That reads as the teaching channel for the single
most common compose failure containing no error, which would neatly explain why
`typecheck_dangling_reference` recurs at ~200 picks a day.

**It is not a defect.** The same line also writes `raw_excerpt: reason.slice(0,
1500)`, and the stored excerpt holds the complete diagnostic:

```
src/services/discovery-client.ts(148,9): error TS2322: Type 'Record<string, string |
{ template: string; args: any; }> | undefined' is not assignable to …
```

And the *consumer* reads it. `feature-compose.ts:1442` emits `raw verify output
(verbatim, from the prior failed attempt): …` into the drafter prompt, guarded on
`raw_excerpt.length > reason.length` — which 1500 > 200 always satisfies. So the
drafter does see the compiler error, verbatim, at prompt-build time. The 200-char
`reason` is a display field, not the teaching path.

Checking at the layer that *consumes* the artifact rather than the layer that
writes it is what separated this from a filed finding — the fifth would-be false
positive of the session, and the reason the base rate in §2 of the companion
report is worth taking seriously.

## 12. The named open question feeding all of this

**Minting stopped around 2026-08-01** — 79 mints in the week to 08-01, then 4 in
the 21 days since, measured over 98.2% of the corpus (`AUDIT_EXPECTATIONS` §6).
Both the earned path and the proposal path halted together. If goal *generation*
is part of that same stall, then step 2 above is not merely a measurement
prerequisite — it is the blocker, and the first two legs of §4(a) cannot be
evidenced until it is understood. This is a separate investigation and is not
resolved here.

---

## 13. Disposition — every blocker, and who owns it

Nothing below is left implicit. Each item is resolved, dispatched, filed with its
class question answered, or documented as intractable with an owner named.

**Resolved this session**

| item | how |
|---|---|
| Cockpit pointed at a hub with no self-development plane | Repointed to `localhost:18080`; original at `.metabob/config.json.hub-backup` |
| Seven gaps parked on an unanswerable question | Verdicts rendered on four (1 inert, 3 treadmill); dispositions cleared |
| "Gap triple computed nowhere" | Refuted — it exists; the defect is that `gap_lifecycle_scan` has not run in 48h |
| "Per-test attribution missing" | Refuted — exists, and fired correctly on `3e58e73` |

**Filed as gaps, class question answered (law 6)**

`uiquestion-read-shape-has-no-producer` · `gap-picker-cannot-detect-its-own-livelock` ·
`concept-db-saturated-on-walk-critical-path` · `goal-vocabulary-is-a-synonym-treadmill`

**Already filed by the substrate — not re-filed**

`gap-edit-intent-compose-lane-lands-nothing` · `gap-mt0kcoyt` (unconditional β) ·
`rhythm-cadence-registry_unmappable` · `route-edit-3ca33bb6`

**In flight**

`c6c88cb0` (ribosome-extract output shape) is running and has already produced
`route-edit-c2f83378`. G1 (pre-cutover gating) and G3 (evidence-deletion gate)
were refused for capacity and must be re-dispatched **serially** — queued behind a
lane-free watch.

**Owned by the user — I cannot move these**

1. **Reconnect the MCP server.** The cockpit tools still point at the hub for
   this session; the config change takes effect on reconnect. Until then the ACT
   plane of the canonical loop is unavailable through the documented interface.
2. **Hub access.** `syzygy.host`'s goal-host, development, gap and memory planes
   are down, and no SSH exists from here (verified 08-17). Every fix landing in
   git is unexercised in production until someone with host access deploys.
3. **The remaining three pending-verification verdicts**, if the substrate should
   not simply re-derive them — though the better answer is the filed class-fix:
   give the close-oracle a measurement predicate so the common case never needs a
   human.

**Not resolvable by audit**

Blame `reason` remains unmeasurable from operator surfaces (`failure_mode` is
absent from the executions endpoint's projection; `execution_trace` is not a
resolvable shape on activity-api). Measuring it needs a read path that does not
currently exist — which is itself the same write-only defect as §8.
