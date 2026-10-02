# 5 — How a walk's useful output reaches the human (delivery to the surface)

Read-only investigation, 2026-10-01 (~11:10Z). Track: the link between "the walk produced something
readable" and "the person who asked on the human-surface workbench sees it". No dispatches, no writes,
no restarts. Every number names its denominator and window.

**Versions read.** goal-host was read twice. The local checkout is `repos/goal-host-vessel@7d38196`. The
live runtime copy is `/vessels/goal-host-vessel/src/index.ts`, which has no `.git` and a different md5;
its line numbers sit about 93 lines below the local ones. Both are cited as `local:N / live:N`.
human-surface was read from `repos/human-surface-vessel`, which is plain files in the super-repo. The
live `/vessels/human-surface-vessel` differs only in the complaint helper, not in the panel paths.
**The governing doc's §9 is not in local HEAD.** The local `REALIGNMENT.md` (5211b8b3) ends at §8.
§9.0 and §9.5 were read from `e028a7f9` on `origin/dev`, and APPROACH.md and D-delivery-targets.md
from `origin/dev` too. The local super-repo checkout is behind origin.

---

## 0. The two dispatches, end to end

| dispatch | attempts | reached | answerBody | what the walk actually produced |
|---|---|---|---|---|
| `cea3f4a4` | 3 walks (main, FEEDBACK-RETRY, re-frame), attempt_count 7 | false | null | Attempt 1: a 4,218-char report. Attempt 2: a **4,965-char, correctly dated (1 Oct 2026), sourced report** (Al Jazeera etc.), judged HOLLOW. Attempt 3 (re-frame to `memoryNote_write`): a 3,182-char **stale "June 7, 2024"** completion, plus a 1-item memoryNote. |
| `5bef2e86` | attempt_count 6 | false | null | Placeholder templates (`[Current Date]`, `Headline 1`). The 2,023-char "Thursday, October 1, 2026" headline list has unverified content. The last (re-frame) attempt's llm_completion, as held in `poolProvenance`, was a refusal ("I'm unable
to browse the web"). |

Both inferred the terminal `obsidian:write_note`. Both walkLogs carry the same `goal-target inference`
line, with alternatives `[web_search, llm_completion, memoryNote_write]`. That shape has **0 producers** (`discovery /resolve
vesselCapability`). Every walk therefore terminated "no pick", and the reach judge graded the leftovers.

**Where cea3f4a4's best output survives today:**
- **Dispatch record.** `poolProvenance` holds only the **last** walk, the stale June-2024 one, as a
  2,000-char preview. Attempt 2's content is gone (see §1.3).
- **walkLog.** One `HOLLOW-CONTENT llm_completion (4965 chars) = …` line, cut to **400 chars**
  (local:11234 / live:11327).
- **Trace store.** `GET :8080/v2/activities/execution-traces/<id>`, authenticated:
  - `exec_b2su9vgo`: shapes only, `input_impulses: []`, failure "Resolver 'obsidian:write_note' is not
    registered".
  - The `satisfier:llm_completion` trace `walk-satisfier-2-1790845081179`: `output_impulse_shapes:
    ["llm_completion"]`, `output_impulses: null`, so **no content**.
- **Browser sessionStorage** (`sf.attempts.<id>`): only if a browser was watching while attempt 2 was
  current.

So the 4,965-char report is **unrecoverable server-side beyond 400 chars**. The run view's "attempt 2 of 3
reported" points at an attempt whose content the server no longer holds.

---

## 1. goal-host: where `answerBody` is set, and what is retained

### 1.1 `answerBody` is built only on reach

| site | local / live | condition |
|---|---|---|
| walk path | 11355-11363 (Basis cap at 11361) / 11448-11456 | `if (reached === true) { answerBody = [# goal, verdict.reason, "## Basis\n\n" + poolDigestHuman.slice(0, 3000)] ; addToPool("goal_answer", …) }` |
| human_presentation | 11368-11377 | in the same reached branch |
| floor (ReAct fallback) | 5523 / 5616 | `reached: true, answerBody: authoredFinalAnswer ? finalText.trim() : undefined`. The unreached return (`return null`) carries nothing. |
| record | 16771 / 16864 | `if (seek.answerBody) record.answerBody = seek.answerBody` |
| served | `/executions/:id` 17882 / 17975; `goalWalkState` 17157 / 17250; `activeDispatches` 17131 | `answerBody ?? null` |

