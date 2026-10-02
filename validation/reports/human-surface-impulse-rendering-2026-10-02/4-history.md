# 4 — History: every attempt to make a human surface render impulses

Read-only, 2026-10-02. Sources: `git log` across the super-repo and the submodules `react-renderer`, `stateful-ui-vessel`, `obsidian-vessel`, `workbench`, `metabob-cloud-dashboard`, `deployment/vessels/minibob`, `goal-host-vessel` and `activity-api`; the live gap store (`/workspace/git/super-repo/gaps/gaps.json`, 6,856 rows, read 10-02); the live impulse table (SurrealDB `activity-system/learning_loop`, read-only SELECTs); and the prior reports cited inline. No dispatches, no writes. This track owns history and acceptance criteria only. Seams belong to tracks 1–3.

---

## 0. The answer, in one paragraph

No human surface has ever resolved a *walk's* impulse by pointer and rendered it.

The one place where that was promised is goal-host `3cf2bdf` (07-27). It added the 2,000-char `contentPreview` to `goalWalkState.poolProvenance` and said in its body: *"Totality-on-demand remains a separate activityExecutionTrace read."* That read never worked for walk output:
- activity-api's `activityExecutionTrace{includeImpulses:true}` (`routes/impulses.ts` ~934) loads content from the `impulse` table by `trace.input_impulses`.
- Walk pool impulses (`walk-<shape>-<n>`) never reach that table. Measured 10-02: **0 rows with a `walk-` id, all time**.
- `input_impulses` is empty on the trace rows (shared brief: 150,032/150,032).

Every surface since then has rendered the preview instead of the impulse, and each carried forward the honest "first N of M" label for the cut:
- obsidian's evidence ledger `95adc43` (07-27);
- human-surface `bace892c` (08-07), then `b81ac262` (09-30), then `bestOutput.ts` (`899c224d`, 10-02), which now scrapes the 400-char `HOLLOW-CONTENT` log line.

The only code that ever tried a recalled by-id read for a human was the workbench's `useImpulseContent` (`17473c0`, 04-27). It read a field the server does not fill (§3). The surfaces kept getting better at drawing content they were never given.

---

## 1. Timeline

