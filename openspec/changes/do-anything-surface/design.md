# Design — what a do-anything surface looks like, and what it costs to build one

Companion to `proposal.md`. Three parts: what the published design research says a
single-input agentic surface owes its user, what that looks like as a screen here, and
what a minimal compliant vessel actually costs if this ships as its own vessel rather
than as an extension of `stateful-ui-vessel`.

---

## 1. The premise: a do-anything box adds no capability

The goal walk is the do-anything machinery. It already accepts arbitrary natural language,
infers target shapes, backward-chains over producers, and judges reach afterward. A
surface adds exactly one thing — a person who can reach it — and risks exactly one thing:
misreporting what the walk did.

That framing decides every question below. Anything the surface does beyond faithfully
rendering the canonical loop is either scope creep or a private side-channel, and a
gesture that cannot be expressed as a shaped impulse is a missing activity rather than a
reason for a bespoke endpoint.

---

## 2. What the research actually says

Four corpora agree with this system's own laws to a degree that is worth taking seriously,
because they were derived from user studies rather than from ontology.

### 2.1 The blank box is the bug, not the aesthetic

The named defect is the **articulation barrier**: prose-intent interfaces require users to
describe what they want in writing, and roughly half the population of rich countries is
classified low-literacy. The existence of "prompt engineering" advice is itself the failure
signal. The prescribed replacement is **intent by discovery** — recognition over recall.

Microsoft's HAX guideline **G1, "make clear what the system can do"** and **G2, "make clear
how well the system can do what it can do,"** are the two *initially*-phase guidelines out
of eighteen, which is where the emphasis belongs. Nielsen Norman Group's site-chatbot
guidance is more specific and directly implementable:

- Put suggestions **adjacent to the input field**, the locus of attention.
- **Specific beats generic** — a concrete task outperforms a category label, measurably.
- Offer them **as buttons, not prose**.
- **One click inserts an editable prompt; it does not execute.**
- Keep the set small (3–6), ranked, and refreshed on engagement.
- Support **discoverability through redundancy** — an open box *plus* a browsable menu —
  but never auto-fill specifics inside a broad category; ask a clarifying question instead.

Information foraging theory gives the reason this is structural rather than cosmetic. A
person decides where to look next from **scent** — an estimate of value formed from cues
about content they have not yet seen. **An empty input emits zero scent**, so every
decision made in front of it is uninformed. That is why the empty state is a primary design
surface rather than a placeholder, and why the starters must be specific: a category label
is a weak scent emitter, a concrete task is a strong one.

This maps onto law 13 exactly. A human is a resolver sending intent, not a preprocessor;
if the box only works once someone rewrites the goal with file paths, the rewriting is the
gap. The difference is that the research says the *fix* is not only better parsing on the
system side, it is also showing the person what is possible before they type.

**Here, the capability claim must be derived, not written.** The registry knows which
shapes have live producers. A hand-authored list of examples is a doc, and docs drift; a
list derived from `vesselCapability` at render time cannot claim a capability the fleet
does not have.

### 2.2 Hollow success is the measured, dominant failure — externally confirmed

This is the strongest finding in the whole review, and it independently confirms a law
this repository arrived at on its own.

*How Coding Agents Fail Their Users* analyzed 20,574 real sessions across 1,639
repositories and classified seven forms of agent-developer misalignment. **Inaccurate
self-reporting — "misreports the status (e.g. success) of its own work" — is 22.58%**,
the third most common. The paper's characterization is that the agent "consistently turns
a partial or unverified state into a completion claim." Two further numbers matter more
than the headline:

- **90.50% of the damage is effort and trust cost only** — not broken systems. The expense
  of an over-claiming agent is the verification burden of not being able to believe it.
- **91.49% of these episodes required explicit developer pushback to resolve. Only 2.99%
  self-corrected.** The human bears essentially all of the detection burden.

Google PAIR names the same class from the other side, in its error taxonomy: **background
errors — "systems function incorrectly without user or system detection"** — and states
plainly that this is the hardest class. PAIR offers no measurement for it.

