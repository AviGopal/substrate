# Track 2: what the surface reads today, and how

Read-only investigation, 2026-10-02 (about 07:00–08:30Z). There were no dispatches, no writes and no restarts. Every number names its denominator and window.

**Sources read.**
- **Source tree.** `repos/human-surface-vessel` working tree. For the UI files cited, its content is byte-identical (md5) to `origin/dev`, which includes 899c224d "best output".
- **Live server.** `/vessels/human-surface-vessel/src` in `substrate-live`. Its `proxy.ts` and `impulses.ts` **differ** from origin (§1.4). The live UI is the built `ui/dist` only, with no `ui/src`.
- **goal-host.** Read from the live `/vessels/goal-host-vessel/src/index.ts`.
- **Live probes.** All went through the surface's own address, `127.0.0.1:18310`.

This track **cites and does not redo**:
- `realignment-2026-09-29/output-shapes/5-delivery-to-surface.md`, referred to as **5-delivery**: answerBody on reach only, the retention table, and proposals P1/P2/P3;
- `agentic-floor/B-pool-provenance-and-trace.md`, referred to as **B**: walk pool impulses are in-process `memo` impulses, with 0 rows in `impulse`;
- APPROACH.md D;
- REALIGNMENT §9.0 and §9.5, read from `origin/dev`.

---

## 0. Answer in five lines

1. **The surface renders a dispatch record, not impulses.** Of the 10 distinct reads the UI makes for display, **1** resolves an impulse by shape and pointer (`substrateGap {id}`). That route **is absent from the live server**, so it 404s and the UI draws "The gap … is no longer in the store." (§1.4).
2. Everything on the run view comes from **2 goal-host read shapes**, `activeDispatches` and `goalWalkState`:
   - fields of the dispatch record (class b);
   - regexes over its `walkLog` strings (class c);
   - this browser's `sessionStorage` (class d).
3. **"Read in full" does not exist.**
   - No component fetches more than the preview it was handed.
   - No proxy route reaches full content.
   - `/api/resolve` is a goal-host-only pipe: `memoryNote` gets 404 "unknown shape", and the positive control `activeDispatches` gets 200 through the same address.
   - The cap is `contentPreview.slice(0, 2000)` in goal-host `mirrorWalkState`.
4. **For walk output there is nothing to fetch.**
   - Pool impulses are `pointer:{type:"memo"}`, which means the content is carried, not addressed (B §1).
   - Their ids are per-walk counters that are never persisted.
   - The only durable copy is the 2,000-char preview, which `pruneStore` blanks past the newest 100 records.
   - So "resolve lazily by pointer" has **no referent**. The gap is a missing object, not a missing route.
5. **The render pipeline is already ready for full content.**
   - `Content.size`, `state:"truncated"`, and the planner's S3 to S4 path all exist.
   - What is missing is an addressable object (a coordinator ask) and a ref-carrying fetch (inside the surface grant).
   - A generic `(shape, pointer)` render route is **§9.0-HELD**: the surface has zero inbound auth, and the registry has no read-only marker, so resolving a generative pointer would *execute* it.

---

## 1. Inventory of reads

Classes:
- **(a)** an impulse resolved by shape/pointer;
- **(b)** a field of the dispatch record;
- **(c)** a scraped walk-log line;
- **(d)** the surface's own store, server side or browser side;
- **(r)** registry metadata. This is a fifth bucket, named honestly: a shape listing is not an impulse.

### 1.1 Browser → surface server (display reads)

