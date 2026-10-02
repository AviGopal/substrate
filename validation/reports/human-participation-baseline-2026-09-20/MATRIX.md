# Human-participation cycle: behavior-and-evidence baseline

Stage-1 deliverable of the human-interface program: the starting state against which
subsequent progress is measured. Status document — dated, snapshot-bound, lives in
validation/reports (not docs/architecture, which is timeless).

Method: one static repo audit (rg over repos/, scripts/, docs/; readers counted
separately from writers) and one live-substrate audit (SurrealDB `activity-system`/
`learning_loop`; every zero re-run with a positive control on the same table/field).
Static claims are inferences from source; runtime claims cite rows. Where they meet,
they agree.

## Starting-state snapshot

| Item | Value |
|---|---|
| Captured | 2026-09-19 21:43 PDT |
| Super-repo HEAD | `a9d73eca54a21d372099af1357213674f691081d` (dev) |
| human-surface-vessel | **in-tree** (not a submodule); participation slice uncommitted; unit exists in container but `disabled`/`inactive` — never run (**superseded — see Amendment 1**) |
| Registry shape count | 396 advertised shapes |
| ui/human shapes advertised | uiFeedback, uiFeedback_write, uiPanel_write, uiQuestion, uiQuestion_write, ui_legibility_scan, obsidian:ui_screenshot, interaction_expectation_verify, human_input |
| Live producer of uiQuestion/uiFeedback | stateful-ui-vessel @ :18270 (running 21 h, healthy, 434 panels) — but its discovery heartbeat 404s ("must register first") while `registry_query` still lists it. Inconsistent; unresolved. Walk-side `satisfier:` fallbacks for every ui read shape are consistent with routing not reaching it |
| human_input producers | development-vessel (:18090), metabob-mcp cockpit (:18801); obsidian-vessel advertises it only while a human is present |
| Trace store | `execution` 124,696 rows; `activity_execution_traces` 18,135; `activity` 3,977 templates |
| Shape-level ui traces | **1 row total** (`auto-bridge-uiPanel_write`, 2026-07-14; control: 4,797 rows for substrateGap on same field) |
| ui-named executions | 440 (2026-07→09-20); **404 of them are one failing loop** (`learned-composition-uifeedback-write-to-shellresult`, 368 fail / 36 success, still firing every 30–60 min) |
| Templates consuming a human/ui shape as INPUT | **0** (control: 82 templates output substrateGap) |
| Thompson rows on ui/human arms | 126 in `context_thompson_scores` (14 keys), 12 in `variant_performance_metrics`; all grades say "rarely works" |
| interactor-log journals | 5 files, last content 2026-07-22/23, machine-generated payloads — silent for two months |
| Gap store | 1,402 gaps (337 open) (**superseded — see Amendment 3**); substantive ui/human hits: open `docs-drift-docs-HUMAN-SURFACE-md`, open `precondition-rejection-activity:⟨learned-composition-uifeedback-write-to-shellresult⟩-2026-09-18`, closed `gap-oracle-label-disagreement-walk-satisfier-2-…`; **zero** gaps name participation or interface usefulness as a defect |

## Amendments since snapshot

Amended 2026-09-20 07:09 UTC (measurements taken 07:01–07:09 UTC), after the snapshot
above was stamped. Each entry is
labelled **SUPERSESSION** (the row was accurate when captured; the world moved) or
**CORRECTION** (the row overstated its evidence). The two are not interchangeable: a
supersession vindicates the dated-snapshot convention, a correction indicts the
original claim. Method is unchanged — every count below was re-measured read-only
this turn, and each is itself dated because counts drift.

Measurement caveat that applies throughout: **`rg` does not exist inside
`substrate-live`.** Container-side searches written with `rg` return nothing and exit
non-zero, which reads as a clean negative. Two of this turn's journal negatives were
that silent skip, not an absence; they were re-run with the container's `grep`. Any
in-container search in a future amendment must name the tool it used.

### Amendment 1 — SUPERSESSION: human-surface-vessel is deployed and the producer collision is live

