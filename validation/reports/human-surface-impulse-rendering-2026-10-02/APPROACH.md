# The human surface as a renderer for impulses — what is stored where, and the approach

2026-10-02. A read-only census in four tracks. Nothing was dispatched or written; the only live probes
were reads. This approach covers the surface (`repos/human-surface-vessel`, in this session's grant)
and lists **asks to the coordinator** for everything on the executor side (goal-host, activity-api,
the gap ledger), which that session owns.

**Evidence:**
1. [what is stored where](1-storage-map.md)
2. [what the surface reads today](2-surface-reads.md)
3. [the rendering contract](3-rendering-contract.md)
4. [history and acceptance criteria](4-history.md)

---

## 0. Two live defects in the surface, found on the way (surface grant; fix first)

### 0.1 `/api/resolve` forwards any body to goal-host with the fleet key, including from other sites
- **The forwarding.** `src/routes/proxy.ts:671` forwards the raw request body to goal-host's `/resolve`
  with `Authorization: ApiKey <METABOB_API_KEY>`. Shape types are not checked, so `goalDispatchAsync`,
  `poolImpulse_write` and every other executing shape pass through (track 3).
- **The cross-site path.** CORS only governs *reading* the response. A `Content-Type: text/plain` POST is a
  CORS "simple request", sent with no preflight. Verified with a **read** only: a request with
  `Origin: https://example.invalid` and `text/plain` got 200 and the dispatch list.
- **The consequence.** Any web page open in a browser on this host can make the surface dispatch goals or
  write impulses, as the fleet.
- **Exposure is limited to this host:** the port is bound to `127.0.0.1:18310`.
- **The fix, in the surface:**
  - require `Content-Type: application/json`, which forces a preflight that the existing origin check
    refuses;
  - refuse requests carrying a foreign `Origin`;
  - allow only the shape types the UI sends: `activeDispatches`, `goalWalkState`, `vesselCapability`,
    `goal_verification_label_write`, `poolImpulse_write`, `solicitationResponse_write` and
    `interactorObservation`. The dispatch path keeps its own route.
- **Must-fail controls:**
  - a cross-origin `text/plain` POST is refused;
  - an unlisted type (`goalDispatchAsync`) is refused.
- **Positive control:** the workbench still loads runs and posts a grade.
- This is defence in depth. It does not replace route authentication, which REALIGNMENT §9.0 requires
  of every vessel.

### 0.2 The live server is older than the repo, so every escalation card says the gap is gone
- **The mismatch.** The live `proxy.ts` (md5 `fd200aac`) lacks `GET /api/gaps/:id`, which is in the repo
  (`80a7c348`). The live UI bundle calls that route, gets the catch-all 404, and `fetchGap` reads the 404
  as "no longer in the store".
- **The fix:**
  1. diff every container `src/` file against the repo, backing up the container copy;
  2. redeploy;
  3. make `fetchGap` distinguish a route 404 from an absent gap.

## 1. What is stored where (track 1)

| What a person reads | Where it lives | How long | Addressable after the run? |
|---|---|---|---|
| Goal text | goal-host dispatch record (`goal`) | until compaction | Yes, while the record is held.<br>801 of 2,001 records have none: they are pinned-template dispatches (311 ribosome-extract runs and 490 refused scaffold-and-publish pins).<br>The record drops the template's variables and tags. |
| Each step's output, full | goal-host's **in-process** walk pool | the walk's lifetime | **No.** Pool ids (`walk-<shape>-<n>`) are per-walk counters that collide: 5,366 trace rows name `walk-goal-1`. 0 of them are in the `impulse` table. |
| Each step's output, preview | dispatch record `poolProvenance` (2,000 chars, last walk only) | newest 100 records, about 8 h; then blanked; deleted past 2,000 | Only by `goalWalkState` while held. 1,900 of 2,001 records are already blanked. |
| Judged output excerpt | `walkLog` `HOLLOW-CONTENT` line (400 chars) | same as the record | Only by scraping the log. |
| The answer | `answerBody` (built only on reach; 1,500 per output, 3,000 total) | same | Yes, when reached.<br>A floor answer is also in trace `metadata.final_text` (4,000 chars, on all 1,875 floor rows). Resolving the trace shape drops that field, and only the database-internal id form resolves. |
| Trace (steps, edges) | activity-api `execution` table | durable | **Partly.** It keeps shapes and ids but no content. `input_impulses` is empty on 150,032/150,032 rows. |
| `impulse` table | activity-api | durable | 112,976 rows in 6 bookkeeping shapes, none from a run. There is no content column; the payload sits inside `pointer`. 0 resolvable pointer types. |
| `web_search` / `llm_completion` results | nowhere | — | **No.** Producers keep no store. |
| The surface's own panels, feedback, exposure, renderPolicy | human-surface journal | durable | Yes, as `uiPanel` / `uiFeedback` / `renderPolicy`. But panels carry no author, no pointer and no dispatch link. |

**The finding:** after a run ends, **no step's output can be fetched by anything**. The surface can
only show what goal-host copied onto the dispatch record, for as long as it holds it, at the size it
copied.

## 2. What the surface reads today (track 2)

- **Display reads:** of the UI's 10, only one is an impulse fetched by pointer (`substrateGap {id}`), and that
  route is missing on the live server (§0.2).
- **The run view** is built from two goal-host records (`activeDispatches`, `goalWalkState`), four regexes
  over walk-log strings, and the browser's sessionStorage.
- **`/api/resolve` reaches goal-host only.** It returns 404 for `memoryNote`, and nothing in activity-api is
  reachable.
- **Unfaithful labels:** labels that are not shapes (`goal_reach_reason`, `human_question`) feed the form
  learner as if they were.
- **`maxPreviewChars`** is written by "preview N chars" (live value 777) and has never been read.
- **Measured** over the newest 50 runs (about 7 hours):
  - 35 have no goal text (31 are ribosome-extract);
  - of 429,964 characters of preview content, 17,067 are shown;
  - a run blanked by compaction renders empty when opened by link.
- **What already matches the contract:** `<Rendered>`, the planner tiers, the truncated and stub states, the
  form learner, and the exposure records. The rendering half is sound. What is missing is something to
  render.

## 3. The contract: the surface renders impulse *references* (track 3)

**Input: an impulse reference**, carrying:
- `impulse_id`, unique and durable;
- `executionId`, `dispatchId` and the attempt;
- `shape`, `pointer`, `producedBy` (the real producer) and `consumedIds`;
- `size` (`chars`, `truncated`, `stop_reason`);
- `at`, a `role` (answer, evidence or target), and optionally a producer-declared `contentForm`;
- for a human-originated impulse, an `author` stamped from authenticated identity.

**The rule the openspecs never stated: read, don't re-run.** Content is fetched as a **read of the recorded
impulse by `(executionId, impulse_id)`**.
- It is never fetched by sending the shape to its producer again. That would re-run `web_search` or
  `llm_completion` and show an output the run never produced.
- A read by id selects no target and asserts no origin, so it is safe under §9.0.

**Output:**
- a rendered form chosen by declaration, pin, learned table or heuristic (built, except the declared tier);
- the human's response written back as a shaped impulse that names its target impulse or execution, with a
  server-stamped author (partly built);
- exposure records keyed to impulse ids (built for questions only).

**Invariants.** Each can be enforced by a check:

| # | Invariant |
|---|---|
| C1 | No scraping: a log line is drawn only as a log line. |
| C2 | Read, not run. |
| C3 | Completeness is stated on the content: `shown`/`total`/"not retained". |
| C4 | Form by form, never by shape name, outside `renderPolicy` and producer declarations. |
| C5 | The run view is a projection of the trace's impulse graph. |
| C6 | Responses are addressed and authored. |

**My best-output block violates C1 and C4 by design.** It is a stopgap that scrapes the 400-character
excerpt because nothing better is addressable. Under the contract it is **deleted**: "best output"
becomes a lookup of the reported attempt's answer-role impulse.

**How a run should look:** a chain, not a log.
- **Goal impulse.**
- **Answer impulse,** carrying its verdict and completeness.
- **Evidence,** meaning the impulses the answer consumed, as metadata rows that load in full when expanded.
- **Other produced impulses.**
- **Provenance:** the trace and the verbatim walk log.

Order comes from edges, not from time or log position. Each attempt is its own chain. Track 3 §4 has the
layout.

## 4. History (track 4): this has never existed

- **No human surface has ever fetched a run's impulse by pointer.** The 07-27 preview commit (`3cf2bdf`)
  deferred "totality-on-demand" to an `activityExecutionTrace` read whose input list has always been empty.
  The workbench's `useImpulseContent` (04-27) read a field that was never returned, and was never deployed.
- **What each surface did instead:**
  - react-renderer: a closed map of 20 shapes, fed by pushed WebSocket events; dev-only, dropped 06-26;
  - stateful-ui: a panel store with no author or pointer, still live with 805 panels, and the sink of 248
    unanswered escalations.
- **Recurring causes:**
  - run content has no durable, addressable home;
  - delivery goes to pinned addresses, and a store's 200 counts as "asked";
  - fixes repair one side of the exchange;
  - panels carry no author;
  - test residue lands in the live stores;
  - gaps go missing: three 09-06 surface gaps are in neither store.

## 5. Approach, in order

### Surface grant (this session)

| Step | What | Depends on |
|---|---|---|
| **S0** | §0.1 proxy hardening (JSON-only, origin refusal, shape allowlist) | nothing; first |
| **S1** | §0.2 diff and redeploy the server; a missing route is not absence | nothing |
| **S2** | The rail and title show `pinned: <selectedTemplateId>` when there is no goal (the field is already on `activeDispatches`) | nothing |
| **S3** | `maxPreviewChars` gets a reader, or "preview N chars" is refused with a reason | nothing |
| **S4** | `Content` carries a reference (`executionId`, `impulseId`, `consumedIds`, `role`) and a "read in full" action through a read-only route. It is inert, and says "not retained", until C1 lands | C1 for content |
| **S5** | `bestOutput`'s shape lists move into `renderPolicy` (C4) while it exists; it is deleted when the answer-role impulse exists | C1 and C6 |
| **S6** | A "declared by producer" form tier above the heuristic | C7 |
| **S7** | The run view becomes the chain projection (§3). Until references exist, it projects `poolProvenance` with honest stubs | C1 and C5 |

### Asks to the coordinator (executor side; not edited here)

| # | Ask | Notes |
|---|---|---|
| **C1** | Pool impulses get a unique, durable `impulse_id` and a bounded **content record keyed by `(executionId, impulse_id)`**, plus a read-only shape over it | Extends `goalwalkstate-discards-prior-walk-attempts-within-a-dispatch` and agentic-floor B1. **Route auth must land with it:** goal-host reads are unauthenticated, and this widens them from previews to full content |
| **C2** | The trace resolver accepts plain `exec_…` ids and returns `metadata.final_text` | activity-api `routes/impulses.ts:918` |
| **C3** | Pinned dispatches record `targetTemplateId`, variables and tags; the trigger classifier labels ribosome callers | `index.ts:16374` |
| **C4** | Always build `answerBody`, labelled when not reached; keep earlier attempts | Already in the coordinator's plan |
| **C5** | Compaction chooses by value (human-surface runs, unreached runs with content), not recency alone | Pinned-template rows are 54 of the newest 100 |
| **C6** | Mark the answer impulse with `role: answer`; record real `producedBy` and bound `consumedIds` | agentic-floor B1 and B4 |
| **C7** | Producers may declare a `contentForm` in impulse metadata | |
| **C8** | goal-host emits `impulse.resolved`. The WebSocket event already carries a body of up to 50 KB, and nothing emits it | Lets a watching surface receive full content live |
| **C9** | Authored responses and panels: author stamped from the authenticated caller, plus a dispatch link | **Held** under §9.0 until route auth lands |
| **C10** | The surface may read activity-api's read shapes (traces, labels) through a read-only allowlist | **Held** under §9.0 |
| **C11** | Re-file the three lost 09-06 surface gaps | Gap-store integrity |
| **C12** | Docs: CLAUDE.md "Interaction surfaces" and SUBSTRATE_AS_SOFTWARE:137 name Obsidian as the human surface; the live one is human-surface | Docs-align work |

### Held
- Generic re-resolution of any `(shape, pointer)`. It executes generative shapes (C2 of the contract), and
  the registry has no read-only marker. Content is read by id instead.
- The Delivered lane (§9.5 D).

## 6. Acceptance (track 4 §5)

Each criterion is measured in a cold browser **and** at the store, with a positive and a must-fail control.

| # | Criterion | Today |
|---|---|---|
| A1 | Every impulse a run produced is readable in full by its reference after the run ends (unreached runs, earlier attempts, horizontal branches included) | **fails** |
| A2 | Nothing on screen comes from scraping a log line | **fails**; the best-output block, by design until C1 |
| A3 | Truncation is the reader's choice, not the store's; checked by comparing lengths, not labels | **fails** |
| A4 | Pointer-only entries say so, and resolve | wording passes; resolving **fails** |
| A5 | A delivered panel shows an author taken from authenticated identity | **fails** |
| A6 | A delivery counts only with an exposure receipt | **fails** (248 / 2,873) |
| A7 | Any shape renders without a code change | **passes** |
| A8 | Rendering learns from what was shown | **inert**: the form evidence writer landed in `bfb434e1`, and no outcomes have arrived yet |
| A9 | Test runs leave the live stores unchanged | **fails** (open residue gaps).<br>The surface suite's own preload isolates `WORKSPACE_ROOT`; this session's runs were host-side and isolated. |

Plus a §2.1 detector row: "a rendered content block whose reference does not resolve". Its must-fail control is
an injected `HOLLOW-CONTENT` line with no backing impulse.

## 7. Decisions (the user's)

1. **S0 and S1 now?** They are live defects in the surface grant. S0 changes what `/api/resolve` accepts.
   - Every caller found in the repo stays allowed: the UI's 7 types, and the demo2 bring-up harness, which
     posts `activeDispatches` as JSON.
   - The human-participation probes mock the route, so they are unaffected.
   - Tooling outside the repo is unknown.
2. **Should the run view move to the chain projection (S7) before C1 lands,** projecting today's previews with
   honest stubs? Or wait for content records?
3. **Should the best-output stopgap stay until C1/C6,** with its shape lists moved into `renderPolicy`?
   Or come out now, since it violates the contract?