| # | UI call (file) | Server route → upstream | Located how | UI fields used | Class |
|---|---|---|---|---|---|
| 1 | `fetchActiveDispatches` (`api/client.ts`), rail | `POST /api/resolve {type:"activeDispatches"}` → goal-host `/resolve` | Discovery `vesselCapability goal_execution`. Every candidate is probed with a real `activeDispatches` call. Explicit `GOAL_HOST_ENDPOINT` env wins. Falls back to `GOAL_HOST_ENDPOINT` / loopback **(pinned fallback)**. | `goal` (`slice(0,200)` upstream, null when absent), `status`, `reached`, `operator`/`trigger`, `startedAt`, `answerBody` / `executionId` / `selectedTemplateId` (fingerprint only) | b |
| 2 | `fetchWalkState` (`api/client.ts`), run view, plus ≤6 live rail rows | `POST /api/resolve {type:"goalWalkState",dispatchId}` → goal-host | same | every field of `GoalWalkState` (§2) | b (+c, +d derived) |
| 3 | `fetchFleetShapes`, starter chips | `GET /api/discovery/shapes` → `DISCOVERY_ENDPOINT/registry/shapes` | configured discovery (bootstrap) | `shapes[]` | r |
| 4 | `fetchCapability`, starter refinement | `POST /api/discovery/resolve {pointer:{type:"vesselCapability",shape}}` → discovery `/resolve` | configured discovery | `content.vessels.length` | a |
| 5 | `fetchRenderPolicy`, every `<Rendered>`, tokens, presentation | `GET /api/render-policy` → `getRenderPolicy()` in-process | own store | `formByShape`, `learnedFormByShape`, `tokenOverrides`, `presentation`, `revision`. **`maxPreviewChars` and `ledgerDefaultExpanded` are never read** (§4.3). | d |
| 6 | `fetchGaps` (`IssuesDrawer.tsx`) | `GET /api/gaps` → `substrateGap {category:"ui_legibility",limit:40}` on each discovered producer | discovery `substrateGap`, then **`DEV_VESSEL_ENDPOINT` ?? `127.0.0.1:8090` (pinned fallback)** | `id, status, source, category, summary` | a |
| 7 | `fetchGap(id)`, question escalation outcome | `GET /api/gaps/:id` → `substrateGap {id, limit:1}` | same, with pinned fallback | `status`, `classification_metadata` | a: **the only shape+pointer read on the surface. Absent live (§1.4).** |
| 8 | `fetchQuestions` (`api/participation.ts`) | `GET /api/questions` → in-process `uiQuestion` (`impulses.ts`) | own store (panels written by others through `uiQuestion_write`) | `questions[]` (`body` is a string in 50/50), `ranking` | d |
| 9 | `useStoreStream` (`state/stream.ts`) | `GET /api/stream` SSE | own store events | event names only; invalidates queries 5, 8 and gaps | d |
| 10 | `segmentAttempts` (`lib/attempts.ts`) | `sessionStorage["sf.attempts.<dispatchId>"]` | this browser | earlier attempts' `poolProvenance` / `steps` as seen while live | d (browser) |