| Date | Where | Commit | What it rendered / how it got content | What became of it |
|---|---|---|---|---|
| 03-16 | activity-api | `15d4255` | `GET /v2/impulses/:impulseId`: an impulse row by id (REST, not a shape) | still present; no surface calls it |
| 03-25 | metabob-cloud-dashboard | `ef03a6f` | Customer dashboard: login, keys, a traces table. Activity/impulse views sit behind `VITE_ENABLE_ACTIVITY_VIEWS` (`5529fbd`, 05-20) | `3f5e35e` (08-17): a 5 s poll of an O(table) sort over 473,176 trace rows saturated SurrealDB fleet-wide. Not a human surface for impulses |
| 04-16..04-28 | react-renderer (in super-repo) | `f1bd91b3`, `2af4e15a`, `c18afbc0`, `dfc2a35b`, `fe7694f9`, `be6bc05d` | A shape → primitive registry (`config/shape-mapping.json`, **20 shapes**, closed allowlist: an unmapped shape is skipped). **Content is pushed**: it subscribes to activity-api's WS `impulse.resolved` events and draws `payload.body` (`src/services/activity-api-subscriber.ts`). Browser gets updates over WS | Ran only in `--dev`/workspace mode (`88dd0b9f`, `04bbb2c8`); never in `Dockerfile.substrate` or the inventory. Dropped from the super-repo 06-26 (`b49942df`); 3 submodule commits (04-30). Nothing imports it |
| 04-22..05-24 | workbench | `af0ea10` … `e045a2d` | Trajectory editor/observatory for one activity execution: impulse pool by task (`6d14033`), live signal tape from MiniBob WS (`caf56b0`), per-impulse ratings (`bb05b7d`), Thompson scores. **Live mode:** `impulse.resolved` body captured into a store. **Recalled mode:** `useImpulseContent` (`17473c0`, 04-27) | Never deployed (not in inventory/manifest, no unit). Last commit 05-24; no stated reason. The surface moved to stateful-ui, then Obsidian |
| 04-26 | activity-api | `cc1a8b2` | Formalises `impulse.resolved` (WS): one event per `impulse_resolutions[]` entry at trace ingest. `body` is optional, "present when minibob included it" | Still emitted (`execution-traces.ts` ~3043–3151). Its two known consumers (react-renderer, workbench) never ran in the image. A live subscriber was **not verified** |
| 06-02 | stateful-ui-vessel (:8270) | `51bf9db7`, `109bcf20`; dev-vessel `1f9090e` | "The substrate's face." Panels (`uiPanel_write`/`uiQuestion_write`) **pushed** by development-vessel's `ui-write-passthrough.ts`, pinned to `127.0.0.1:8270`. UI: a 421-line template literal pulling React from esm.sh at runtime, with its own client-side shape→renderer registry | Still **active** on node 1 (10-02: 805 panels, 5 feedback records). Retirement declared 08-07, never executed (REALIGNMENT §9.4). See §4 |
| 06-15..08-22 | obsidian-vessel | `d8ac01d` … `1bd0226` | Notes **pushed** via `obsidian:write_note`, one note per goal (`goal-note-manager.ts`; answer from `goalWalkState`, `efd2279` 07-07). Panel resolves `goalWalkState`, `fleetActivityFeed`, `vesselRegistry` by shaped poll through the sidecar (`6d71bc9` 07-13, `15799bb` 07-15). No note per impulse, no shape/pointer frontmatter, no "resolve impulse" command | Vault disconnected since ~09-14 (`fb598747`, 09-16). Its timers still run; `obsidian:write_note` has **0 producers**, yet goal-target inference still picks it as a terminal (5-delivery §0) |
| 07-25 | goal-host | `ced125b` | `poolProvenance` (shape, goalSignature, producedBy) mirrored onto the dispatch record. Provenance, not content | the field every later surface reads |
| **07-27** | goal-host | **`3cf2bdf`** | `contentPreview: c.slice(0, 2000)` + `chars` + `truncated` per pool impulse, for reached and failed walks. *"Totality-on-demand remains a separate activityExecutionTrace read."* | **The promised read never materialised for walk output** (§3) |
| 07-27 | obsidian-vessel | `95adc43` | Evidence ledger: `renderEvidenceLedger` draws each `poolProvenance` preview in a `<pre>`, tool vs LLM badge, "showing first N of M" | First human rendering of walk content: a preview, by design |
| 07-27 | obsidian-vessel | `e6206e9` | Thompson-selected presentation arms graded by human attention | First "learn how to render"; died with the vault |
| 08-07 | human-surface-vessel (:8310, plain files in the super-repo) | `1098380a` | Hono + React 19 + Vite + Tailwind 4 behind a server-side proxy. Inherits the ui* vocabulary. `renderPolicy` makes render choice a shaped impulse ("heuristic demoted to a prior") | Live today |
| 08-07 | human-surface | `bace892c`, `66abef4a`, `6f484b71`, `aa1a7d10` | **Form-based, not shape-based** rendering (verbatim/prose/rows/diff/terminal/record/scalar/stub), envelope unwrap as a pre-pass. Corpus: 156 of 212 previews across 18 shapes had reached people as raw text. Truncated-envelope recovery because "truncation was the common case": the 2,000 cap hit exactly the useful goals | The open-vocabulary / closed-form decision survives (ContentRender, planContent) |
| 08-07 | openspec `human-surface-stack` | — | Root-and-stem: retire react-renderer + stateful-ui. Notes "THREE shape→renderer registries in the fleet" (react-renderer, workbench, stateful-ui's inline one) | Acceptance item 5 (retire stateful-ui) unmet (REALIGNMENT §9.4) |
| 08-18/19 | human-surface | `d65a21e7`, `4e50f1fa`, `3b4f921a` | Resolve goal shapes through discovery at each row's advertised path; dispatch as `goalDispatchAsync`; unwrap federated `{content:{shape,produced_by,body}}` once | Everything the surface reads is a shape |
| 08-18 | goal-host | `36f5390`, `17f2e41` | "the answer existed and the endpoint did not send it"; `answerBody` widened from question-goals to all reached | Still gated on `reached === true` |
| 09-06 | report | INTERACTABLE_HORIZON | "16 of 50 rendered rows carry neither goal text nor an executionId; `answerBody` null on 47 of 50" | Gap `the-surface-has-a-render-architecture-and-no-selection-architecture` filed 09-06. Open in the 09-11 snapshot, **absent from today's store**, along with 657 of the 660 gaps created 09-06 (§4f) |
| 09-19..09-21 | human-surface | `c0addb25`, `0d0951c5`, `59b8b704` | renderPolicy picks the presentation variant; an importance ranker plus a learner from exposure; scalar rescue (misroute 35 → 0 on a 126-impulse live pool); form decisions recorded | Learners exist; see "learned" below |
| 09-20 | human-surface | `1704850a` | Escalation visibility: 199 of 445 panels had been hidden by a `kind==="question"` allowlist; replaced with a denylist (`info`, `pulse`) | The denylist also hides every walk-delivered `info` panel (5-delivery §2.2) |
| 09-22 | gap | `248-escalations-were-asked-of-a-vessel-no-human-reads` | 248 needs-human asks at :8270, 0 answered; :8310 had no reference to 8270 | Write side routed by shape 09-29 (dev-vessel `ui-write-passthrough.ts`); the `solicitation-outcome-scan.ts:38` fallback still pins :8270; :8270 grew 794 → 805 panels |
| 09-30 | human-surface | `2a9a4be6`, `b0767021`, `b81ac262`, `e2bcb509`, `f8bc7d61` | Rail + main-pane workbench; attempts segmented from `poolEvents` with content kept in **browser sessionStorage** (server keeps only the last walk); the `<Rendered>` render contract over every content site; form learner recovered from the container (known inert); "pointer only" stub wording for horizontal-bundle `{producedBy, executionId}` entries | Current design. Content is still the dispatch record's preview |
| 10-02 | human-surface | `899c224d` | "Best output" block: scrapes `HOLLOW-CONTENT <shape> (<n> chars) = <400 chars>` walkLog lines because nothing better is addressable | The furthest point of the preview lineage |

The realignment dossier sums up the arc as "rebuilt the surface twice" (workbench 04-22..05-24 → obsidian 06-15..08-22 → human-surface 08-07..).

---

## 2. Per surface: what was learned, and why it stopped

**react-renderer.** It had the right ontology on paper: impulse types `ui_component`/`ui_state`, rule-composed primitives, no LLM, and shape-slot layouts filled as events arrive. But it had a closed 20-shape mapping, so any shape outside it was silently not drawn. It got content only if the producer had pushed `body` on the WS event. It advertised "Thompson Sampling optimizes which UI patterns lead to successful outcomes" but never ran in a substrate, so that posterior was declared and never walked (law 4). It stopped because of scope pruning (06-26), not a failure verdict. **What survives:** nothing by code. The lesson inverted: human-surface chose an open shape vocabulary with a closed *form* set, precisely so that a new shape renders without a code change.

**workbench.** This was the only surface that had both a live push path and a recalled by-id path for impulse content. Its live path worked when MiniBob attached `body`. It was never deployed, and MiniBob's WS model was dropped. What it learned (impulse ratings, `bb05b7d`) never reached the substrate's learners.

**stateful-ui-vessel.** It was a panel store, not an impulse renderer. Panels are free-form `{title, body, kind, asks}` with no author, no dispatch link, and no pointer to the impulse they describe; feedback has no authenticated user. Its "reader" (`6dc8107`, 08-28) is a machine read shape, not a screen. It survives as an escalation sink nobody reads (§4b). Five substrate-authored landings on it (09-20..09-28) repaired a surface no human opens.

**obsidian-vessel.** It reached humans for two months. It rendered dispatch records (goal notes, fleet board, shape-flow DAG, trust chips) plus the 07-27 evidence ledger of previews. It learned the two lessons later reused:
- a preview must say it is a preview;
- walk telemetry is not a reason (`80f31d5`).

It also had the first render-learning loop (`e6206e9`). It stopped being the surface because the vault disappeared (~09-14), and the system's ticks blamed the activity rather than the absent surface (`fb598747`). Its terminal shape `obsidian:write_note` is still inferred as a goal target with 0 producers. That is a fossil steering delivery (5-delivery §0, REALIGNMENT §9.5 step 0).

**human-surface-vessel.** It is the most thorough renderer the fleet has had. It has:
- an open shape vocabulary and nine content forms;
- an envelope pre-pass and truncation-honest partial JSON;
- one `<Rendered>` frame;
- renderPolicy as a shaped impulse read at use time;
- an importance ranker with an exposure learner.

What it learned:
- **Form learning is inert.** `e2bcb509`: the learner scores only outcomes carrying `form_source:"dom"`, and nothing writes that field. `learnedFormByShape` stays `{}`. The gaps `form-decision-corpus-has-no-reader-learned-form-by-shape-has-no-writer`, `the-form-learner-has-no-variance-source-so-it-can-only-demote` and `the-human-surface-can-be-told-a-form-preference-but-cannot-learn-one` are all open.
- **Importance learning learned from the wrong signal.** It learned from arrival order until `0d0951c5` fixed the ranking; per-kind weights have since diverged (`gap_needs_human` 2.1e185, `learnerprobe_*` ~1e128, dossier §2.8).

Its content still comes from the goal-host dispatch record (`goalWalkState`: `poolProvenance` previews, `walkLog`, `answerBody`). Its own source has no call that resolves an impulse by its id:
- `git log -S` over `repos/human-surface-vessel` for `fetchImpulse`, `impulseById`, `executionTrace` and `poolImpulse"` returns 0 hits.
- Positive control: `goalWalkState` and `poolProvenance` both hit, from `1098380a`/`66abef4a`.

**minibob.** It has no UI. Its only surface was the WS event stream the workbench consumed.

---

## 3. Was there ever a working "resolve an impulse by pointer and render it" path?

**For walk output: no. For impulse rows in general: an endpoint exists and no surface reaches it with a useful id.**

| Path | Exists | Carries content | Reached by a human surface | Why it fails for walk impulses |
|---|---|---|---|---|
| activity-api `GET /v2/impulses/:impulseId` (03-16) | yes | the row | no | walk ids never become rows |
| activity-api `activityExecutionTrace{includeImpulses}` → `resolved_impulses` (~impulses.ts:934) | yes | `SELECT id, shape, summary, content FROM impulse WHERE id IN trace.input_impulses` | no | `input_impulses` empty (brief: 150,032/150,032) |
| activity-api `executionTraceWithSignatures` → `impulses_by_id` (`003f477`, 04-24; `fc559be`, 08-13) | yes | **no**: `ImpulseSignature = {pointer_type, shape, summary?}` | no | a signature, by design |
| workbench `useImpulseContent` (`17473c0`, 04-27) | dead code | — | never deployed | posts `activityExecutionTrace` but reads `res.impulses_by_id[id]`, a field only `executionTraceWithSignatures` returns, and without content. Read against today's source, the recalled path returns `null` whatever the trace holds |
| WS `impulse.resolved` body (`cc1a8b2`) | yes | only if the producer attached `body` | react-renderer / workbench, neither in the image | push, not pointer; no subscriber verified today |
| `goalWalkState.poolProvenance[].contentPreview` (`3cf2bdf`) | yes | ≤2,000 chars, last walk only, blanked past the newest 100 records | **yes**: obsidian 07-27..08-22, human-surface 08-07.. | the only content path humans ever had |

**Impulse table, live (10-02).**
- In the last 24 h it holds **1,098 rows across 5 shapes**: `cluster_shadow_decision` 736, `conceptUpkeepAuditLog` 356, `upkeepAuditLog` 4, `environmentBaseline` 1, `operationalStateSnapshot` 1.
- **None** of them is a walk content shape (`llm_completion`, `web_search`, `shellResult`, …).
- Rows whose id starts with `walk-`: **0, all time** (38 s scan).
- Positive control through the same table: rows with ids `cluster-shadow-…` and `impulse_…` returned on the same address in the same session. The table is live; it is simply not where walk impulses go.
- Window: 88,890 rows in the last 30 d. A per-shape count over 30 d for the walk content shapes timed out, so it is not claimed.
- Real field names, from `SELECT *` on one `conceptUpkeepAuditLog` row: there is no top-level `content` field. The payload rides inside `pointer` (`pointer.request_body.content`).
- So the `includeImpulses` path's `SELECT id, shape, summary, content` would return `content: NONE` even for rows that do exist. This is a second reason that read cannot deliver content, independent of the empty `input_impulses`. It is inferred from one row's schema; not re-run against a row with a populated `content`.

**What survives in human-surface from earlier generations:**
- From obsidian: the honesty conventions (truncation labelled "first N of M", "pointer only" rather than "nothing produced", tool vs LLM provenance).
- From stateful-ui: the ui* shape vocabulary.
- From react-renderer: nothing by code. Its closed shape→component registry was deliberately inverted into ContentRender's closed *form* set over an open shape set.

`planContent` is a planner over *bytes already in hand*. It has no notion of fetching more of an impulse, because no address to fetch from has existed.

---

## 4. Why the surface's data keeps failing: recurring causes

Each item gives the instances it explains.

**(a) No durable, addressable home for a walk's impulse content.** Content lives in goal-host's in-process pool for the walk's lifetime. Everything a human sees afterwards is a projection with a cap:
- previews of 2,000 chars (`3cf2bdf`), for the last walk only (`mirrorWalkState` overwrite; gap `goalwalkstate-discards-prior-walk-attempts-within-a-dispatch`, open);
- `HOLLOW-CONTENT` lines of 400 chars;
- a Basis of 1,500 per shape and 3,000 total;
- `pruneStore` blanking content past the newest 100 records and deleting past 2,000.

The horizontal bundle pools only `{producedBy, executionId}` (gap `horizontal-bundle-pools-metadata-stubs-instead-of-branch-output-content`, open). There is no stream source (gap `no-content-stream-source-for-llm-or-command-output`, open).

Instances:
- `answerBody` null on 47/50 (09-06) and 43/43 unreached (10-01, 5-delivery §3);
- the 4,965-char report recoverable to 400 chars;
- "content not retained" for unwatched attempts;
- `bestOutput.ts` scraping a log line.

**(b) Delivery addressed by pinned URL, not by shape, and "accepted" means a store returned 200.**
- 248 asks at :8270 with 0 answered (09-22);
- 1,755 unreadable asks in 48 h (08-28);
- 2,873 thrown writes on node 2 (09-26→29);
- `obsidian:write_note` inferred with 0 producers.

The dossier's "missing shared capability" is a human-resolver channel addressed by shape *with a receipt of exposure*.

**(c) Each fix repaired one side of an exchange:**
- the read side (`421052c`), the reader (`6dc8107`), the dedupe (`03d98c1`) and visibility (`1704850a`), while the write address stayed pinned;
- the surface learned to render truncation honestly while the store kept truncating;
- the form learner was built while its outcome-side writer was not.

**(d) Panels and asks carry no identity or provenance.** The 7,244 human-surface panels have 10 keys (`asks, body, createdAt, id, importance, kind, revision, title, updatedAt, visibility`): no author, dispatchId or pointer. The route has no inbound auth (5-delivery §2.2). `operator:"human-surface"` is caller-asserted (proxy.ts forwards `{...req}`).

Instances:
- "Untitled"/empty panels attributed to 415655c1 by time window only;
- a READ satisfier that overwrote a live incident panel with defaults (`walk-satisfier-resolves-a-read-shape-by-issuing-a-defaulted-write…`, open);
- the human-ask route that a federated peer can redirect (REALIGNMENT §9.0, §9.5 "D held").

**(e) Test and probe residue lands in the live stores.** Of the 7,158 `info` panels, 0 have a body over 200 chars, and the non-empty ones are "Review the evidence"/"Revised" fixtures. The :8310 top-50 questions were fixtures (dossier §2.8), and there were 94k fake feedback rows (`fb042e9`). Gaps `a-human-surface-test-appends-501-fake-feedback-records…` and `a-test-process-posts-escalations-to-the-live-human-surface…` are open. Even correct content would sit behind residue.

**(f) Closed is not durable, and filed is not kept.**
- `satisfier-traces-record-no-input-impulses…` was **closed** 09-23, yet `input_impulses` is empty on every trace row (brief).
- `the-surface-has-a-render-architecture-and-no-selection-architecture` (09-06) is gone from the store: of the 660 gaps created 09-06 in the 09-11 snapshot (`substrate-live-integration/followup-2026-09-11/current-gaps.json`), **3** are present in today's 6,856-row store.
- Retirement of stateful-ui was declared (08-07) and never executed.

**(g) The surface was unauthorable by the substrate until 09-26.** It is plain files, not a submodule (memory: authorability = submodule membership). Every human-surface change in this history is an operator hand edit, and the deployed copy drifted from git, as shown by the form learner that "existed only in the container" (`e2bcb509`).

---

## 5. Acceptance criteria: "the surface renders impulses"

Each criterion is measured at two places: the human's screen (DOM in a cold browser profile, no sessionStorage) and the store that holds the bytes. Each has a positive control and a must-fail control through the same address. "Today" is the state as read on 10-02. These are criteria only; tracks 1–3 own the seams.

| # | Criterion | At the screen | At the store | Positive control | Must-fail control | Today |
|---|---|---|---|---|---|---|
| A1 | **Every impulse a run produced is readable in full, by its pointer, after the run ends**, including unreached runs, earlier attempts and horizontal-bundle branches | Opening the run in a cold browser shows each impulse with a byte count equal to the stored length, and no "first N of M" unless the human chose a preview | Resolving the impulse's pointer (by shape, through discovery) returns content whose length and hash match what the producer emitted | A reached run's `llm_completion`: hash at producer = hash at resolve = hash rendered | (i) A run older than the newest 100 records: content still resolves (today blanked). (ii) Attempt 1 of a 3-attempt run in a cold browser (today "content not retained"). (iii) A `walk-<shape>-<n>` id must resolve or the check fails (today 0 rows) | **fails** |
| A2 | **Nothing on screen comes from scraping a log line or a preview** | Every content block in the DOM carries a pointer attribute that resolves to the drawn bytes | — | A rendered block's pointer re-resolves to identical bytes | Inject a `HOLLOW-CONTENT` walkLog line with no backing impulse: the surface must draw nothing for it (today `bestOutput.ts` draws it) | **fails** |
| A3 | **Truncation is the reader's choice, not the store's** | A preview offers "load the rest"; loading it fetches by pointer and the DOM length equals the stored length | The store holds the full content: no `slice` before persistence | A 5,000-char report shown complete | A store that keeps only 2,000 chars must make A3 fail (today it would pass on wording alone, so the check must compare lengths, not labels) | **fails** |
| A4 | **Pointer-only entries say so, and resolve** | A `{producedBy, executionId}` stub renders as "pointer only" with a working fetch | The pointer resolves to the branch's real output | A single-pick step (content bound) | A horizontal-bundle branch today: stub with no resolvable content must fail | wording passes (`f8bc7d61`); resolve **fails** |
| A5 | **A delivered panel shows its author, taken from authenticated identity** | The panel header names the identity that wrote it, not a caller-supplied field | The panel record carries `author` set by the server from the validated credential (identity-vessel), plus the dispatch/pointer it came from | A walk's own delivery panel shows the dispatching identity | (i) A `uiPanel_write` with a forged `operator`/`author` field: the stored author ignores it. (ii) An unauthenticated write: refused. (iii) A write from a federated peer for a substrate-local surface: refused (REALIGNMENT §9.0/§9.5: origin from authenticated identity, target constrained to own-substrate surfaces) | **fails**: panels have no author key and the route has no auth |
| A6 | **What is delivered for a human is seen by a human** | The ask appears on a surface registered as watched, with an exposure record from a real DOM viewport | Delivery success is recorded only on an exposure receipt, not on a store's 200 | A needs-human ask written via discovery appears on :8310 and yields an exposure record | Write the same ask to a store no surface reads (:8270, or a dark node-2 unit): it must be counted as **undelivered**. Today it is counted as asked | **fails** (248 / 2,873) |
| A7 | **Any shape renders without a code change, and the decision is visible** | An invented shape renders by form, with its decision recorded | The form decision is persisted per (shape, form) and read by the learner | A known shape (`shellResult`) → terminal | An invented shape name (`escalation_kind_nobody_invented_yet` pattern) must not render blank or raw-escaped | **passes** for rendering; learning inert (A8) |
| A8 | **Rendering learns from what was shown** | — | `learnedFormByShape` changes after N answered/complained exposures carrying a DOM-read form | Seeded outcomes above the floor move a form | No outcomes: nothing moves. Outcomes without `form_source:"dom"` must not count, and today every outcome lacks it, so it should report inert, not pass | **inert** |
| A9 | **Live store is free of test residue** | Top-N questions and runs contain no fixture ids | A probe write lands in a sandbox store, not the live one | A real escalation appears | A test-suite run must leave the live journal byte-identical (today 501 fake records per run) | **fails** |

**Method notes for whoever runs these.**
- Measure at the consuming layer, the human's DOM, and at the store, never at a channel's self-report.
- Run A1–A4 on a run *nobody watched*, in a fresh browser profile; sessionStorage is the confound `b0767021` introduced.
- Split every rate by author (human-surface vs autonomous).
- Name the window. The goal-host store answers content questions for only about the newest 100 records (~8 h on 10-01).

---

## 6. Controls and limits of this track

- **Impulse-table counts** come from read-only SurrealDB SELECTs on node 1, 10-02 ~07:15Z; windows are stated. The `walk-` prefix scan has its positive control (live `cluster-shadow-`/`impulse_` ids) on the same table.
- **The `150,032/150,032` empty `input_impulses`** figure is the shared brief's measurement (tracks 1–3), not re-measured here.
- **`useImpulseContent` dead-path claim** is read against today's activity-api source: `activityExecutionTrace` returns `resolved_impulses`, while `impulses_by_id` exists only in `executionTraceWithSignatures` (since `003f477`, 04-24) and carries no content. Not exercised live; the workbench never ran.
- **No live `impulse.resolved` WS subscriber was verified, in either direction.**
- **stateful-ui figures** (805 panels, 5 feedback) and react-renderer/obsidian/workbench/dashboard commit facts come from two read-only sub-investigations this session, cross-checked against `git show` where load-bearing (`3cf2bdf`, `95adc43`, `17473c0`, `ced125b`).
- **Prior work cited, not redone:** `realignment-2026-09-29/output-shapes/5-delivery-to-surface.md`, `dossiers/human-surface-escalation.md`, `INTERACTABLE_HORIZON_2026-09-06.md`, `openspec/changes/{human-surface-stack,surface-render-contract}`, REALIGNMENT §9.0/§9.4/§9.5 (origin/dev).
