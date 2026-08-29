# How the system corrects its own wiring — the method, and why it currently can't

**The defect class.** Every significant finding of 2026-08-28/29 had one shape: *the fact
exists; the consumer reads a different surface.* Wrong key (`solicitation_ids` vs `panel_id`),
wrong tree (`/vessels` vs the push clone), wrong file (`parent_*` vs reuse lineage), wrong
window (a ratio over a collapsing denominator). Nervous system honest; transmission broken.

**The finding that reframes the question.** The substrate had **already detected** the defect I
spent hours diagnosing by hand. `orphaned_capability_scan` has these open right now:

```
orphaned-capability-uiQuestion        "live registered capability, invoked by 0 of the activity corpus"
orphaned-capability-uiFeedback_write  "…"
orphaned-capability-uiFeedback        "…"
```

Those are the exact three surfaces of the escalation loop. The sensor works. So the question is
not "how do we detect wiring defects" — it is **why detection never becomes repair.**

---

## The loop, and the five places it breaks

Measured 2026-08-29. Each link verified independently.

| # | link | state | evidence |
|---|---|---|---|
| 1 | **Sense** | works, but **reads the wrong surface — the pathology it exists to find** | `uiQuestion` is STILL flagged orphaned after `solicitation_outcome_scan` began consuming it (verified live: 85 outcomes). The scan counts invocation *by the activity corpus*, so resolver→resolver consumption is invisible. Its own counts are incoherent: `live_shape_count: 389` but `invoked_resolver_count: **394**` — numerator exceeds denominator |
| 2 | **Prescribe** | **wrong direction — mint, not rewire** | **114 of 114** orphan gaps carry `suggested_remediation` = *"Author an activity that invokes resolver X"*. Not one says "point the intended consumer at the right surface." That is minting a new producer/consumer to satisfy a metric, against law 3, and it is the documented `poison_producer` path (12 open) |
| 3 | **Learn** | **erased every cycle** | 29 orphan gaps show `first_detected ≠ last_seen` — the detector re-emits the same id, and `substrateGap_write` **replaces** `classification_metadata` wholesale. Result: **`failed_attempts: 0` on all 115 rows** despite 346 category-level attempts. Each gap looks permanently fresh to the picker while the counter climbs |
| 4 | **Select** | **sealed** | `orphaned_capability` calibration: **346 attempts / 0 lands** → `hopeless()` excludes the whole category. 42 open gaps unpickable. The seal is at CATEGORY grain; the amnesia in link 3 is at GAP grain, so the two never inform each other |
| 5 | **Escape** | **repaired 2026-08-29, previously dead** | The seal's only designed escape is a human decision. 1755 escalations in 48h against a read-back that could never see an answer; the answer log held 48 records with **0 `panel_id`**. Repaired: `fe52076` (read-back), `9cb83d0` (disposition executor + bounded re-test) |

**Read links 3 and 4 together — that is the trap.** The gap forgets every failure; the category
remembers all of them. So the picker keeps selecting work that looks untried, fails, and drives
its whole category toward a seal that then blocks 42 unrelated gaps. The system cannot learn
"this specific gap is unlandable," only "this entire category is hopeless." It is amnesia at the
grain where learning would help and permanent memory at the grain where it does harm.

---

## The method

Ordered by dependency, not by appeal. Each step is a precondition for the next.

### Step 0 — repair the instruments that cannot fail honestly. Before anything else.

Three instances, one pathology:
- the lift-validation harness **fataled** rather than reporting 1% coverage (fixed, `f2b6ba40`)
- the lift gate **passes when the substrate goes idle** — `pairs_above_floor / total_pairs ≥ 0.25`
  with a zero-guard but **no minimum-sample floor**; measured 2/17 = FAIL → 2/4 = PASS with the
  numerator unchanged (filed, unfixed)
- my own E2 watcher could only observe the outcome it expected (recorded)

**Why first:** every number below is read through these. A plateau photographs as progress
otherwise, and no later step can be trusted. The fix idiom already exists in the same file —
`!corpus_complete` yields `null`, and the comment says a null dimension "resets the lift streak
honestly instead of falsely signalling a regression." A thin sample is owed the same honesty.

### Step 1 — detection: it exists. Do not rebuild it. Fix its surface.

`orphaned_capability_scan`, `unreachable_producer`, `dispatch_target_drift_scan`,
`schema_assert_drift_scan`, `host_container_source_drift_observer`,
`composition_flow_health_scan`, `consumer_productivity_audit` are the sensor layer, and the
worklist is already computed: 42 + 8 + 12 open.

**But audit the counts before trusting them.** `394/389` is not a rounding artifact, it is two
populations being divided. And a detector that misses resolver→resolver consumption will keep
reporting repaired wiring as broken — which manufactures exactly the false worklist that fed the
346 failed attempts.