Two vendors have shipped honest-status language worth copying nearly verbatim. Claude
Code's Routines documentation: *"A green status in the run list means the session started
and exited without an infrastructure error. It does not mean the task in your prompt
succeeded."* Devin's Session Insights flags the agent's own sessions **unhealthy** at
session size L/XL.

**The consequence for this surface is not subtle.** `status` is the template exit status.
`reached` is the verdict. A surface that renders them at equal weight, or that lets
`completed` occupy the position a reader scans for the outcome, has shipped a 22%-rate lie
with a nicer font. `status` should not appear as a headline anywhere. Where both are shown,
`reached:false` wins the visual hierarchy regardless of what `status` says.

This is also why **the completion evidence must be an artifact**. Across every converged
product, the strongest trust surface turned out not to be reasoning text but something
checkable: a passing test, a diff, a downloadable table, a cited terminal log. That
matches this repository's own standing rule — read the diff; neither `status` nor `reached`
is evidence.

### 2.3 Do not show a confidence number, and do not treat reasoning text as evidence

PAIR's guidance on confidence display includes an explicit **when not to show it**: when it
will not change the decision, when the granularity confuses (85.8% versus 87%), or when
high stated confidence induces blind acceptance of errors. The supporting literature is
consistent and points one way:

- Agent self-assessment is systematically overconfident.
- **Confidently-incorrect output damages trust more than unconfidently-correct output.**
- Miscalibration hurts in both directions — overconfidence produces over-reliance on wrong
  answers, underconfidence produces dismissal of correct ones. Only *calibrated* confidence
  improves decisions, and an LLM's self-report is not a calibrated classifier score.
- **Explanations are not a free trust fix.** Their mere presence raises trust and reliance
  regardless of correctness, because they read as a general competence signal. The
  counter-move is named explicitly in the IBM/Weisz principles: *"use friction to avoid
  overreliance."*
- Post-error explanation, by contrast, **does** repair trust. So the explanation is worth
  most **after an acknowledged failure**, not as ambient decoration.

And the load-bearing caveat on reasoning traces: models acknowledged an answer-changing
hint in **fewer than 20%** of applicable cases, and longer chains were often *less*
faithful. A visible reasoning stream is not evidence of what the system did. The trace is.

**Here:** planner confidence is not a calibrated signal in this system, so the surface
renders no percentage. Doing so would launder a known-bad signal into a UI element
users are documented to over-trust. Use **counterfactual and N-best forms instead** — *"this
path was chosen over that one because it produced the target shape 7 times"* — which is
also the honest reading of what Thompson selection actually recorded at decision time.

### 2.4 Gate early, not often, and not late

The best empirical result in the confirmation literature (n=48, with an n=8 formative study):

- **81% preferred intermediate confirmation** over end-only; 83% felt checkpoints prevented
  harmful errors; **77% disagreed that checkpoints disrupted workflow.**
- Intermediate confirmation **reduced task time 13.54%**.
- But placement dominates frequency: **~29% savings when the error was early, ~2% mid-task,
  and a 4.5% net cost for late-task checkpoints.**
- Over-confirmation destroys the value proposition outright. One participant: *"If I have to
  check every step my agent is making, I'd rather do it myself."*
- The recommendation is **adaptive frequency** — reduce checkpoints as per-step accuracy is
  demonstrated.

Microsoft's Magentic-UI gives the ratio to aim for: task completion rose **30.3% → 51.9%**
with an informed user available, while the agent asked for help in **only 10% of tasks,
averaging 1.1 requests**. Large gain, rare interruption.

**Here:** this maps onto the clarification exit already specified in
`obsidian-legibility-surface` — ask at intake when target inference is weak, which is the
earliest possible checkpoint and therefore the one worth ~29%. It also argues against a
per-step approval UI, which this surface should not have. And it says the frequency
threshold belongs in the pool as a shaped impulse the router reads, not as a constant —
which is law 1 arriving at the same place from a different direction.

### 2.5 Long runs need a contract, breadcrumbs, and a salvage path

Classic dialogue thresholds assume sub-10-second responses. Agentic work runs minutes to
hours, and the conventions that have converged are:

- A **run contract** shown before launch: duration as a **band with uncertainty, not a point
  estimate**, cost cap, definition of done, and **what the system will not do without
  asking** — editable before starting.