**Why both records are null.** `reached === false` on every walk, and no other code path assigns
`answerBody`. Shape plays no part: the gate is the verdict alone.

**The Basis is itself truncated.** `poolDigestHuman` caps each pool shape at `slice(0, 1500)`
(local:10975 / live:11068), and the Basis caps the whole at `slice(0, 3000)`. It also includes the
`dispatch_id` UUID and raw JSON envelopes. In the positive controls below, the Basis opens with the
dispatch UUID and then `{"success":true,"shape":"llmTextCompletion",…`.

So even if cea3f4a4 had reached, the 4,965-char report would have been delivered as its first 1,500
chars. Retaining `answerBody` for unreached runs without lifting this cap would retain a stub. (Class C,
the judge seeing 1,500 chars, is the same cap read by a different consumer: APPROACH.md "C".)

### 1.2 Retries replace the reported walk; a failed re-frame does not

- FEEDBACK-RETRY: `walk = fbWalk.attempts > 0 ? fbWalk : walk` (local:13240 / live:13333). The retry's
  verdict becomes the run's verdict.
- Re-frame: its result is returned only `if (altWalkResult.reached && altHasSubstance)` (local:13402 /
  live:13495). Otherwise the record keeps the retry's `goalReachReason`.

But `mirrorWalkState` (local:9714-9751 / live:~9810-9844) has already overwritten `rec.poolProvenance`
and `rec.steps` with the re-frame's pool. The result is that the record reports attempt 2's verdict and
carries attempt 3's content. The surface's `segmentAttempts` (ui/src/lib/attempts.ts:192-205) correctly
marks attempt 2 as `reported`, but the server can no longer supply attempt 2's content. Only `poolEvents`
(shape, source, at; no content) accumulates across walks.

### 1.3 Retention

| store | what it keeps | for how long |
|---|---|---|
| `executionStore` / `/workspace/goal-host-dispatches.json` (3.3 MB, 2,001 records, persisted every 5 s) | `poolProvenance` (2,000-char preview per impulse, **last walk only**), `walkLog` (`stepSink.slice(-60)`), `steps`, `poolEvents`, `answerBody` | `pruneStore` (local:17779-17796 / live:17872-17883): beyond the newest **100**, it blanks `walkLog`, `steps`, `poolProvenance` and `poolEvents` (`compacted: true`). Beyond **2,000** it deletes. `answerBody` and `goalReachReason` survive compaction. |
| goal-host in-memory `poolImpulses` | full content | for the walk's lifetime only |
| `/executions/:id` response | no `poolProvenance` or `poolShapes` at all: key by key, verdict + walkLog + answerBody | as the store |
| `goalWalkState` (what the surface reads) | the above + `poolProvenance` + `walkLog.slice(-60)` | as the store |
| activity-api trace store | shapes, tasks, failure_mode; **no impulse content** (`input_impulses: []`, `output_impulses: null` for satisfiers) | retention sweep |

Live measure (2,001 records, window 2026-09-28T03:12Z..10-01T11:06Z): **1,900 compacted**. Only the 101
newest (10-01 02:55Z..11:06Z, about 8 h) still carry any content preview. **Full untruncated pool content
is not retained anywhere after a walk ends.**

---

## 2. Who serves the delivery shapes, and what the surface does with them

### 2.1 Registry (discovery `/resolve vesselCapability`, in-container, authenticated)