### Step 2 — prescription: rewire, don't mint. This is the highest-leverage single change.

The default repair for an orphan must become *"find the intended consumer and point it at the
producer's actual surface/key"* — law 3, reuse before mint. Today it is *"author an activity that
invokes it,"* which satisfies the orphan metric by creating a consumer that exists only to
consume. Unsealing the category **without** changing this direction makes things worse: it
converts a blocked queue into 42 poison producers.

Concretely, an orphan finding should carry the producer AND the candidate consumers that already
reference the shape — the information a rewire needs, which the current gap does not contain.

### Step 3 — give the composer the cross-vessel decomposition it lacks.

A wiring defect is **inherently multi-surface**: the producer is in one vessel, the consumer in
another. The composer is single-file by design ("multi-file asks drop parts silently"). So the
system structurally cannot repair its own wiring defects — which is a better explanation of
346/0 than incapacity.

The procedure exists; it was executed by hand for reuse lineage tonight and should be specified
as a capability:

1. land the **receiver** (accepting field/route/schema), with a round-trip test
2. **gate on the running copy** — artifact present in `/vessels/<v>` and `MainPID` moved, not
   merely on `origin/dev` (pull-sync lags 10–20 min and reports success while skipping)
3. land the **sender**, carrying a retry that degrades to the old behaviour if the receiver is
   older, so deploy skew loses the field rather than the record
4. verify **by consequence at the consumer**

This is an openspec proposal (SPEC before DEV), not a code change to start with.

### Step 4 — unseal through the escape valve, one gap at a time, with evidence.

The disposition executor built tonight is the mechanism: a human answers a `needs-human-*`
escalation with `redefine` / `provide_information` / `grant_access` / `drop`, and the gap gets a
**bounded** re-test exemption (3 attempts, spent by `bumpFailedAttempts`, per-gap so the category
stays sealed for everyone else). Verified: `hopeless_excluded` 79 → 78, exactly one.

This is the operator's proper role — supplying the fact the system cannot derive, once, through a
channel it reads — rather than hand-landing the repair.

### Step 5 — verification standard: round-trip, asserted at the consumer.

A wiring repair is verified when the **consumer reads the value**, never when the producer writes
it. The template is the reuse-lineage test: `POST → 200 → GET → field present`, plus a negative
control proving the neighbouring assertion (CC1) still rejects. Both failure modes must be pinned
separately — *accepted but not stored* (SCHEMAFULL drops undefined fields) and *stored but not
returned* (response schema strips unknown keys) — because a test of the request schema alone
passes under both.

---

## Why this is systematic rather than a to-do list

It fixes **the channel, not the instances**. Step 2 changes what every future orphan finding
asks for. Step 3 gives the composer the shape of repair that wiring requires. Step 4 makes the
seal permeable to evidence instead of permanent. Steps 0 and 5 make the results readable.

The 42 open orphan gaps are then a worklist the *system* can work, which is the actual objective:
the operator supplies facts and verdicts, not commits.

**The order is not negotiable.** Unsealing (4) before fixing the prescription (2) mints poison
producers. Trusting the worklist (1) before auditing the counts inherits a false one. And doing
any of it before step 0 means measuring the result with instruments that cannot report failure.

---

# Execution: what is needed, what we expect, how we know

Baselines measured 2026-08-29 06:40Z. **Every expectation below is written before the change
lands.** A signal chosen after seeing the result proves nothing — that rule voided experiment E1
earlier tonight and it applies here.

**Baselines.** ungrounded refusals **32/3h** · empty-spec composes **28/3h** · compose-cap
refusals **191/3h** · `hopeless_excluded` **83** · `learned_pathway` **14/400** · rows with reuse
lineage **0** · orphan prescriptions saying "author" **114/114** · `invoked_resolver_count`
**394** vs `live_shape_count` **389** · lift gate passing at **2/4 pairs**.

**Who does each step.** The system implements; the operator supplies facts it cannot derive and
verdicts it cannot self-issue. Direct intervention only after a step fails **twice** — counted
per gap as exemption spends, not as `failed_attempts` (which is surprise-weighted ×2 and
over-counts).

---

### Step −1 · Stop the lane starving itself · `feature-compose-entry-point-accepts-an-empty-pointer-and-claims-a-slot`

**Needed.** Apply the `gap_compose` guard (`impulses.ts:450-460`) to the `feature_compose` case
at `:462`: derive spec from `spec/goal/description/gap.summary/gap.title`, return the
`missing_input` structuredError **before** claiming a slot.

**Expect.** Empty-spec composes stop reaching the grounding gate. Because the compose cap is 1–2
and each empty compose holds a slot, throughput for every other gap rises.