- **Three-layer progress**: overall completion estimated from *time*, not step count; which
  dependency is currently gating; current-step estimate. Blocking conditions stated
  verbatim ("awaiting human approval"), never hidden behind a generic spinner.
- **Conceptual breadcrumbs** — synthesized milestones ("discovered the target shape has no
  producer; widening the search"), not raw logs.
- **Stop-and-keep** rather than all-or-nothing cancel, and a **resumption summary** for
  someone returning later: what was asked, what was decided, what happens if they do nothing.
- **Error classification instead of a single "failed"**: transient (retry), semantic (fix the
  input), policy (needs a human), fatal (halt and escalate).

Perplexity's design writeup gives the reason progress display earns its keep, and it is not
transparency: *"users were more willing to wait for results if the product would display the
intermediate progress."* Progress UI is a latency product first.

**Honest caveat: streaming versus batch has no good study behind it.** The two available
signals point in opposite directions — progress display buys patience, while NN/g's
usability work says to *minimize* streaming long responses because they intensify cognitive
load, and at least one vendor now hides reasoning by default citing latency. Nielsen lists
it as an open research question. So this surface should treat streamed detail as
**progressively disclosed and collapsed by default**, not as the primary reading surface,
and should not claim the choice is evidence-backed.

### 2.6 The surface must not move under the reader — this is published guidance, not taste

PAIR's error chapter includes, as recommendation 7, **"don't break habituation"** and the
concrete remedy: **designate a fixed region for variable AI output.** NN/g's chatbot
guidelines add: **do not autoscroll to the end of a response** — hold the scroll at the top
of the new message.

This is the operator-attested failure on the existing panel, stated as published design
research years earlier: jarring reflow, focus not holding, completed runs unfindable, and a
grade panel that removed the row the instant it became worth grading.

Two of these are not preferences. **Cumulative Layout Shift** makes "content moved under me"
a measured defect with a threshold — good is ≤ 0.1, poor is > 0.25 — and it counts a shift
only when it happens *without* user interaction, which is exactly the streaming case. And
**WCAG 2.2.2 Pause, Stop, Hide is Level A**: any auto-updating information presented
alongside other content must offer a way to pause, stop, hide, **or control the frequency
of the update**. A live run board with no pause and no interval control is an accessibility
failure, not a rough edge.

The mechanics ops consoles converged on, and the engineering they rest on:

- **Stable identity per row** — a durable server-side id, never a list index. Index-as-key
  breaks identity the moment order changes and loses user input in the process.
- **Total sort order.** A sort on a non-unique key is not a function; equal-valued rows
  permute on every render. Append a unique tiebreaker to every sort key. And **do not sort
  by a rapidly changing column at all** — sort by a stable key.
- **Flash the cell, don't move the row.** Financial grids absorb thousands of updates per
  second without moving a row: the row holds position and the changed cell carries the news.
  This is the direct answer to a board that reshuffles as runs progress.
- **Auto-scroll only when already pinned at the edge.** Scrolling up silently pauses
  following; returning to the bottom resumes it. The scroll position *is* the mode switch —
  no toggle to find. Never scroll on the reader's behalf otherwise.
- **Buffer, don't splice** — arrivals that would land *above* the viewport become a count
  with an explicit accept action. Arrivals below the viewport can land silently.
- **Freeze on interaction** — an open menu, a selection, a focused input, or a pointer in
  the region suspends updates. Pause without discarding cached state, so resuming does not
  blank the surface.
- **Preserve scroll, focus, selection, and open input contents across every update.** Under
  virtualization the focused row must stay mounted even when scrolled out, or focus is lost
  on remount.
- **Never let an async arrival steal the highlighted target.** Require a margin before
  reordering, rather than letting a better result arriving one frame later take the position
  a hand is already moving toward. Chromium states the same rule for its omnibox: the
  top-ranked item must not change as more results come in.

One trap worth knowing before building the runs region: the browser's own **scroll
anchoring** is silently disabled when `transform`, `top`, `height`, `margin`, or `padding`
change on the anchor or its ancestors. A virtualized list that positions rows by transform
has opted itself out and must compensate manually.

The rule that follows for this system specifically: **a row that settles must become more
readable, not less.** Terminal state is when a run is worth grading, so terminal state is
exactly when it must stay put.

### 2.6b Acceptance is not completion — and this surface starts from a 202

`POST /run-goal` returns **202 Accepted** with a `dispatchId`. The HTTP specification's own
characterization of that status is the warning: a 202 response is *non-committal*, the
processing is not guaranteed, and there is no mechanism by which the outcome can later be
pushed back over that response. **A client that treats acceptance as completion is
architecturally guaranteed to display successes that never happened.**

That is the same defect as hollow completion, one layer down, and it means this surface has
two independent ways to lie about the same run. Three conventions from long-running-job
systems close it:

- **The job page is the system of record**, not the live view. A durable, addressable URL
  with terminal status, structured error, and a retention policy — the trace, here.
- **Distinguish stalled from in-progress.** Status bodies in mature async APIs carry both a
  created time and a last-updated time precisely so a client can tell a working run from an
  abandoned one. A spinner that cannot answer "is this still moving?" is lying by omission.
- **Answer "which submission is this status about?"** Kubernetes solves this with an
  observed-generation field. A progress display without it eventually shows someone the
  previous run's success — which is the reconciler-manufactures-a-hollow-green failure this
  system has already hit once.

The general form, worth stating as a rule for the surface: **predicted state must be
internally distinguishable from confirmed state**, and confirmation comes from the trace,
never from the fact that a dispatch was accepted.

### 2.7 Feedback: negative-only, granular, and acted on

- HAX **G15, "encourage granular feedback"** — at step level, not one verdict per session.
- Apple's guidance is sharper and worth adopting: **do not ask for both positive and
  negative feedback — good suggestions require none.** Also: **act immediately and persist**
  — flagged content should disappear from view and not reappear elsewhere.
- PAIR requires explicit feedback options be **mutually exclusive and collectively
  exhaustive**, and warns that dismissal is not the same signal as "show me less."

**Here:** the oracle corpus is a biased failure sample, so cheap verdicts on *reached* runs
are the scarce input. A grading gesture must be one click from the row, must offer options
that partition the failure space rather than a thumbs pair, and — per the "act immediately"
rule — must visibly change the row it graded. `provide_feedback` labels currently land in
the corpus for offline audit and are not consumed by any recalibration path; that is a
separate gap, and this surface should not imply otherwise.

---

## 3. What the screen looks like

One page, three regions, fixed geometry. The regions do not resize around their contents.

```
┌────────────────────────────────────────────────────────────────────┐
│  ASK                                                               │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ what do you want done?                                       │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  [ specific starter ] [ specific starter ] [ specific starter ]    │
│  derived from live producers · click inserts, does not send        │
├────────────────────────────────────────────────────────────────────┤
│  RUNS                              ← fixed region, stable rows     │
│  ● not reached  goal text…            2m   why ▸   grade ▸         │
│  ◐ running      goal text…            18s  awaiting your answer ▸  │
│  ● reached      goal text…            4m   diff ▸  grade ▸         │
│  ↑ 3 new                              ← buffered, never spliced    │
├────────────────────────────────────────────────────────────────────┤
│  DETAIL                            ← one run, held until dismissed │
│  what was asked · what happened · evidence · what happens next     │
└────────────────────────────────────────────────────────────────────┘
```

**ASK.** One input. Starters derived from `vesselCapability` at render time, specific
rather than categorical, click-to-insert. Below the input on submit — not before — the run
contract: inferred target shapes in plain language, a duration band, and what the walk will
ask about rather than decide alone.

**RUNS.** The fixed region. Every row is `reached`-first: a run that exited `completed` with
`reached:false` reads *not reached*, in failure weight, with the reason. `status` does not
appear in the row at all. Rows keep identity; terminal rows stay. Sort is by a stable key
with a unique tiebreaker, never by a value that changes during a run — a progressing run
updates its cells in place rather than moving. Reordering suspends while the pointer is in
the region or an input in it has focus. New arrivals out of view are a count, not an
insertion. The region carries a pause control and a refresh-interval control, which WCAG
2.2.2 requires at Level A and which also lets a reader who is grading stop the world. A run awaiting a solicitation says so in the row and answers in
place — the question and the goal are never on different screens.

**DETAIL.** Opens on click and holds until dismissed. Four parts, in this order, matching
the outcome-note structure already specified in `obsidian-legibility-surface`: **what was
asked** (the goal as typed), **what happened** (one honest sentence — hollow completion
reported as not reached), **evidence** (the artifact: diff, answer body, produced shapes,
trace id — and an explicit note when there is none), **what happens next** (retry proposed,
gap filed, or done). The walk log is here, collapsed. Explanation is offered where it repairs
— on failure — rather than sprayed across successes where it manufactures over-reliance.

**What the surface must never do**, inherited verbatim from
`docs/architecture/WORKBENCH_CHAIN_UX_DESIGN.md` and non-negotiable: never mutate substrate
state without a trace; never invent a vessel address; never present a prediction as a
result, or a reconnected live view as a complete one when missed events have not been
caught up; never require the human to speak the system's internal language.

To which this surface adds two:

- **Never render a status where a reader scans for an outcome.**
- **Never move a row that has become worth reading.**
- **Never treat acceptance as completion.** A `dispatchId` means the walk was accepted. The
  trace says what it did.

---

### 3.0 What the outputs are

This is the question the first draft of this design got wrong, so it is stated before the
screen rather than after it.

**Where they are.** In the pool, live, and in the trace, durably. Goal-host already surfaces
the live half: `mirrorWalkState` writes `poolShapes` and `poolProvenance` onto the dispatch
record every iteration, and its own comment names `poolProvenance` **the evidence ledger**.
Each entry carries the shape, the goal signature, `producedBy`, a `contentPreview` capped at
2,000 characters, the true `chars`, and a `truncated` flag. It is mirrored **regardless of
outcome**, so a failed walk's outputs are as inspectable as a reached one's — which is the
whole point, because judging a reach verdict requires seeing what was actually produced.

**What they are.** Not *a result*. A **set** of shaped impulses that accumulated during the
walk, of which `completionShapes` names the subset that covered the goal's target shapes.
`answerBody` is one impulse among them — the `goal_answer` shape, rendered for a human — not
the output itself.

**Could they be anything.** Effectively yes, and this is not theoretical: the registry
advertises **332 shapes** and the set is open by construction, since shapes are learned types
observed when vessels advertise them rather than declared in a fixed registry. Two live
entries are prose sentences that were registered as shape names, which is evidence that the
vocabulary is not merely large but ragged.

Three consequences fall out, and they are the load-bearing design constraints:

1. **The surface cannot hold a renderer per shape.** It dispatches on the *form* the content
   takes — prose, text, rows, diff, empty — which is a closed set, and treats the shape as a
   badge. A renderer keyed on shape names would have to decide what a malformed shape means;
   one keyed on form does not care.
2. **The verbatim fallback is the common case, not the error case.** Most of those 332 shapes
   will never earn a bespoke renderer and do not need one. The fallback gets designed first.
3. **Truncation must be stated on the content, not instead of it.** The preview cap is real —
   an 11,000-character shell result shows its first 2,000 — so the ledger says *"showing the
   first 2,000 of 11,430 characters — this is a preview, not the output"* and points at the
   full trace. An empty impulse is named as empty: it proves a step ran, not that the step
   produced anything.

### 3.1 The interaction patterns

Ten gestures. Each is stated as the rule it enforces and the failure it prevents, because a
pattern without its failure is decoration that the next person will optimize away.

**1. Verdict-first row.** The leftmost column is always the reach verdict; `status` appears
nowhere in the row. *Prevents:* a template exit status occupying the position a reader scans
for the outcome.

**2. Click inserts, never sends.** Starters are concrete tasks derived from shapes with live
producers. Clicking fills the input and focuses it. *Prevents:* the blank canvas, and the
auto-execution that removes the one moment a person could have corrected the guess.

**3. Buffer, don't splice.** Arrivals that would land above the viewport accumulate behind a
count the reader accepts; arrivals below land silently. *Prevents:* the reader's target
sliding out from under a moving hand.

**4. Flash the cell, don't move the row.** Sort by start time with a unique tiebreaker, never
by a value that changes during a run; a progressing run updates cells in place. *Prevents:* a
board that reshuffles as work progresses.

**5. Freeze on interaction.** A pointer in the region, a focused input, or an open selection
suspends updates — held, not discarded. Plus an explicit pause and an interval control.
*Prevents:* the attested failure of a row leaving the board the instant it settled.

**6. Ask where the run is.** A mid-walk question appears attached to its dispatch and is
answered in place. *Prevents:* two half-surfaces, and the correlation work that falls to the
human when question and run live on different screens.

**7. Grade from the row.** One gesture, options that partition the failure space, no
agree-button. The graded row visibly changes and stays put. *Prevents:* a verdict corpus that
is a biased failure sample.

**8. Show the content, not a receipt.** The output of a walk is not *an artifact* — it is the
set of shaped impulses the walk put in the pool. Each ledger entry shows its shape, what
produced it, and **the content itself**; length and truncation ride alongside what is shown,
never in place of it. *Prevents:* the receipt. `answer body · 340 chars · trace 994b5e` is
metadata *about* an output and cannot tell a reader whether 47 tests are failing or 3. A
character count is not evidence — and a shape name, a length, and a trace id are all things a
surface can print without ever having looked at the output.

**9. Dispatch on form, not on shape.** The vocabulary is open, so no renderer-per-shape is
possible. Content arrives in a small closed set of forms — prose, text, rows, diff, empty —
and the verbatim-monospace fallback is the *designed common case*, not an error state.
*Prevents:* a pane that silently degrades to blank for the shapes nobody anticipated, and the
opposite failure of pretty-printing something misidentified.

**10. Accepted is not done.** A 202 renders as *accepted* and nothing more; a run that stops
emitting renders as *stalled*, not as still working. *Prevents:* hollow completion one layer
down.

**And the standing omission: no confidence percentage anywhere.** Explanation is offered after
an acknowledged failure, where it demonstrably repairs trust, and takes counterfactual form —
"this path was chosen over that one because it produced the target shape seven times" — rather
than a number.

## 4. Known obstacles between here and that screen

These are properties of the current fleet, not design choices, and each is a real cost.

1. **goal-host sets no CORS headers.** Its `Bun.serve` handler serves the fleet, not
   browsers. A browser surface needs either a proxy through the hosting vessel — which
   `stateful-ui-vessel` already does for other things — or a change to goal-host. The proxy
   is the smaller change and keeps the API key server-side, which is required anyway.

2. **The REST route is the poorer one.** `GET /executions/:dispatchId` omits `steps`,
   `poolShapes`, `poolEvents`, `walkTier`, `executionPath`, `grounded`, and `answerBody`.
   The rich live view is `POST /resolve` with a `goalWalkState` pointer, and the board is
   `activeDispatches`. Build against those; the tidier-looking GET will silently starve the
   detail region.

3. **There is no streaming from goal-host.** Polling only. The live feel in the existing
   panel comes from an activity-api `/ws` subscription filtered by execution id. This
   surface should poll `activeDispatches` on a stable cadence and open the detail region's
   subscription per-run, and it must survive a dropped connection by catching up by
   sequence number rather than rendering a plausible-but-wrong state.

4. **The grounded-versus-interpolated flag is not emitted by goal-host.** The existing panel
   infers it heuristically, and that inference already produced a false "grounded" badge on
   bare LLM answers. **Do not re-derive it.** Either goal-host emits it or the surface does
   not claim it — an unearned provenance badge is precisely the confidently-wrong failure
   mode in §2.3.

5. **MCP cannot be the transport.** Every cockpit tool handler returns pre-formatted prose,
   and metabob-mcp is out of tree. The surface calls goal-host over HTTP.

6. **The `ui` role is not universal.** A spoke that masks the `ui` role has no local
   surface and must reach the hub's. That is correct under law 11 — but it means the
   surface must resolve goal-host through discovery and never assume a co-located vessel.

---

## 5. If it must be its own vessel: the minimal compliant skeleton

The surface layer is replaced root-and-stem by `human-surface-stack`, which selects the
interface and layout stack and retires `stateful-ui-vessel` and `react-renderer`. This
section answers the vessel-shaped question directly anyway, because the compliance floor is
the same whichever vessel hosts the surface, and because the same skeleton is what a surface
for a different human resolver would need.

**A compliant vessel is smaller than the documentation suggests.** The substrate's own
canonical scaffold, `complete-vessel-scaffold.ts` in development-vessel's seed directory —
authored by the substrate after a completeness report caught `clock-vessel` shipping without
an entry point — marks exactly three of its tasks *essential*: write the entry point, write
discovery registration, write the systemd unit.

**Files — seven, legitimately collapsible to one.** `relevance-sink-vessel` is the reference
bare vessel: a single `src/index.ts`, no framework, no shared-package dependency, and a
`package.json` with **zero runtime dependencies**. `metric-collector-vessel` is the same
thing with clean separation into `config.ts`, `routes/impulses.ts`, `discovery-registration.ts`,
and a 13-line entry point.

**Endpoints — two required.** `GET /health`, and a resolve endpoint dispatching on
`pointer.type`. The path is *advertised data, not contract* — the registry stores whatever
the vessel registers and dispatchers read it back — but `/v2/impulses/resolve` is the fleet
norm and the one to use. `GET /shapes` is convention; nothing in the fleet consumes a
vessel's own `/shapes`, because consumers hit discovery's aggregate.

**Registration — one call plus a heartbeat.** `POST /register` with
`Authorization: ApiKey`, then `POST /heartbeat` every 60 seconds against a 5-minute TTL,
and a `DELETE` on clean stop. Only `vesselId`, `endpoint`, and `shapes` are required by the
server.

**Four invariants, each with the failure it prevents:**

1. **Registration is non-blocking and non-fatal.** A vessel that throws out of startup
   because discovery was slow is a vessel that disappears from the fleet during a restart.
2. **Advertised shapes and dispatch cases agree exactly** — mechanically checkable by the
   shared shape-dispatch checker, which also runs inside the registration path in vessels
   that implement it, filtering unserviceable shapes out of the payload.
3. **`systemVessel: true`**, or the vessel is invisible to org-scoped registry queries.
4. **The served resolve path equals the registered `resolve_endpoint`.**

**Not required:** activity templates, an activity executor, `/run-goal`, trace emission, or
any identity-vessel call. A resolve-only vessel owes zero traces; trace emission belongs to
the executor contract, not the vessel contract.

### Two defects to route around

**The canonical scaffold emits an invalid registration payload.** It nests the resolver
contract inside a `resolverContract` object and omits `systemVessel`. The discovery registry
reads those fields **flat** and requires `systemVessel` for org-scoped visibility. A vessel
generated from the substrate's own scaffold therefore registers itself partially invisible —
it will pass a health check, appear to work, and be unfindable by shape. **Copy
`relevance-sink-vessel`'s payload, not the scaffold's.**

This is a gap in its own right and worth filing separately: the scaffold is the substrate's
statement of what a vessel is, it was authored in response to a detected incompleteness, and
it is itself incomplete in a way no existing check catches. The class question — *what
activity would detect a scaffold that produces non-registering vessels* — is the more
valuable half. A completeness report that resolved the scaffold's own output against the
registry would have caught it.

**`metric-collector-vessel` defaults to a port another vessel owns in the inventory.** It
survives only because a manifest entry overrides it. Take the port from the inventory, never
from a copied config.

### Adding one

Pick a free port from the inventory. Generate or copy the skeleton, then fix the
registration payload. Fill the dispatch switch and run the shape-dispatch checker. Add the
unit, ordered after discovery and identity, reading the shared environment file. **Add an
inventory entry for every unit shipped, including paired timers** — a unit missing from the
inventory runs unconditionally in every role, and the inventory file documents in its own
comment what that cost last time: an ungoverned service on a hub whose dispatch conduit was
correctly masked, failing every dispatch, **and writing a failure outcome per template into
the shared learning store.** Infrastructure absence was recorded as arm quality. Then either
bake the unit into the image, or skip that entirely and use the runtime-install path, which
renders the unit from the shared template and gets deregistration-on-stop for free.

Verify by health check, then by the vessel's shapes appearing in discovery's aggregate, then
by a dispatch whose trace is inspected — not by the dispatch returning green.
