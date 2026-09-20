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
| human-surface-vessel | **in-tree** (not a submodule); participation slice uncommitted; unit exists in container but `disabled`/`inactive` — never run |
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
| Gap store | 1,402 gaps (337 open); substantive ui/human hits: open `docs-drift-docs-HUMAN-SURFACE-md`, open `precondition-rejection-activity:⟨learned-composition-uifeedback-write-to-shellresult⟩-2026-09-18`, closed `gap-oracle-label-disagreement-walk-satisfier-2-…`; **zero** gaps name participation or interface usefulness as a defect |

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

- **Producer collision (law 3):** human-surface-vessel inherits and replaces
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

Gap-filing intent: the matrix rows are held here un-filed until stage 2 freezes scenarios,
except the three that block any exchange at all — (a) the `gap_needs_human` filter
regression, (b) the journal-format mismatch, (c) the consumption port hardcode — which are
concrete class-level defects suitable for filing now. None should carry a literal-match
class1 predicate; all three are behavioral.