**Know.** `spec_len: 0` composes → **0**; ungrounded refusals with `gap=none` → **near 0** (from
32/3h); compose-cap refusals fall materially from **191/3h**. Counter-check: total composes
should *not* fall by 28 — the slots should be taken by real work instead.

**First, because** it is the cheapest change with the widest effect, and every later measurement
is quieter once it lands.

### Step 0 · Instruments that cannot fail honestly · `lift-gate-confidence-term-passes-when-activity-drops`

**Needed.** A minimum-sample floor on `confidence_passing` returning **null**, not false
(`substrate-health-tick.ts:351`). Operator has supplied the predicate, the file's own null-idiom,
and the two anti-patterns, via the escalation channel.

**Expect.** A quiet hour reports `overall_passing: null` ("couldn't measure") rather than `true`.

**Know.** Re-read the health tick during low activity: `total_pairs < floor` yields
`confidence_passing: null` and `overall_passing: null`. Decisive counter-check: the **2/4**
reading that passes today must **not** pass at any denominator.

**Status.** 1 attempt, failed. Exemption 2 of 3 remaining.

### Step 1 · Trust the sensor before trusting its worklist · `orphan-scan-misses-resolver-to-resolver-consumers-...`

**Needed.** Count consumption from both surfaces (activity-corpus *and* resolver→resolver), and
reconcile the two populations being divided.

**Expect.** Genuinely-consumed resolvers stop being reported as orphans; the count becomes
coherent.

**Know.** `orphaned-capability-uiQuestion` **stops being emitted** (it is consumed by
`solicitation_outcome_scan` today and still flagged) — a single decisive test. And
`invoked_resolver_count ≤ live_shape_count`, from **394 > 389**.

**Before step 2's worklist is believable**, because a false worklist is the likeliest explanation
of 346 attempts / 0 lands.

### Step 2 · Rewire, don't mint · `orphan-gaps-prescribe-minting-a-consumer-...`

**Needed.** Emitted `suggested_remediation` becomes rewire-first, and the gap carries what a
rewire needs: the producer's actual write surface and the candidate consumers already referencing
that shape.

**Expect.** Orphan gaps become actionable as wiring repairs rather than as mint requests.

**Know.** Newly emitted orphan gaps name ≥1 candidate consumer and a target surface — from
**0/114** today. Share of orphan-derived commits that add a new activity falls.

**Hard ordering constraint.** This must land **before** the category is unsealed. Unsealing first
converts a blocked queue into **42 poison producers**, which is worse than the blockage.

### Step 3 · The capability the composer lacks · openspec proposal, not code

**Needed.** Specify the cross-vessel procedure executed by hand for reuse lineage: receiver →
gate on the **running** copy (artifact in `/vessels` + `MainPID` moved) → sender carrying a
degrade-on-old-receiver retry → verify at the consumer.

**Expect.** A wiring repair spanning two vessels becomes landable at all. Today it is not: the
composer is single-file by design and a wiring defect is inherently multi-surface.

**Know.** One two-vessel repair lands through the system with the deploy gate observed between
halves. Until then this is the best-supported explanation of 346/0 that is *not* yet proven.

### Step 4 · Unseal per gap, on evidence · demonstrated 2026-08-29

**Needed.** Nothing further — the mechanism exists and ran end to end tonight.

**Know.** Already observed: sealed → escalated → answered → disposition applied → **picked by the
selector**, with `hopeless_excluded` 79 → 78, exactly one. The category stayed sealed for
everyone else, which is the property that makes it safe.

**Blocked for other operators by** `escalation-disposition-parser-rejects-its-own-verb-names`: an
answer beginning `PROVIDE_INFORMATION` is silently a no-op, and those underscored identifiers are
what the system writes into every gap record.

### Step 5 · Verification standard · already in force

**Needed.** Every wiring repair verified **at the consumer**, round-trip, with both failure modes
pinned separately: *accepted but not stored* (SCHEMAFULL drops undefined fields) and *stored but
not returned* (response schema strips unknown keys).

**Know.** The template exists and is green: `POST → 200 → GET → field present`, plus a negative
control proving the neighbouring CC1 assertion still rejects.

---

## The end condition

**Done is not "the five gaps closed."** Done is: **a wiring repair travels from detection to a
landed, consequence-verified change without operator hands on the commit.** That is the loop
closing, and it is the only outcome that distinguishes a repaired channel from five repaired
instances.

## What would falsify this plan

If all five fail twice under the intervention rule, the loop is not repairable from inside, and
the honest conclusion becomes that these specific changes must be operator-authored. That is a
worse answer than the one this plan pursues — and it is exactly why the rule is set at two, and
why the counter is exemption spends rather than a metric that can be inflated.