The snapshot row said the unit "exists in container but `disabled`/`inactive` — never
run", captured **2026-09-19 21:43 PDT (2026-09-20 04:43 UTC)**. Verified this turn via
`systemctl show`: `UnitFileState=enabled`, `ActiveState=active`,
`ExecMainStartTimestamp=2026-09-20 06:12:04 UTC` — roughly 90 minutes *after* the
stamp. `/health` on :8310 answers with 11 shapes (`uiPanel_write`, `uiQuestion_write`,
`uiQuestion`, `uiFeedback`, `interactorObservation`, `interactorEvent`,
`interactorAssertion`, `interactorAttachment`, `renderPolicy`, `renderPolicy_write`,
`surfaceIntent`), discovery status `ok`, and a store holding `panels:0 feedback:0
intents:2`. The row was right when written; the dated-snapshot convention did its job.

**The consequence that matters: the "Producer collision (law 3)" item under Unresolved
horizons is no longer a horizon — it is the current state.** `registry_query
mode:vessels shape:uiQuestion` now returns two vessels, in this order:

1. `stateful-ui-vessel` — endpoint `http://127.0.0.1:18270`, `resolve_endpoint: /resolve`
2. `human-surface-vessel` — endpoint `http://127.0.0.1:18310`, `resolve_endpoint: http://127.0.0.1:8310/v2/impulses/resolve`

So resolution order, not a decision, currently picks the reader — and stateful-ui is
first. Two things follow, one verified and one static:

- **Verified: walks still land in stateful-ui after human-surface went live.** Two
  `uiQuestion_write` satisfier firings are journalled at 06:14:26 and 06:18:55 UTC —
  after the 06:12:04 start — and two new auto-id panels exist in stateful-ui with
  `createdAt` of exactly `2026-09-20T06:14:26Z` and `2026-09-20T06:18:55Z`.
  human-surface still holds `panels:0`. The collision is not theoretical; the new
  surface is being bypassed in practice.
- **Static (not executed): the two `resolve_endpoint` formats differ** — a bare path
  for stateful-ui, an absolute URL for human-surface. The known open
  `asResolvePath`-class addressing defect reduces an absolute `resolve_endpoint` to its
  pathname and re-attaches the row's `18xxx` endpoint, which has no container port
  mapping. That makes human-surface's absolute form the suspect form for walk
  reachability. Flagged as the existing gap, not re-confirmed here.

The migration question the original horizon posed (move the accumulated panels, repoint
`STATEFUL_UI_VESSEL_ENDPOINT`) is now due rather than pending, and the panel count to
migrate is 446, not 434.

### Amendment 2 — CORRECTION: the destructive-satisfier evidence, re-grounded

The original citation for panel destruction was dispatch `e318c843…` (in
PROGRAM-STATE.md; **not**, as reviewed, in TRACE-2026-09-20.md, which carries no such
reference). That citation must not be leaned on, and the reason is more specific than
"it 404s":