**Counts over the 10 display reads:**
- a = 3 (#4, #6, #7), of which only #7 addresses one impulse by pointer;
- b = 2 (#1, #2);
- d = 4 (#5, #8, #9, #10);
- r = 1 (#3);
- c = 0 as routes. Class c is not a route. It is a **parse of #2's `walkLog` field** with 4 consumers (§1.3).

By what the run view *draws* (§2), b and c dominate. Of 16 run-view and rail elements, 13 depend on #2, and none depends on an impulse resolve.

### 1.2 Writes, listed only so the read inventory is complete

These are not exercised.
- `POST /api/run-goal` → `goalDispatchAsync`.
- `/api/resolve` with `poolImpulse_write` / `solicitationResponse_write` → goal-host.
- `/api/grade` → activity-api `goal_verification_label_write`, using **pinned `ACTIVITY_API_ENDPOINT` ?? `127.0.0.1:8080`**.
- `/api/feedback`, `/api/participation`, `/api/observations`, `/api/surface-intent`: self-posts into the surface's own `/v2/impulses/resolve`.

`/api/state`, `/api/signature-inputs` and `/api/executions/:dispatchId` have no UI caller.

### 1.3 The class-c consumers (regexes over `walkLog` strings)

| Consumer | Regex | Feeds |
|---|---|---|
| `detectSolicitation` (`lib/walk.ts`) | `/(solicit|awaiting … human|human_input|asked you)/` + an id regex | "waiting" badge, SolicitationPanel. Its own header says: "goalWalkState does NOT carry pending solicitations … the walk log is the only signal". |
| `hollowVerdicts` (`lib/attempts.ts`) | `HOLLOW — (.+?)` | per-attempt verdict, and the `reported` attempt matched against `goalReachReason` |
| `hollowVerdicts`, judged excerpts | `HOLLOW-CONTENT (\S+) \((\d+) chars\) = …` | Best output. goal-host logs `_hc.slice(0, 400)` (live `index.ts:11336`). |
| `restartReasons` | `FEEDBACK-RETRY`, `re-framing …`, `fallback` | attempt headings |

All four parse log prose that goal-host writes for operators. Rewording any of those log lines breaks the surface silently, because nothing on the wire is typed.

### 1.4 Finding: the one pointer-addressed read is missing on the live server and reads as absence

- **The bundle calls the route.** The live bundle `ui/dist/assets/index-Aad5Q5I3.js` contains `/api/gaps/${encodeURIComponent…`.
- **The live server does not serve it.** Live `src/routes/proxy.ts` (md5 `fd200aac`, against `80a7c348` on origin) lacks the `GET /api/gaps/:id` route (diff: origin adds lines 1010–1057).
- **Measured on the same address:**
  - `GET :18310/api/gaps/some-id` returns **404** `{"error":"not found"}`. This is the catch-all, not the route.
  - `GET :18310/api/gaps` returns **200** with gaps (positive control).
- **The UI reads the 404 as absence.** `fetchGap` maps 404 to `null`, which means "the store answered and has no such gap" (`api/client.ts`). `EscalationOutcome` (`components/ResponseForms.tsx:58`) then draws: "The gap {gapId} is no longer in the store." So on the live surface every escalation card (`needs-human-*` / `reland-needs-human-*` panels, via `gapIdForPanel`) tells the person that its gap is gone.
- This is the "negative is unattributed" class again, and the cause is a half deploy: the dist was updated and the server src was not.
- `impulses.ts` also differs live: `feedbackGapId` has not been extracted there.

**Surface-grant fix.**
1. Redeploy the server src together with the dist.
2. Make `fetchGap` distinguish the route-absent 404 (a body with no `gap` key) from the store's `{gap:null, error:"no gap with that id"}`.

---

## 2. Run-view and rail elements, end to end

**Live window for the counts below.** `activeDispatches` with no limit returns the default 50. That is the newest 50 of 2,001 stored records. `startedAt` runs from 1790900825042 to 1790926743526 (about 7.2 h, ending about 07:59Z on 10-02). `goalWalkState` was read for all 50.

| Element | Data path | Class | What breaks it (measured or by source) |
|---|---|---|---|
| **Rail title** (`RunRow`) | `activeDispatches.goal` ← `r.goal.slice(0,200)` | b | **35/50 rows null, which renders "goal text not recorded".** 31 of them are `selectedTemplateId:"ribosome-extract"`, `trigger:"run-goal"`: templateId dispatches with **no goal text by construction**. The other 4 have a null template. The row already carries `selectedTemplateId` and does not render it. The 200-char slice drops the rest of long goals. |
| **Rail state badge** | `status`, `reached` (b); for ≤6 running rows, also `goalWalkState` → `detectSolicitation` (c) + a client progress fingerprint | b+c | Only the newest 50 records are ever listed: the UI sends no `offset`, and goal-host caps `limit` at 50. A solicitation is detected only if its log line survives `walkLog.slice(-60)`. |
| **Rail reason tooltip** | `verdictSentence(goalReachReason)` from the walk query, which is enabled only for live, running rows | b | Terminal rows never fetch the walk, so their tooltip has no reason. |
| **Run title** | `goalWalkState.goal`. Serialized bare, so the key is absent when undefined. | b | Same template-dispatch absence. In the window, 35/50 records have the key absent. |
| **State badge** | `deriveRunState(status, reached, solicitation, progress, quietFor)` | b+c | Stall is inferred from fingerprint silence, not from any field. |
| **Reason** | `goalReachReason ?? error` → `fromText("goal_reach_reason")` | b, under an invented shape | Compaction keeps `goalReachReason`. The 400-char-class cuts are upstream. |
| **Human notes** | `humanReachNotes` | b | — |
| **Walk needs** | `pendingTargets` | b | Mirrored each iteration. Empty when the record is compacted. |
| **Solicitation panel** | `detectSolicitation`. Evidence is the raw log line → `fromText("solicitation_evidence")`. | c | The question text itself is posted to a separate sink and never reaches the record (walk.ts header). The answer form needs an id that is regex-extracted, and may be null. |
| **Answer** | `answerBody` → `AnswerBody` segmenter; machine blobs → `fromResponse(declaredShape ?? "goal_answer")` | b | Built **only when `reached === true`** (5-delivery §1.1). The Basis is capped at 1,500 per shape and 3,000 in total. In the window it is non-null on 9/50. |
| **Best output** (899c224d) | `pickBestOutput`, in this order: `HOLLOW-CONTENT` 400-char excerpt (c), sessionStorage copy (d), current `poolProvenance` preview (b). Drawn via `fromText(best.shape, …)` with `origin:"text"`. | c+d+b | Labels scraped log text with the **real** shape but `origin:"text"`, so it is not an impulse. In the window, 9 HOLLOW-CONTENT lines exist across 50 records. |
| **Trace: impulse rows** | `poolEvents` (`{shape, source, at}`, capped at the last 64, no content) joined first-unused-by-shape to `poolProvenance` (`{shape, goalSignature, producedBy:"goal-host-walk", contentPreview≤2000, chars, truncated}`, **last walk only**) → `fromLedgerEntry` | b | **14/50 records carry any provenance.** They hold 72 entries, **4 truncated**, max `chars` **396,341** (the preview is 0.5%). Σchars = 429,964 against Σshown = 17,067 (4.0%). |
| **Trace: step rows** | `steps[]` (selected / candidates / α β) | b | Blanked by compaction. |
| **Attempt segments** | seed-burst boundaries in `poolEvents` (b) + `hollowVerdicts` / `restartReasons` (c) + `sessionStorage` (d) | b+c+d | Earlier attempts' content exists only if *this* browser watched (5-delivery §1.2). The 64-event cap makes the first segment `partial`. |
| **Walk log** | `walkLog.slice(-60)`, drawn verbatim | c (shown raw) | Blanked by compaction. |
| **Grade** | `executionId` → `/api/grade` | b | — |

**Two separate retention cliffs.**
- **Compaction (goal-host `pruneStore`, live `index.ts:17880`).**
  - Past the newest 100 records it blanks `walkLog`, `steps`, `poolProvenance` and `poolEvents`. Past 2,000 it deletes the record.
  - Measured: the record at `offset:150` returns `poolProvenance 0, poolEvents 0, walkLog 0, steps 0, goalReachReason null`. The positive control is the 14 of the newest 50 that do carry provenance.
  - **The rail lists 50 records and compaction starts at 100.** So a compacted run is reachable only through a `/run/$dispatchId` deep link, and there it renders "No impulses recorded" with no best output. A record deleted past 2,000 gives "Could not read this run".
- **Floor runs.** The floor keeps no pool, so a universal_tool_fallback run shows an empty trace. Its `final_text` lives only in trace metadata (capped at 4,000) or in answerBody on a reach (B §1, §2). 0/50 runs in the window took that path.

---

## 3. The render pipeline

### 3.1 Adapters and what feeds them

| Adapter (`lib/content.ts`) | Callers | Input is… | Shape key used |
|---|---|---|---|
| `fromLedgerEntry` | `Trace.tsx` ImpulseRow (`region:evidence_ledger`) | a **preview of a pool impulse**, ≤2,000 chars, from the dispatch record | the real pool shape |
| `fromResponse` | `Answer.tsx` segments (`answer_card`); `QuestionView` history (`response_history`) | answerBody fragments; a human's reply value | the blob's declared `shape`, else **`goal_answer`**; **`human_contribution`** (invented) |
| `fromPanel` | `QuestionView` body (`question_card`); `QuestionsList` `data-form` | panel body string from the surface's own store | **`human_question`** (invented) |
| `fromText` | RunView reason (`run_reason`), SolicitationPanel, IssuesDrawer (`issue_card`), BestOutput (`best_output`) | prose or a scraped log excerpt | **`goal_reach_reason`**, **`solicitation_evidence`**, **`interface_gap`** (invented); BestOutput uses a real shape on scraped text |
| `fromProvenance`, `fromLog`, `fromStream` | **0 callers** | — | `walk_log` (invented). The stream slot has no source: open gap `no-content-stream-source-for-llm-or-command-output`. |

**Which inputs are impulses with a shape.** Only the trace rows, and the answer-card blobs that declare `shape`. Even those are previews of impulses, not impulses. Everything else is text under an invented label.

**Where the labels go.** They are recorded by `FormDecisionRecorder` with `shape` as the corpus key (`lib/form-decision.ts`: shape, content_signature, form, decided_by, policy_revision, region). That key space is the one `form-learn.ts` writes into `renderPolicy.learnedFormByShape`. So "goal_reach_reason" can earn a learned form exactly as `shellResult` can. Once one adapter carries a real impulse ref, it should be keyed differently from these labels; this is proposal S3.

**The one pointer-aware draw.** It is ContentRender `Stub` (`f8bc7d61`). It recognises the pooled stub `{producedBy, executionId}` and says "Pointer only — X's output was not carried into this run", with nothing clickable. In the window, **2 of 72** preview entries are stub-like. This is the existing seam where a "read in full" action would attach.

### 3.2 `planContent` tiers (`lib/ledger.ts`)

- **S0** empty.
- **S1** human pin (`formByShape[shape]`).
- **S2** learned (`learnedFormByShape[shape]`).
- **S3** truncated: the payload of a cut command envelope, else `parsePartialJson` whole members, else heuristic.
- **S4** complete: parse, then stub / command envelope / resolver `{success,shape,body}` / content wrapper / error / single-key / record.
- **S5** heuristic on non-JSON.

All tiers key on `content.shape`. Live render policy: revision 17440, `formByShape {}`, `learnedFormByShape {}`. Both tiers are empty, so every draw today comes from the envelope or heuristic tiers.

### 3.3 Is there a "read in full" path?

**No.** All of the following were checked:
- `<Rendered>` shows `first N of M chars` (`completeness()`) and a copy button, and has no fetch.
- No UI file references an impulse id, a pointer fetch, or any route beyond §1.
- The server exposes no route to full content.
- `/api/resolve` forwards only to goal-host, which serves no per-impulse read.

**The one documented "totality" path is dead.** goal-host's own comment at `mirrorWalkState` says "totality-on-demand is a separate `activityExecutionTrace(format:'json')` read". Prior art, the workbench's `useImpulseContent` (`repos/workbench`, 17473c0), did exactly that, with `activityExecutionTrace {executionId, includeImpulses:true}` → `impulses_by_id[impulseId]`. It is dead at both ends on the live activity-api:
- `impulses_by_id` is **signatures only**: `{pointer_type, shape}` (`execution-trace-with-signatures.ts:777-807`).
- `includeImpulses` loads `trace.input_impulses` (`routes/impulses.ts:935`), which is empty on 150,032/150,032 rows (B §0.3). Satisfier traces have `output_impulses: null` (5-delivery §1.3).

### 3.4 `maxPreviewChars` is written and never read

`surfaceIntent` parses "preview N chars" into `renderPolicy.maxPreviewChars` (`surface-intent.ts:633-644`). The live value is **777**.

`git log -G '\.maxPreviewChars' -- repos/human-surface-vessel/ui/src` finds **no read in any commit**. The field has been declared on `RenderPolicy` since `1098380a` (08-07) and has never been consumed. `ledgerDefaultExpanded` is also **currently unread**: it appears only in its type declaration in today's tree. History was not checked for that field.

A human's instruction to change the preview length has therefore moved nothing, while the surface reports it as applied (`kind:"reshaped"`). This is the `hollow_write` class. It is surface-grant work: give the field a reader, or refuse the instruction.

---

## 4. What rendering any impulse given (shape, pointer) would need

### 4.1 The object does not exist for walk output

| Candidate store | Holds full content? | Addressable? | Evidence |
|---|---|---|---|
| goal-host in-memory `poolImpulses` | yes | only during the walk, as a closure-local array | B §1 |
| goal-host dispatch record (`/workspace/goal-host-dispatches.json`) | no: ≤2,000 chars per impulse, last walk only | by `dispatchId` + array position | `mirrorWalkState`; `pruneStore` |
| activity-api `impulse` table (112,975 rows) + `GET /v2/impulses/:id` | returns `impulse.content` when a row has it. The sampled row's keys were `pointer, shape, summary, metadata…` with no `content` key, so "the sampled row carries none", not "the table stores none". | yes, by id | `walk-*` ids: 0 rows (B §0.4) |
| activity-api trace store | no (shapes, `output_impulses: null`) | by execution id | 5-delivery §1.3 |
| development-vessel `poolImpulse` (`standing.json`) | yes, `body` | by `id` | a single JSON file rewritten whole; not a fit for 400 KB walk output |

So for walk output, "resolve lazily by pointer" has no referent. A pool impulse's pointer is `{type:"memo"}`: its content was carried, not addressed.

For impulses whose pointer *is* an address, a re-resolve does work. Examples are `memoryNote {id}`, `substrateGap {id}`, a file path and a trace id. For those, the existing discovery resolve path is the fetch.

### 4.2 Which resolve path, auth and size

- **Path.** For goal-host-held content, use the existing `/api/resolve` → goal-host proxy, by `dispatchId`. That is the same address the run view already reads, so **no new address becomes resolvable**. For addressable shapes in general, use discovery `vesselCapability` → the producer's `resolve_endpoint`. This is the logic already in `candidateEndpointsFor`, which handles libp2p ingress rows and per-row paths.
- **Auth (§9.0).**
  - The surface has **no inbound authentication on any route**: no middleware in `src/index.ts`, and UI calls use `credentials:"same-origin"` only.
  - It injects `METABOB_API_KEY` on every upstream call.
  - From source read, not exercised: `/api/resolve` forwards **any** body to goal-host, including `goal_execution` and `activity_execution`. That is pre-existing.
  - Identity already serves `/v1/auth/login`, `/v1/jwt/verify` and `/v1/auth/me`. The surface uses none of them.
  - On this node `:18310` listens on `127.0.0.1` only, but the server binds `HOST ?? "0.0.0.0"` inside the container.
  - A generic `(shape, pointer)` browser route would be exactly the "makes an address resolvable" seam that §9.0 holds.
- **Locality and side effects.**
  - Registry rows carry `origin:"local"` (seen on `memoryNote` rows), which is usable for the own-substrate allowlist.
  - Rows carry **no read-only or idempotent marker**: the keys are `auth_*, confidence, distribution_policy, endpoint, origin, resolve_*`. A pointer for `llm_completion`, or any generative shape, would **execute** rather than read.
  - The set of re-resolvable shapes must therefore be an explicit allowlist, held as a shaped policy (law 1), never inferred.
- **Size.**
  - In the window the largest pool impulse is 396,341 chars, and the 72 entries total 429,964 against 17,067 shown.
  - The surface server has `idleTimeout` 30 s, and goal-host persists its store every 5 s as one 3.3 MB file (5-delivery §1.3).
  - A full read therefore needs a **ranged** contract: `{offset, length}` returning `{text, total}`, with the cap stated.

### 4.3 How the planner would take it

No planner change is needed:
- A ranged chunk arrives as `state:"truncated"` with `size:{shown,total}` and goes through S3.
- The completed read flips to `state:"full"` and goes through S4 `planText`.
- `<Rendered>`'s completeness strip already says `first N of M`.

The only additions are:
- a `ref` on `Content`, for example `{shape, pointer, via:"goalWalkState"|"discovery"}`;
- an action in the strip, shown when `state==="truncated" && ref`;
- recording the read in full in the form-decision row, so the corpus can tell a preview plan from a whole-content plan.

---

## 5. Prior art, and what happened last time

- **workbench `useImpulseContent`** (17473c0, "impulse content inline in task OutputLayer"). It built the lazy fetch on `activityExecutionTrace includeImpulses`. It went dark because the trace store stopped carrying impulse content and ids (§3.3). Reusing that route would reproduce a dead read.
- **react-renderer** (`repos/react-renderer`, 3 commits, last 04-30; **not deployed**, 0 entries in `/vessels`). The design intent is "Delegation, Not Ownership — resolves pointers to data owned by other vessels". Its `/resolve` dispatches to a **local** resolver registry (`hasResolver(pointer.type)`), not to discovery, and it targets `ui_component` impulses. It is intent-level prior art only, with no reusable fetch.
- **openspec `surface-render-contract/design.md`.**
  - It defines `Content`, densities, the `truncated` state and `first N of M` exactly as built. It has **no ref or lazy-read slot**.
  - `human-surface-stack` and `do-anything-surface` have none either. Their grep for pointer, totality or expand finds only UI-freeze "pointer" hits.
- **2026-09 surface commits.** `b81ac262` (render contract), `b0767021` (trace keeps every attempt via sessionStorage), `4f8a2a72` (which attempt is reported), `f8bc7d61` (pointer stub), `899c224d` (best output from walk-log excerpts). Each one routes *around* the missing object on the client. None of them adds a fetch.
- **Gap store** (6,856 rows):
  - Open `goalwalkstate-discards-prior-walk-attempts-within-a-dispatch`, edit_site goal-host. This is the retention item: **extend it, do not mint.**
  - Open `no-content-stream-source-for-llm-or-command-output` covers the stream slot.
  - Open `the-live-human-surface-is-unreachable-by-every-substrate-edit-lane`: the substrate cannot author this vessel, so surface items are operator-built.
  - Open §9.0 family: `development-vessel-resolve-route-is-unauthenticated…` and `substrate-local-shapes-must-resolve-only-to-own-substrate-producers`.
  - No gap names the surface's lack of auth, the missing live `/api/gaps/:id`, or the dormant `maxPreviewChars`.
- **Already proposed elsewhere** (cited, not restated):
  - 5-delivery **P1**, best output, has shipped as 899c224d.
  - 5-delivery **P3** and APPROACH D "always build answerBody": retain the best attempt's full content.
  - 5-delivery **P2**, the delivered-panels lane, is HELD.
  - §9.5 D, delivery by origin, is HELD.

---

## 6. Proposals

### S1. The rail and title render what the record has. **New. Surface grant.**

- **Seam:** `RunRow.tsx` and `RunView.tsx` title.
- **Change:** when `goal` is null, draw `selectedTemplateId`, labelled "template run", plus `trigger`, instead of "goal text not recorded".
- **Gate:** deterministic. Never synthesize goal text.
- **Verify:**
  - Positive: the 31 `ribosome-extract` rows render the template id.
  - Must-fail: a row with both null still says "not recorded".

### S2. Make the one pointer read honest. **New. Surface grant.**

- **Seam:**
  - Redeploy the live `src/routes/proxy.ts` to match origin. It is missing `GET /api/gaps/:id`.
  - In `api/client.ts` `fetchGap`, treat a 404 without a `gap` key as a route failure, not absence.
- **Verify:**
  - Positive: an existing gap id returns 200 with `gap`.
  - Must-fail: against a server without the route, the card shows "could not read", not "no such gap".
- **Detector for the class (law 6):** a deploy check that every `/api/*` path referenced in the dist bundle answers something other than the catch-all 404 on the live server.

### S3. `Content.ref` and the "read in full" action. **New. Surface grant.** Inert until C1 lands.

- **Seam:**
  - `lib/content.ts`: add an optional `ref` and stop using `origin:"text"` for impulse-derived text, as in BestOutput.
  - `Rendered.tsx` `completeness()`: add the action.
  - `ContentRender` `Stub`: add the action.
- **Fetch:** only through the existing goal-host proxy (`goalWalkState`-family read by `dispatchId`). There is no generic route, so §9.0 is not tripped.
- **Gate:** the planner path in §4.3. A ranged read stays `truncated` until `shown === total`.
- **Verify:**
  - Positive: a 396 K-char impulse renders in chunks up to `total`.
  - Must-fail: a `memo` impulse with no ref shows no action, and an invented-label `Content` never gets a ref.

### S4. `maxPreviewChars` gets a reader or a refusal. **New. Surface grant.**

- **Seam:** `planFor` / `Rendered` (display clamp with a stated cut). Alternatively, `surface-intent.ts` refuses "preview N chars" until a reader exists.
- **Verify:**
  - Positive: policy 777 changes the drawn length.
  - Must-fail: removing the reader makes `surface-intent` refuse.

### C1. Pool impulses get a durable address and bounded full content. **Coordinator ask.** Extends `goalwalkstate-discards-prior-walk-attempts-within-a-dispatch` and 5-delivery P3.

- **Seam:** goal-host `mkImpulse` / `mirrorWalkState`, plus a read on the existing goal-host shape.
- **Change:** give each pool impulse a stable `(dispatchId, attempt, seq)` address, which replaces the colliding `walk-<shape>-<n>`. Retain content with a **stated** cut, carried as `cuts[]` per §9.2. Serve a ranged read, for example `goalWalkState {dispatchId, impulse:{attempt,seq}, offset, length}`.
- **Retention:** `pruneStore` keeps the reported attempt's addressed content as it keeps `answerBody`.
- **Not** the trace store. Memory law: the trace store is for gradable executions, and SurrealDB memory pressure is measured.
- **§9.0.** C1 is pull-only by `dispatchId` and creates no new resolvable address, so it is not held. **The exposure is pre-existing, not introduced:** goal-host read routes are unauthenticated today. So C1 widens what any caller holding a `dispatchId` can read, from a 2,000-char preview to full content. goal-host route authentication (§9.0) covers it, and it should land before or with C1. This mirrors 5-delivery P3's note.
- **Verify:**
  - Positive: a cea3f4a4-class replay serves attempt 2's 4,965 chars by address after attempt 3 mirrors.
  - Must-fail: the id of an attempt-3 impulse never returns attempt-2 content (no id collision), and `reached` / α are unchanged.

### C2. A read-only, own-substrate allowlist for re-resolvable shapes, plus surface authentication. **Coordinator ask. §9.0-HELD** until route auth and locality land.

This is the precondition for any generic `(shape, pointer)` render.

- **Preconditions:**
  1. Surface login through identity (`/v1/auth/login` → JWT, validated server-side through `/v1/jwt/verify`), with the caller identity stamped server-side.
  2. A shaped `readableShapes` policy listing shapes whose pointer is an address and whose resolve has no side effects. The candidates are `memoryNote`, `substrateGap`, `fileContent`/`fs_read`, and trace by id.
  3. Producers restricted to `origin:"local"` rows.
- **Verify, must-fail:**
  - an unauthenticated `(shape, pointer)` read is refused;
  - an `llm_completion` pointer is refused with no upstream call;
  - a foreign-origin producer row is skipped.
- **Verify, positive:** an authenticated `memoryNote {id}` renders through `<Rendered>` with `ref`.

**Not proposed:** a browser-wide passthrough to `activity-api GET /v2/impulses/:id`. Walk output is not there. And the route's API-key branch queries without an org predicate (`routes/impulses.ts:647-668`: the org clause is added only for JWT callers).