| shape | producers |
|---|---|
| `uiPanel_write` | 11 rows, **first row `stateful-ui-vessel` :8270**. Also: dev-vessel-local (`host.containers.internal:18090`), `human-surface-vessel` :8310 (absolute resolve_endpoint), dev-vessel-compose2, and 7 federated rows all at `127.0.0.1:8401`. |
| `memoryNote_write` / `memoryNote` | development-vessel-local, -compose2, 2 federated rows |
| `surfaceIntent` | human-surface-vessel (local) + 4 federated human-surface rows |
| `obsidian:write_note`, `human_presentation`, `goal_answer` | **0** |

This matches D-delivery-targets.md.

### 2.2 human-surface's panel store and why 415655c1's panel was invisible

`uiPanel_write` (src/routes/impulses.ts:427-482):
- A write with a fresh id and no content creates a panel with literal defaults: `title "Untitled"`,
  `body ""`, `kind "info"`. A contentless write over an *existing* id is refused (409). A contentless
  write with a *new* id is accepted by design (comment at :440-443).
- The route has **no inbound authentication**. There is no middleware in src/index.ts or
  routes/impulses.ts. The "validator" comment at index.ts:228-233 concerns the read-only `/resolve`
  alias for `ui_legibility_scan`. Panels carry **no author, dispatchId or provenance
  field**. The keys present across all 7,244 panels are
  `asks, body, createdAt, id, importance, kind, revision, title, updatedAt, visibility`.

Dispatch 415655c1 (human-surface, 09-30 15:31-15:33Z, now compacted) coincides with **four** panels
`panel-1790782308360 / -315788 / -345528 / -355571`, all `kind:"info"`, `title:"Untitled"`, `body:""`.
This is attribution by time window only, because panels carry no dispatch link.

The workbench reads panels only through `/api/questions` (src/routes/participation.ts:14), which resolves
`uiQuestion`. That path is filtered by `isSolicitation` (src/solicitation.ts:23,49), and the filter is
`!INFORMATIONAL_KINDS.has(kind)` with `INFORMATIONAL_KINDS = {"info","pulse"}`. **Every walk-delivered
info panel is filtered out by construction.** `/api/state` returns all panels, but no UI component
reads it except exposure bookkeeping.

**Panel census** (`GET :18310/api/state`, read-only; 7,244 panels, updatedAt 2026-09-22T02:31Z..
10-01T09:52Z):
- `info`: 7,158 panels.
  - 2,992 have an empty body.
  - **0 have a body over 200 chars.**
  - The non-empty ones are titled "Review the evidence" (3,435), "Revised" (431), "Changed" (212) and
    probe ids (`panel ratchet-after-23-*`). That is test residue, not walk output.
- Escalation kinds (`gap_*`): 79.
- One `{{goal.kind}}` template-literal panel.

**No walk has ever delivered substantive content to this surface as a panel.**

### 2.3 What the workbench run view reads and could show

RunView.tsx reads `goalWalkState` via `/api/resolve` (a server-side proxy to goal-host; the browser
injects nothing). It renders:
- the verdict badge;
- `goalReachReason`;
- **`answerBody` whenever it is non-empty, regardless of `reached`** (RunView.tsx `const answer =
  walk.answerBody?.trim() ? …`);
- then the Trace. The Trace segments attempts and shows per-attempt `poolProvenance` previews, or
  "content not retained".

**Without any goal-host change (inside the human-surface grant)**, the run view could lead with a "best
output so far (not reached)" block assembled from what `goalWalkState` already carries:
1. the `HOLLOW-CONTENT <shape> (<n> chars) = <400 chars>` lines in `walkLog` (one per judged attempt,
   aligned to attempts by the same tail-offset `hollowVerdicts` already uses);
2. the current attempt's `poolProvenance` previews (≤2,000 chars) for content shapes;
3. the sessionStorage copy of earlier attempts, when this browser watched.

This is honest but thin. For cea3f4a4, (1) gives 400 of 4,965 chars of the best attempt, and (2) gives
the *worst* attempt (stale June 2024). The surface cannot know which attempt was "best" beyond the
`reported` heuristic.

**What needs goal-host (builder (a), excluded from autonomous editing):** `answerBody` for unreached
runs, per-attempt content retention, and lifting the 1,500/3,000 Basis cap.