- `GET http://localhost:8210/executions/e318c843` returns `404 {"error":"dispatch not
  found"}`. **But a positive control at the same address refutes the obvious reading:**
  7 of 8 full UUIDs harvested from the live goal-host journal return `200` on that exact
  route. Dispatch ids are `crypto.randomUUID()` (goal-host `index.ts:15012`), and the
  record cites only the first 8 hex characters — the endpoint keys on the whole UUID, so
  a prefix lookup is *expected* to miss. The 404 is therefore not evidence of eviction
  or of a lost record; it is evidence that **a truncated dispatch id is not a citation**.
  No UUID beginning `e318c843` appears anywhere in the current journal window (which
  does cover round 2's 05:25 UTC timestamp), so the full key is not recoverable and the
  citation is unresolvable as written.

**What replaces it is primary and stronger.** The goal-host journal (read with the
container's `grep`, after the `rg` skip noted above) shows the satisfier substituting a
write action for a read target nine times on 2026-09-20, all within 55 minutes:

```
05:24:01  satisfier action "uiQuestion_write" produced — re-reading target "uiFeedback"
05:24:12  satisfier action "uiQuestion_write" produced — re-reading target "interactorAssertion"
05:26:15  satisfier action "uiQuestion_write" produced — re-reading target "interactorObservation"
05:29:03  satisfier action "uiQuestion_write" produced — re-reading target "uiFeedback"
05:29:31  satisfier action "uiQuestion_write" produced — re-reading target "uiFeedback"
05:30:10  satisfier action "uiQuestion_write" produced — re-reading target "interactorObservation"
05:30:51  satisfier action "uiQuestion_write" produced — re-reading target "interactorObservation"
06:14:26  satisfier action "uiQuestion_write" produced — re-reading target "uiFeedback"
06:18:55  satisfier action "uiQuestion_write" produced — re-reading target "uiFeedback"
```

That is 5 aimed at `uiFeedback`, 3 at `interactorObservation`, 1 at
`interactorAssertion` — the log string is `goal-host-vessel/src/index.ts:8911`. The
class is also **not ui-specific**: the same journal holds 205 satisfier-produced lines
overall, led by `memoryNote → memoryNote_write` (80) and `fs_write → shellResult` (26).
Resolving a read shape by issuing a write is a general walk behaviour; ui is where it
touches human-visible state.

Two overstatements in the original record are corrected:

**(a) The destruction was observed, not re-checkable.** The operator contemporaneously
observed the handoff panel's body emptied and `updatedAt` advanced once per walk round.
That observation stands as observed-then-restored. It is **no longer independently
re-checkable**, and the limitation must be stated wherever it is cited: stateful-ui's
store is a whole-snapshot overwrite with no revision history, so a restored panel
retains no trace of the intervening clobber. Nothing in the live store can now confirm
or refute it.

**(b) The frequency was overstated; the class is real.** Most defaulted live writes
**create** junk panels rather than overwrite one. Verified against the live panel list:
32 panels carry auto-generated `panel-<epoch-ms>` ids, and **all 32 have
`createdAt == updatedAt`** — never written twice. Their creation timestamps match the
satisfier firings above to the second (05:24:12, 05:26:15, 06:14:26, 06:18:55), which
ties firing to creation directly. Of the 32: 29 are defaulted and titleless (19 `info`,
10 `question`) and 3 are the titled `code_change` panels treated under
"Open questions requiring a decision" in PROGRAM-STATE.md — an unattributed producer,
and the only asks-bearing panels in the store. Destructive *overwrite* therefore requires the model to
emit an id that already exists, and its base rate is well under one per firing.

Base-rate caveat, so this is not read the other way: 326 of 446 panels do have
`updatedAt != createdAt`. That is overwhelmingly `gap-to-feature` re-posting escalations
under deterministic ids, which is intended idempotent behaviour — **not** walk
destruction. The two must not be summed.

### Amendment 3 — CORRECTION: scale numbers, re-measured 2026-09-20

| Quantity | Snapshot value | Verified this turn | How |
|---|---|---|---|
| Gap store entries | 1,402 | **1,650** | `jq length` on `/workspace/git/super-repo/gaps/gaps.json` |
| stateful-ui panels held | 434 | **446** | `jq '.panels\|length'` on `:8270/api/state` |
| Panels visible in the escalation view | — (see note) | **247** | the vessel's own filter, `stateful-ui-vessel/src/index.ts:343`, applied over the same list |
| Panels **hidden** by that filter | not recorded | **199** | complement of the above |

The snapshot's open-gap sub-count (337) was not re-measured; only the total was.

The "240-question live view" figure this amendment was asked to correct **could not be
located** — it appears in neither this matrix nor TRACE-2026-09-20.md (searched both for
`240`). Recorded as unlocated rather than amended; correcting a figure that is not in
the record would be inventing one.

Note on the 247: there is **no `GET /api/questions` endpoint** on stateful-ui. The
number was computed by applying the vessel's live filter predicate — `asks.length > 0
|| kind === "question" || kind === "gap_needs_human"` (`index.ts:343`) — over the
`/api/state` panel list. It is the count that filter admits, not a figure the vessel
reports about itself.

**The 199 hidden panels are the substantive finding, and they were not in the
snapshot at all.** The allowlist hides, by kind:

| Hidden kind | Count | Escalation? |
|---|---|---|
| `gap_pending_verification` | 100 | yes |
| `gap_needs_localization` | 65 | yes |
| `gap_reland_needs_human` | 14 | yes |
| `info` | 19 | no |
| `pulse` | 1 | no |

179 of the 199 are escalations addressed to a human that the human's own surface does
not display. Full live kind census across all 446 panels: `gap_needs_human` 233,
`gap_pending_verification` 100, `gap_needs_localization` 65, `info` 19,
`gap_reland_needs_human` 14, `question` 11, `code_change` 3, `pulse` 1.

### Amendment 4 — CORRECTION: the kind vocabulary is open, so an allowlist is the wrong repair

The matrix's stage-1 gap (a) and the filed gap
`human-surface-uiquestion-read-drops-gap-needs-human-panels` both frame the visibility
defect as *"the `gap_needs_human` kind is dropped"*. That framing is too narrow, and it
points at the wrong fix.

Verified: **four distinct `gap_*` escalation kinds exist in the live panel store** —
`gap_needs_human` (233), `gap_pending_verification` (100), `gap_needs_localization`
(65), `gap_reland_needs_human` (14) — and a static search finds all four written from
one producer, `development-vessel/src/resolvers/gap-to-feature.ts`. stateful-ui's
filter admits exactly two kinds by name; human-surface's
(`src/routes/impulses.ts:219`) admits one (`kind === "question"`). So human-surface
would hide all four, and stateful-ui already hides three of them.

Discrepancy recorded rather than resolved: this amendment was asked to record **five**
escalation kinds. Four `gap_*` kinds is what the live store supports. A fifth count is
reachable only by including `question` (a solicitation, not an escalation) or the
asks-bearing `code_change` (unattributed — see PROGRAM-STATE.md, "Open questions
requiring a decision"). Neither count is
adopted here; the census above is what was measured.

**Why the repair must be a denylist.** A kind allowlist has now failed twice in
production against the same class: stateful-ui's own comment at `index.ts:339-341`
records that filtering on `kind === "question"` alone "missed every real escalation",
and the widened allowlist it added still hides 179 escalations today (Amendment 3).
The vocabulary is not closed at runtime: a write-path probe **this session** stored an
invented kind, `escalation_kind_nobody_invented_yet`, uncoerced and unrejected. That
probe was a write and **could not be re-run read-only under this turn's constraints**
— it is cited as a workflow finding, not re-verified here. What *does* corroborate it
read-only is that two live kinds have no writer anywhere in `repos/`: `code_change` (3
panels; the only `repos/` hits for that token are `has_code_changes` in
`activity-api/src/services/state-pattern-learner.ts`, an unrelated identifier) and
`pulse` (1 panel, id `substrate-reach-pulse`; `substrate-reach-pulse` and `Reach Trend`
have zero hits across `repos/` and `scripts/`). Kinds are reaching the store that the
tree does not know how to produce, which is the same conclusion the probe reached by a
different route.

An allowlist therefore fails silently every time the vocabulary grows — the default for
an unknown kind is invisibility, and invisibility of a human escalation is the exact
defect. The fix is a **fail-visible denylist**: show every kind unless it is explicitly
named as non-escalation, so a new kind's failure mode is a stray panel a human can see
and complain about rather than a dropped escalation nobody learns about. This also
satisfies the standing rule that an unobservable target must be a *failed* scan and not
a clean one (`development-vessel/src/resolvers/ui-legibility-scan.ts:95-115`): an
unrecognised kind is an inability to classify, and it must surface as such.

## Evidence typing

Only the first two count as "demonstrated pathway":

- `trace` — durable execution trace / DB rows in the live substrate
- `journal` — runtime journal rows in the live substrate
- `test-run` — passing isolated test in the working tree (proves the code, not the deployment)
- `code-only` — implementation exists, no runtime evidence (IMPLEMENTED_DORMANT until proven)
- `absent` — searched and not found (search named in the cell)

Two lanes, never merged: **LIVE** (what the running substrate demonstrably does) and
**LOCAL** (the operator-authored, undeployed human-surface-vessel slice — attributable
operator intervention #1; not evidence of self-improvement).

Gap classes: `unavailable-capability | disconnected-composition | missing-observation |
unreliable-execution | insufficient-experience`.

"Consumption" is strict: a subsequent activity **read** the contribution (reader cited
file:line plus a runtime row). Storage receipts do not count.

## The matrix

### 1. Invitation — the system recognizes a need for human participation and formulates a request

| Lane | Mechanism | Evidence |
|---|---|---|
| LIVE | `gap-to-feature.ts:1043` fires `uiQuestion_write` with `kind:"gap_needs_human"` at 8+ failed repairs / 0 lands; historically 1,755 escalations in 48 h | trace: `auto-bridge-uiQuestion_write` 9 executions (latest 09-18); 434 accumulated panels in stateful-ui |
| LIVE | goal-host solicits `human_input` from a discovery-resolved vessel with question, timeout, respond-via contract (`goal-host-vessel/src/index.ts:13330-13385`); obsidian-vessel accepts only while a human is present | code-only; traces show only `satisfier:human_input` (2 rows) — **no real solicitation ever answered through the walk** |
| LOCAL | Renders `uiQuestion` panels via `/api/questions` | test-run |

**Gaps:** (a) *disconnected-composition, LOCAL regression*: human-surface's `uiQuestion`
filter (`src/routes/impulses.ts:219`) keeps only `kind==="question"`, dropping
`gap_needs_human` — the clause stateful-ui added (`stateful-ui-vessel/src/index.ts:339-341`)
after that exact bug ("missed every real escalation"). The substrate's primary invitation
would be invisible in the new surface. Must fix before deployment. (b) *missing-observation*:
no record of whether any invitation was ever seen by a human.

### 2. Presentation — the request/material is actually rendered to a human

| Lane | Mechanism | Evidence |
|---|---|---|
| LIVE | stateful-ui-vessel panel store + browser; obsidian-vessel vault surfaces | journal: 434 panels held; but no rendering/exposure record exists anywhere |
| LIVE | `obsidian:ui_screenshot` — real Electron capture in obsidian-vessel; a structurally-incapable stub in development-vessel | code-only producer, **zero consumers** (`rg 'ui_screenshot'` — every hit is producers/registrations/tests) |
| LOCAL | ParticipationRegion: revision-pinned snapshot, explicit re-review gate, original JSON preserved verbatim, narrow layout / keyboard / dark probed | test-run + browser probe |

**Gaps:** *missing-observation* — the substrate has **no evidence of what a human actually
saw**: no exposure record, no rendered-condition report, screenshots produced but unread.
All legibility evidence is self-reported numbers (see mechanisms). This is the transition
stage 4 of the program must build first.

### 3. Contribution — a human supplies content; it is preserved with provenance

| Lane | Mechanism | Evidence |
|---|---|---|
| LIVE | stateful-ui `POST /api/feedback` → `uiFeedback_write` emitted to development-vessel's interactor passthrough → `interactor-log/uiFeedback_write.jsonl` | journal: 20 rows, **last 2026-07-22** — and content is machine-generated dispatch payloads, not human keystrokes |
| LOCAL | `POST /api/participation`: idempotency key reused across retries, receipt field-matched against submission ("Delivery is unconfirmed" on mismatch), revision conflict → 409, fsync'd journal with partial-record isolation, restart replay | test-run (structured content incl. false/0/null, retries, decline, partial answers, restart, failed storage) |

**Gaps:** (a) *insufficient-experience, LIVE*: no human contribution has entered the live
system in two months. (b) *naming hazard, LOCAL*: the browser write travels on the read-shape
name `uiFeedback` (`src/routes/participation.ts:26`); the journal channel `uiFeedback_write`
is what keeps it readable. `uiFeedback_write` itself is not served by the new vessel at all
(gated to operator origin in development-vessel).

### 4. Consumption — a subsequent activity reads the contribution  ⟵ WEAKEST LINK

| Lane | Mechanism | Evidence |
|---|---|---|
| LIVE | **No shape-level reader of `uiFeedback` exists anywhere.** The only two consumers read the JSONL **file**: `solicitation-outcome-scan.ts:68-82` and `escalation-disposition-apply.ts:102` | absent at shape level (searched all repos); templates with human/ui input shapes: **0** in 3,977 |
| LIVE | The only `uiQuestion` consumer (`solicitation-outcome-scan.ts:36-43`) hardcodes `STATEFUL_UI_VESSEL_ENDPOINT` :8270, no discovery fallback; its own comment records it was a guaranteed no-op for its entire prior life (bare dispatch → empty ids) while 1,755 escalations went out | code-only |
| LIVE | The one working funnel: **complaints** → `substrateGap_write` (`ui-feedback-<slug>-<kind>`, category `ui_legibility`, source `human_reported`) → boredom's `ACTIONABLE_CATEGORIES={"ui_legibility"}` goal generator | trace-adjacent (gap store rows exist); fires **only when `complaint_kind` is set — answers file nothing** |
| LOCAL | Journal format: new store writes flat camelCase entries (`{id, panelId, panelRevision, …}`); both file readers expect `{pointer:{panel_id,kind}}` → **new records would be silently skipped by both existing readers** | code-only inference (static; not executed) |

**Gaps:** *disconnected-composition*, three independent breaks — shape-level read missing,
port hardcoded to the old vessel, journal record format mismatch. Any one of them alone
severs consumption for the new surface. Also *unavailable-capability*: answers (as opposed
to complaints) have no consumption path at all.

### 5. Consequence — the contribution changes an artifact, decision, or state

| Lane | Mechanism | Evidence |
|---|---|---|
| LIVE | goal-host retries a failed template with `variables.human_input = sol.answer` (`index.ts:13301-13315`) — the strongest consumption→consequence link in the codebase | code-only (no answered-solicitation trace found) |
| LIVE | `escalation_disposition_apply` parses the human's disposition verb, grants bounded 3-attempt exemption from category seal, read back at `gap-to-feature.ts:2884` | code-only; **no scheduler — only a route case, tests, comments; a human must invoke it** |
| LIVE | Complaint gaps → boredom goal generation (category `ui_legibility`) | trace-adjacent |

**Gaps:** *disconnected-composition* (`escalation_disposition_apply` unscheduled — the
resolver's own header says the system failed at exactly this for two years);
*insufficient-experience* (the human_input retry path has never demonstrably run).

### 6. Learning — the outcome updates posteriors/templates/concepts

| Lane | Mechanism | Evidence |
|---|---|---|
| LIVE | Thompson DID grade ui-named arms: 126 context rows; the failing composition earned α=1.47/β=54.4 over 404 executions. The machinery works when executions flow | trace |
| LIVE | Human→learning writes are **deliberately firewalled**: `escalation-disposition-apply.ts:33-40` enumerates what it refuses to write (no calibration corruption, no engagement credit, no threshold change) — honest by design | code-only |
| LIVE | The sole human→learned-state write, `recordOperatorEngagement("landed_commit")` in `solicitation-outcome-scan.ts:105`, is reachable only via obsidian episodes carrying `solicitation_ids`, **which nothing in obsidian-vessel ever produces** (`:64-65`); the panel-answer fast path returns before it | absent (dead by the resolver's own admission) |
| LOCAL | UI states it plainly: "Storage is confirmed; consumption and learning are not." | honest |

**Gaps:** *unavailable-capability* — there is no live path by which any human contribution
updates any learned state. Note the ledger split (law of two counters): `activity`-table
rows show `total_executions:0, α=1, β=1` for the same templates `variant_performance_metrics`
records 404 executions for — the `activity`-table posteriors are vestigial (known).

### 7. Later reuse — the learned change alters future behavior

| Lane | Mechanism | Evidence |
|---|---|---|
| LIVE | None. concept-db has a `human_input` source type (weight 0.8) but nothing writes UI feedback into it. Searched concept-db, ribosome, relevance-sink, analysis-vessel for uiFeedback / human_reported / interactor-log — no hits | absent |

**Gaps:** *unavailable-capability* — the "applicable reuse" row of the system's own
interaction contract (EXPLICABILITY_SURFACE.md:98) has no implementation.

## Mechanism readiness for human-interaction evidence

| Mechanism | Implementation | Consumes today | Human-evidence ready? | Extension needed |
|---|---|---|---|---|
| Artifact-expectation loop | development-vessel `index.ts:400-481`; `expectation:` memoryNotes written by goal-host's transform oracle | Artifact re-checks vs expectation notes | Structurally yes — an expectation over a human-outcome note is expressible | A producer of human-outcome expectation notes; none exists |
| Standing trend expectation | `expectation-trend:deterministic-battery` note + 120 s in-process checker (`index.ts:473-531`); self-generates probes, byte-verifies in-process | Its own note only — **only reader is its own writer**; not impulse-addressable (no `trend_expectation` shape) | Pattern is right (agreeing-wrong-proof); instance is single-purpose | A second standing expectation instance keyed to a human-participation bar; make the mechanism shape-addressable or accept per-instance code |
| Causal adjudication | `causal-adjudication.ts` — pure verdicts over write-time baselines, plural horizons, `pending` ≠ `refuted`; only the stamping half has a live caller (gap-to-feature) | Gap-store baselines | The verdict taxonomy (incl. `never_present` vs `confirmed`) is exactly what stage 7 needs | No `causal_adjudication` shape (not dispatchable); nothing reads human evidence; the `human_reported`-vs-`substrate_detected` comparison — "the only signal that says whether the detector's rules match what people complain about" — **has no adjudicator** |
| shape_gap_resolution | activity-api routes + SurrealDB table; consumed by ias-executor slot-binding cache | Resolution provenance rows | Yes, mechanically | Nothing — human-serving shapes would flow through it once they resolve at all |
| generative_frontier_gap_tick | development-vessel resolver + seed tick; frontier = produced-and-traced-but-unconsumed | Templates + traces + spectral-gap JSONL | Would flag ui shapes as frontier — **but fail-closed headroom gate currently refuses all emission** (star_ratio ~0.97 → headroom ~0.03) | Topology must de-star before this generative source can speak; not a human-specific extension |
| gap_to_scenario_bridge | development-vessel resolver + seed tick; open gaps → drafter scenarios | gaps.json where source ∈ {operator_seed, substrate_detected} | **No — `human_reported` is excluded from the source filter**, so human complaints never reach the drafter through this bridge | One-line source-filter extension + a deliberate decision it's wanted |
| vessel_gap_to_cluster | development-vessel resolver | Vessel-arrival/orphan gaps → pattern clusters | Indifferent to origin | None immediate |
| interaction_expectation_verify | v0 skeleton resolver; matches solicitation_ids against obsidian episodes within 4 h | Self-reported episode metadata | **No caller at all** (0 executions, 0 template; route+allowlist only) and a tautological `operatorPresent` at `:39` | Needs a scheduler, a real presence signal, and rendered evidence — currently a name, not a mechanism |
| ui_legibility_scan | resolver + `ui-legibility-audit-tick` seed template | `obsidian:ui_view` self-reported token values / counts — obsidian endpoint hardcoded | Partially — it demonstrably files gaps that boredom consumes; but 7/7 recent auto-bridge executions failed, and it **cannot see the new surface** (no path to :8310; human-surface's `ui_view` builder has no caller) | Discovery-by-shape target resolution; rendered-condition input |
| obsidian:ui_screenshot | Real capture (obsidian-vessel) + incapable stub (development-vessel) | — | Producer only, **zero consumers** — no mechanism grades the interface against pixels | A consumer (e.g. legibility scan reading actual rendered conditions) |

## Hollowness register (written or advertised, never read)

1. `uiFeedback` as a read shape — advertised by both UI vessels; stateful-ui has **no
   `/resolve` case** for it; human-surface implements it as a *write*.
2. `expectation-trend:deterministic-battery` — only reader is its own writer.
3. `interaction_expectation_verify` — no caller; tautological presence check.
4. `obsidian:ui_screenshot` — two producers, zero consumers.
5. human-surface `ui_view` — built solely to feed `ui_legibility_scan`, which has no path
   to it.
6. `recordOperatorEngagement` from human answers — unreachable (episodes never carry ids).
7. `escalation_disposition_apply` — implemented, tested, unscheduled.
8. `generative_frontier_gap_tick` — gate refuses all emission at current topology.
9. `adjudicate`/`adjudicateAll` — called only from tests + own sweep; not shape-addressable.
10. `source:"human_reported"` — written, never compared against `substrate_detected`;
    excluded from the scenario bridge.

## Unresolved horizons

- **Producer collision (law 3)** — **no longer a horizon; live as of 2026-09-20
  06:12:04 UTC. See Amendment 1.** human-surface-vessel inherits and replaces
  stateful-ui-vessel's vocabulary. Both are role `ui`; human-surface is a manifest vessel
  (never auto-selected; installed by vessel-ctl post-readiness). Replace/compose/retire —
  including migration of the 434 accumulated panels and repointing
  `STATEFUL_UI_VESSEL_ENDPOINT` — must be decided before deployment.
- **Discovery reliability:** stateful-ui heartbeat 404 vs registry still listing it;
  every ui read shape satisfier-faked in the walk. Same family as the known
  `asResolvePath` addressing defect; unproven whether same root.
- **Churn loop:** `learned-composition-uifeedback-write-to-shellresult` — 92 % of all
  ui-named execution volume is one failing composition still firing; it also has an open
  precondition-rejection gap. It pollutes any future ui-arm statistics; retire or repair
  before baselining stage-6 experiments.
- **Journal silence + `.bak-preuntrack`:** interactor-log content stops 07-22/23 while
  mtimes say Sep 7 — possibly rewritten; provenance of the existing 20 feedback rows is
  suspect.
- **Gap-store integrity:** two gaps carry a literal unrendered template string as their
  `status` (`{{goal.gap_status}}`, `{{substrateGap.status}}`).
- **HOST trap:** shipped human-surface unit pins `HOST=127.0.0.1`; the published port
  needs the `host.conf` drop-in (`ui-only-up.sh:533-535`).

## Attributable operator interventions

1. The entire local human-surface-vessel participation slice (journals, revisioned
   questions, receipts, restart recovery, browser probe) — operator-authored, undeployed,
   per its own contract "not evidence of the substrate improving its own interface."
2. EXPLICABILITY_SURFACE.md + the isolated `explicability.html` prototype (CSP-sealed,
   marks its own learning panels "Not measured in this prototype").
3. This audit.

## What the baseline means

The learning machinery itself is not the bottleneck — it graded the ui-named arms it saw
(it learned, correctly, that the one autonomous ui composition fails). What is missing is
**everything between a stored contribution and a learned change**: no template consumes a
human shape, the two file-readers can't parse the new journal format and point at the old
vessel, answers (vs complaints) have no path at all, and no observation of the rendered
experience exists for any mechanism to condition on. The program's stages 4 (observability)
and the consumption repairs above are therefore the critical path; presentation polish
(stage 3) improves a surface whose output currently goes nowhere.

Gap-filing status: the broad matrix rows are held un-filed until stage 2 freezes
scenarios. The four defects that block any exchange were verified and filed
(source `human_reported`, no class1 literal predicates — all behavioral):

- `human-surface-uiquestion-read-drops-gap-needs-human-panels` — verified by code
  comparison of both filters. **The gap's summary understates the defect: it names one
  kind, and the live kind vocabulary is open. See Amendment 4 — the repair must be a
  fail-visible denylist, not the kind allowlist this row's framing implies.**
- `human-surface-participation-journal-records-unreadable-by-interactor-log-consumers` —
  **empirically confirmed**: the consumer's exact extraction logic run over a journal line
  produced by `recordFeedback` yields an empty answered-panel set.
- `solicitation-outcome-scan-pins-one-ui-endpoint-instead-of-discovery` — **empirically
  confirmed**: `STATEFUL_UI_VESSEL_ENDPOINT` set nowhere in the live container's env or
  unit drop-ins (positive control on the same grep: 5 SURREALDB lines), so the `:8270`
  default governs.
- `stateful-ui-heartbeat-rejected-while-registry-still-lists-it` — filed as an
  investigation observation, no edit site named (root not localized).

The local slice these rows cite is pinned at super-repo commit `36b9ffae`.