---

## 3. Census: answerBody null while substantive content existed

**Method.** Source: `/workspace/goal-host-dispatches.json` (the goal-host store; the same records
`/executions/<id>` serves).
- **Denominator:** terminal (`status != running`), `reached != true`, **uncompacted** records. 1,900 of
  2,001 are compacted and their content evidence was destroyed by `pruneStore`. **That is itself the
  finding: the store cannot answer this question for anything older than about 8 h.**
- **Window:** 2026-10-01 02:55Z..11:06Z.
- **Content signal:** `HOLLOW-CONTENT` lines in `walkLog` (any attempt) ∪ current `poolProvenance`,
  restricted to shapes `llm_completion, llm_completion_result, memoryNote_write, memoryNote, web_search,
  goal_answer, fs_read, shellResult, http_fetch, httpResponse`.
- **Substantive:** ≥500 chars, not a refusal (`unable to browse|access…`).
- **Caveat.** This predicate admitted 660- and 719-char placeholder templates (`{current_date}`,
  `[Current Date]`, `Headline 1`). Each run below still qualifies on another impulse; a stricter
  predicate should also exclude `\[Insert|\{current_date\}|\[Current Date\]|Headline 1`.

| | count |
|---|---|
| terminal unreached uncompacted records | **43** (autonomous 36, human-surface 4, rhythm-conductor-drain 2, latency-probe 1) |
| answerBody null among them | **43 / 43** |
| null **and** substantive content existed | **6 / 43** (human-surface 4, autonomous 2) |
| …of which the substantive content survives only as a HOLLOW-CONTENT 400-char line from an earlier or judged attempt | 5 / 6 |
| **human-surface: null while substantive content existed** | **4 / 4** (`434df0a4`, `6638a791`, `cea3f4a4`, `5bef2e86`) |

Composed versus raw, for the 4 human-surface runs:
- **Composed report** (llm_completion, llm_completion_result or memoryNote_write ≥500 chars,
  non-placeholder): 3 (cea3f4a4, 6638a791, 5bef2e86).
- **Raw source only** (web_search results): 1 (434df0a4).
- Correctness is **not** graded here. 5bef2e86's dated headlines are unverified.

Wider frame, all 44 human-surface dispatches in the store (09-30 12:26Z..10-01 09:31Z, mostly
compacted): 38 have answerBody null and 6 have it populated. Those 6 are satisfier or floor reaches,
3 of which a human later overrode (see below).

**Positive controls, through the same address** (`GET :18210/executions/<id>`):
- `7e36414b` (reached, 1,694 chars) and `4ab1eac5` (reached, 2,604 chars).
- `85d3ef8c` / `4e21f241` / `0c5de87f`: **`reached:false` with a populated answerBody** (2,275 / 737 /
  1,165 chars). They reached at walk time and a human override then flipped them; `humanGraded:true`.

These prove that the address returns answerBody when the record holds one. The UI renders answerBody
when `reached:false` too, so the **surface half of "show the best output labelled not reached" already
works end to end**. The only gate is goal-host's `if (reached === true)`.

The positive controls also show the defect the human named: "Answer should include the answer in the
written description" (85d3ef8c). The Basis is the verdict prose plus a dispatch UUID plus a raw JSON
envelope.

**Side observation.** cea3f4a4's re-frame wrote a durable memoryNote `what-s-happening-today-october-1-2026`
to development-vessel. It reads back through `memoryNote` (positive). It holds one Al Jazeera headline,
**delivered where no human surface reads**: the same class as `248-escalations-were-asked-of-a-vessel-no-human-reads`.

---

## 4. Prior art (searched before proposing)

**goal-host `git log -S`:**
- `answerBody`:
  - `1d32a90` reject punt-only reframes;
  - `4d9eb92` prose answers;
  - `c43f59d` "the ReAct fallback deleted the answer it had just produced";
  - `36f5390` "the answer existed and the endpoint did not send it";
  - 4 substrate-authored cutovers.
- `HOLLOW-CONTENT`: `1fee66f` "log what the judge REJECTED".
- `poolProvenance`: `ced125b`, `fe609c4`.
- "best attempt" / `bestAttempt`: **nothing**.

**HUMAN_GOALS_BATTERY.md (row 200).** `17f2e41` widened `if (isQuestionGoal && reached === true)` to
`if (reached === true)` and verified it. This is a predecessor of exactly the same form, and it kept
the reach gate.

**human-surface `git log -S`:**
- `b0767021`: the trace keeps every attempt. This is the sessionStorage stopgap, and its own header says
  server content for earlier attempts is gone.
- `2a9a4be6`: the workbench.
- `ce0ffc72` / `b81ac262` / `0d0951c5` / `1704850a`: escalation visibility, absence-preserving writes.

**Gap store** (6,796 rows):
- **Open `goalwalkstate-discards-prior-walk-attempts-within-a-dispatch`** (09-30). It has
  edit_site=goal-host and an exact repair: archive a bounded `rec.priorAttempts` inside
  `mirrorWalkState` and serve it on `goalWalkState`. **This is the retention item; extend it, do not
  mint.**
- Open `walk-synthesis-step-does-not-receive-the-pool-evidence-it-should-summarize`: placeholder
  reports, upstream of delivery.
- Open `248-escalations-…`, `human-surface-uiquestion-read-drops-gap-needs-human-panels`, and
  `stateful-ui-panel-write-coerces-structured-body-to-object-object`.
- Open `development-vessel-resolve-route-is-unauthenticated-…`: the §9.0 family.

**Reports:**
- APPROACH.md "D second", read from origin/dev. It already proposes:
  - always build `answerBody`, labelled *not reached — best attempt*;
  - a reports lane for informational panels;
  - refusing empty delivery writes;
  - delivery by origin.
- REALIGNMENT §9.5 **holds D (delivery by origin)** until origin derives from the authenticated
  identity.
- D-delivery-targets.md: inventory.
- HUMAN_GOALS_BATTERY, INTERACTABLE_HORIZON_2026-09-06 (answerBody null on 47/50 then),
  arithmetic-outcome-repair-2026-09-11, and dossiers/human-surface-escalation.md (delivery to an
  unread vessel, 06-02→09-29).

---

## 5. Proposals

All three respect §9.0: **no writer chooses a delivery target, and no caller-asserted field selects
one.** Note that `operator:"human-surface"` is caller-asserted: proxy.ts:654 forwards `{...req}`
verbatim, and goal-host has no inbound auth. It must not become a routing key.

### P1 — Run view leads with the best output, labelled not reached (inside the human-surface grant)

- **Seam.** RunView.tsx / lib/attempts.ts. This is a **pull** by the dispatchId this browser itself
  received, so no target is selected and no origin is asserted (§9.0-compliant by construction).
- **What it shows.** A "Best output so far — not reached" block above the Trace, populated in this
  order:
  1. `answerBody` when non-empty;
  2. the reported attempt's content (the sessionStorage copy, else its `HOLLOW-CONTENT` 400-char line,
     **labelled as a 400-char excerpt of N chars**);
  3. the current attempt's longest content-shape preview.

  The selection is deterministic, not an LLM "best" picker. Placeholder and refusal patterns are
  excluded.
- **Gate.** Never render it under a "reached" badge. Always state the char count shown versus produced.
- **Builder.** Inside the human-surface grant. human-surface is plain files, so the substrate cannot
  author it (memory: authorability = submodule membership).
- **Verification.**
  - Positive: cea3f4a4 renders the attempt-2 excerpt with "400 of 4,965 chars". The raw line begins
    `{"resolved":true,"shape":"llmCompletion","content":"Today's date…`, so the block must unwrap the
    `content` field as Answer.tsx's envelope adapter already does; the rendered text then begins
    "Today's date: Thursday, 1 October 2026".
  - Must-fail: 5bef2e86's `[Current Date]` template is not chosen as the best output, and a reached run
    shows no "not reached" label.
- **Status.** New as a surface item; the label idea is in APPROACH.md D. It does not depend on §9.0.
- **Limit.** Thin until P3 lands. It must say so rather than imply completeness.

### P2 — "Delivered" lane for panels stored on this surface: **HELD**

**Two measured reasons:**
- **Nothing to show.** 0 of 7,158 info panels have a body over 200 chars. Walk-delivered panels are
  "Untitled" and empty.
- **It is the §9.0 injection path.** `uiPanel_write` on human-surface is unauthenticated, and panels
  carry no author or dispatchId. Rendering them to the human as "delivered output" would let any
  reachable caller (the ports are host-published, per §9.0) place text in front of the person labelled
  as a run's result.

**Preconditions:**
1. Route authentication on human-surface `/v2/impulses/resolve` per §9.0.
2. Panel author stamped **server-side from the authenticated caller identity**, never from a body
   field.
3. A dispatchId link, so a panel is shown only under the run that produced it.
4. Refuse empty title or body on create (APPROACH.md D).

**Verification once unblocked:**
- Must-fail: an unauthenticated `uiPanel_write`, or one without a dispatch link, does not appear in the
  lane.
- Positive: a goal-host-authenticated write linked to a workbench dispatch appears under that run.

**Status:** already in REALIGNMENT §9.5 (D HELD) and APPROACH.md D. Builder (a) for the auth stamp;
inside the grant for the lane.

### P3 — Retain the best attempt's full content and always build `answerBody` (builder (a): goal-host index.ts is excluded)

**Seam.** Extend the open gap `goalwalkstate-discards-prior-walk-attempts-within-a-dispatch`; do not
mint. In `mirrorWalkState`, archive `{startedAt, steps, poolProvenance, verdict}` for the outgoing walk
onto a bounded `rec.priorAttempts` (about 8), and serve it on `goalWalkState`.

**Changes:**
1. Per-content-shape storage bounded with a **stated** cut. The in-repo precedent is the floor's
   `final_text` (4,000 chars + `…[truncated N chars]`, local:5497). It is not the silent 1,500.
2. Build `answerBody` on **every terminal walk**:
   - when `reached !== true`, labelled `not reached — best attempt (attempt k of n)`;
   - its body is the composed content-shape text (unwrapped from the envelope), not
     UUID + JSON.
3. `pruneStore` compaction keeps `answerBody` and the reported attempt's content, as it already keeps
   `answerBody`.
4. The reported attempt stays resolvable server-side, so a grade and the content refer to the same
   attempt.

**Gate.** Deterministic best-attempt selection: prefer the reported attempt; exclude refusal and
placeholder patterns. A not-reached `answerBody` must never feed credit, `goal_answer` reach or concept
writeback (those stay behind `reached === true`).

**Verification:**
- Positive: a replay of cea3f4a4's goal yields `answerBody` containing ≥4,000 chars of the attempt-2
  report, with the label.
- Must-fail:
  - `reached` and α are unchanged by the new `answerBody`;
  - a run whose only content is a refusal gets an `answerBody` stating "no substantive output", not the
    refusal;
  - the 85d3ef8c-style human override still shows its prior `answerBody`.

**§9.0.** This is pull-only, with no routing. Content stays on the record that the dispatching surface
reads by id.

**Pre-existing, not introduced.** goal-host read routes are unauthenticated, so any caller who knows a
dispatchId can read the run. Route auth (§9.0) covers it.

**Status:**
- Retention: already a filed gap, with APPROACH.md D and §2.0b pairing.
- "Always build answerBody" is in APPROACH.md D. `17f2e41` is a partial predecessor that kept the reach
  gate: it widened the gate and kept `reached`.
- Lifting the Basis cap ties to §9.2 (abstain on truncated view) and class C.

### Not proposed here

- Delivery-by-origin push (APPROACH D seam) stays HELD per §9.5.
- Retiring the `obsidian:write_note` tail and stateful-ui is §9.5 Step 0 / §4. It is upstream of this
  link: the walks die on that shape before delivery is reached.
