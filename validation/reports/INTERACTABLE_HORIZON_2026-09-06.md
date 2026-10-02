# The interactable horizon: what it means, and what the system can currently do at it

Measured 2026-09-06 against the live substrate. Every number below was read from
the running system, not from a cache.

## What "the interactable horizon" means

The substrate's gap machinery is **file-shaped end to end**. A gap names a file,
the walk hydrates that file, a resolver reads it, a drafter proposes a diff, and
typecheck verifies. That pipeline works — it is the loop that produced this
session's autonomous dispatches.

Interface gaps are not file-shaped. Their evidence is a **rendered frame** and a
**stream of interaction signals** — what a human saw, did not understand, clicked
away from. The file, if there is one, is downstream of the finding, not the
finding itself.

The **interactable horizon** is the boundary between those two regimes: the outer
edge of what the system can perceive and act on through its surfaces. Learning to
learn gaps at that horizon means acquiring the ability to *form* a gap whose
evidence is a frame plus a signal stream — and, before that, to stop coercing
every gap into a file path.

## Evidence that the horizon is exactly where the machinery stops

**1. The walk invents a file path when a gap has none.** The substrate
autonomously dispatched a closer on a gap filed this session. Goal-host logged:

```
gap-hydration: injected record ui-screenshot-routed-to-hollow-proxy (cited file: none)
walk rawResolve code_quality: resolver rejected — ENOENT: no such file or directory,
  open 'substrate/gap/ui-screenshot-routed-to-hollow-proxy'
```

The gap identifier was coerced into a filesystem path. The generator fired
correctly; the walk had nowhere to put a fileless gap.

**2. It is a class, not one gap.** Over six hours of goal-host logs: 27 gap
hydrations (21 with a cited file, 6 without) and 21 rawResolve rejections
clustering on the same defect —

| count | resolver | rejection |
|---|---|---|
| 5 | `source_code` | `filePath is required` |
| 4 | `problem_detection` | `filePaths is required` |
| 5 | `problem_detection` | `no analyzable file: ENOENT … 'problems/…'` |
| 2 | `source_code` | `ENOENT … '/workspace/git/super-repo/gap…'` |
| 2 | `code_quality` | `ENOENT … 'substrate/gap/ui-screenshot-r…'` |

Two independent resolvers invent a path from a gap id. The rejections are
concentrated in "required file missing" and "path synthesized," which is the
signature of a fileless goal entering a file-shaped lane.

**3. The signals exist; nothing reads them — and most are not human.**
`WORKSPACE_ROOT/interactor-log/` holds **384 durable records** — 235
`uiFeedback_write`, 56 `interactorDismiss_write`, 39 `interactorAssertion_write`,
30 `interactorEvent_write`, 24 `interactorAttachment_write`. The gap store
contains **zero gaps in any `ui` category** (all categories enumerated).

> **CORRECTION.** An earlier revision of this report called all 384 "human
> interaction signals." That was wrong. Read per record: only **~33 carry
> `source: stateful-ui-vessel`** and the human complaint grammar. The other
> **~351 have no source** and carry execution-pool fields (`dispatch_id`,
> `executionId`, `goal`, `filePath`, `fileContent`, `extract_*`) — substrate
> impulses written to interactor shapes, including a full
> `orphaned_capability_scan` payload stored as `uiFeedback_write`. The complaint
> shape is a dumping ground for the substrate's own traffic.
>
> The error came from `grep -o "\"kind\":..." | sort | uniq -c`, which counts
> **occurrences, not records**: it reported 140 kind-values across a file where
> only 5 records have a `kind` field at all. **Name the denominator; count
> records, not matches.**

So the channel is broken twice over: **contaminated** (≈91% substrate noise) and
**unread** (no consumer). And of the ~33 genuine human records, **26 are
dismissals** — the lowest-information human act. The system has almost no
evidence about what a human wants from its surface, because the only instrument
that would measure it is broken in both directions.

The passthrough resolver's own header admits it
(`repos/development-vessel/src/resolvers/interactor-passthrough.ts`): the
substrate-side gap-consumer closes the loop *"when it learns to read the log
files."* It has not.

**4. The surface says so itself.** Captured headlessly from the live board
(`human-surface-vessel`, `:18310`), the panel titled **KNOWN WRONG WITH THIS
INTERFACE** reads `0 open · 0 closed` and states:

> No legibility findings on record. The detector has either not run against this
> surface or found nothing — those are different, and this view cannot tell them
> apart.

That is the surface independently reporting the same gap filed from the cockpit
this session (`ui-legibility-scan-resolver-only-never-walked`: zero activities,
zero executions), and doing so while correctly refusing to conflate null with
zero.

**5. Mechanism, read from source.** `repos/human-surface-vessel/src/store.ts`
header: *"No persistence — a restart clears every store."* `/api/state` serves
`recentFeedback(20)` from that volatile store; `GET :18310/api/state` returns
empty arrays for feedback, observations, events, asserts, and attachments. The
surface's self-knowledge is wiped every restart while the durable log accumulates
unread. Filed as `surface-self-knowledge-panel-reads-a-volatile-store`.

## What the surfaces are

Five, not one — the audit loop and the interaction vocabulary must be shared
across them:

| Surface | What it is |
|---|---|
| metabob cockpit | the agent surface; its footage is the trace store |
| `human-surface-vessel` `:18310` | the web board a human resolver talks to |
| `stateful-ui-vessel` `:18270` | the durable panel pool behind it (188 panels) |
| obsidian-vessel instances | one per vault+human, presence-conditioned |
| peer substrates | federated surfaces (`dashboard-test-substrate-1` also live) |

Capture works on both regimes: headless Chrome with `--virtual-time-budget` for
the board (an activity can do this unattended), and the in-plugin Electron
`obsidian:ui_screenshot` resolver for Obsidian (verified this session, real
1269×769 frame).

## The loop, run once, on the surface itself

The gap `surface-self-knowledge-panel-reads-a-volatile-store` was filed with a
cited file and dispatched. What happened is the demonstration, and it is more
interesting than a clean landing:

1. **Edit-intent routed correctly.** Goal-host detected the named file pre-walk
   and routed to `feature_compose` — the file-shaped lane worked, because this
   gap had been given a file.
2. **The drafter wrote code into a comment.** The goal quoted the header comment
   (*"No persistence — a restart clears every store."*) as its verbatim anchor,
   and the drafter placed `hydrateFeedback()` inside that comment block.
3. **The gate caught it.** Adversarial refuters agreed **2/2 at confidence 1.00**:
   the function "is called immediately after its definition within the header
   comment block (lines 30-31)." The compose was refused; the gap stayed open.

That refusal is the system working. A comment-embedded function is inert code —
it typechecks vacuously, and a diff-reading gate can pass it. This is the exact
class that has historically landed inert. Here it was caught before landing.

**The operator error worth recording:** the goal-design rule is a *short, unique,
verbatim* anchor — but the anchor must be **executable code, not a comment**.
Quoting a comment aims the drafter at a region where nothing it writes can run.

4. **Redispatched with a code anchor** (`export function recentFeedback(...)`),
   explicitly requiring module-scope invocation and placement outside any comment
   block. The compose started and resolved 68 anchor candidates for `store.ts`,
   then produced no plan within ~15 minutes.

5. **It landed** — `f555bed4 feat(human-surface-vessel): close the feedback loop
   through the box`, roughly 40 minutes after dispatch, with no operator hands.
   The code is exactly what the goal specified: `hydrateFeedbackFromLog()`
   defined **outside any comment**, invoked at **module scope**, `readFileSync`
   on `${WORKSPACE_ROOT}/interactor-log/uiFeedback_write.jsonl`, wrapped in
   try/catch. The comment-anchor lesson held on the retry.

   (An earlier revision of this section called this attempt "unjudged" because
   the host was at load 12.7 with LLM timeouts. It was slow, not failed.)

**And the specification was wrong.** The change is correct against the goal I
wrote; the goal was written *before* I discovered the log is ~91% substrate
spillover. It pushes every record unconditionally, so on restart the human
complaint panel fills with `orphaned_capability_scan` payloads — **worse than the
empty state it replaces**. It also pushes raw log lines
(`{id, shape, visibility, received_at, pointer}`) directly as `Feedback` entries
without mapping or validation, and ignores `MAX_HISTORY`.

Not yet active: the unit has not restarted since **2026-08-28**, and module-scope
code runs only at import. Filed as
`feedback-hydration-will-flood-the-panel-with-substrate-spillover`, with the
repair (filter on `pointer.source` and `pointer.kind`, map onto `Feedback`, cap at
`MAX_HISTORY`) and a standing instruction not to restart the vessel until it is
fixed.

**The honest verdict on the demonstration:** the loop works end to end — filed,
picked up, routed, drafted, refused when inert, retried, landed. What it cannot
do is notice that the operator asked for the wrong thing. **Every gate reads the
diff against the goal; none reads the goal against reality.** That is the same
defect as the missing effect gate, one level up.

## The surface improving — measured, with a before and after

The board's **KNOWN WRONG WITH THIS INTERFACE** panel reads `/api/gaps`, which
resolves `substrateGap` filtered to `category: ui_legibility`.

**Before:** `0 open · 0 closed`, and the body text *"No legibility findings on
record. The detector has either not run against this surface or found nothing —
those are different, and this view cannot tell them apart."*

**After:** `3 open · 0 closed`, rendering three accurate, attributed findings
about the surface itself, each with its provenance line
(`operator:claude-fable-cockpit`). The panel that exists to show a human what is
wrong with the interface now does so.

Two further results came out of doing this:

**The detector ran for the first time.** `ui_legibility_scan` against
`obsidianEndpoint http://host.docker.internal:18310` returned `available: true`,
`panel_open: true`, `rules_checked: 3`, `violations: []` — the board passes all
three computable rules. But **a clean scan emits nothing, so nothing records that
it ran**: the exact ambiguity the panel names about itself cannot be resolved by
running the detector. Filed as `a-clean-legibility-scan-leaves-no-trace`.
(Instrument note: the pointer key is `obsidianEndpoint`; passing `endpoint`
returns "obsidian-vessel unreachable or ui_view empty" — a wrong-key error that
reads as a dead surface.)

**Working on an interface gap hides it from the interface.** A natural
experiment emerged, n=4, every gap filed as `category: ui_legibility`:

| Composed on? | Gap | Stored category | In panel? |
|---|---|---|---|
| yes | `feedback-hydration-will-flood-…` | `edit_intent_route` | no |
| yes | `a-clean-legibility-scan-leaves-no-trace` | `operations` | no |
| no | `surface-self-knowledge-panel-reads-a-volatile-store` | `ui_legibility` | yes |
| no | the two audit gaps below | `ui_legibility` | yes |

Both gaps a lane touched were reclassified and vanished from the panel; both it
had not kept their category and render. The two target categories differ, so this
is not one hardcoded value — what is common is that a lane wrote the record and
its own classification won, consistent with `substrateGap_write` replacing rather
than merging.

**Pre-registered falsifier:** if the two audit gaps are still `ui_legibility` and
still rendering after a compose lane picks them up, this claim is wrong and should
be retracted. Filed as `working-on-an-interface-gap-hides-it-from-the-interface`.

That last one is the horizon in miniature. To get a gap *closed* it must cite a
file and enter the file-shaped lane; entering that lane strips the category that
makes it *visible* to the human it concerns. Closure and visibility are in direct
conflict, and nothing in the system notices.

## What improvement looks like

Three gaps, all filed, all verified in the live store:

1. `ui-screenshot-routed-to-hollow-proxy` (class; two named instances) —
   discovery routes to producers that cannot serve the shape.
2. `ui-legibility-scan-resolver-only-never-walked` — the audit behavior is a
   resolver, never an activity; invisible to the learning loop.
3. `surface-self-knowledge-panel-reads-a-volatile-store` — the surface cannot
   show the human what it already knows is wrong with it.

The fourth, which this report exists to name: **the gap machinery cannot hold a
fileless gap.** Until it can, every interface finding must be laundered through a
file citation by an operator — which is precisely the pattern law 13 calls a gap
in the system rather than a workflow to institutionalize.

## Audit: what the surface displays, and why

Every element on the board, its data source, and whether it earns its place. The
test applied to each: **name its reader and the decision it changes.**

| Element | Source | Verdict |
|---|---|---|
| Ask box + Send | free text → `dispatch_goal` | **Earns it.** The one place a human acts as more than a spectator. |
| Eight chips | derived from the advertised shape vocabulary | **Earns it.** "Derived from the 393 shapes the fleet is advertising right now" is exact — the registry returns 393. Clicking fills, does not send, as stated. |
| Chip legend (dashed / faded / accented) | static caption | **Partly.** "The accented chip changes this page itself" is true and visible. Dashed and faded describe states not currently present, so two thirds of the legend explains nothing on screen. |
| Runs list (≤50) | `activeDispatches` from goal-host | **Fails, see below.** Exactly 50 rows returned, so the stated cap is honest. |
| Status pill | `reached`, not `status` | **Earns it, and is the best thing on the board.** One row is `completed` + `reached:false` and correctly displays as *not reached* — the hollow-completion case caught in the render. |
| Rightmost column | `operator` when present, else `trigger` | **Fails.** Two different questions in one column position. |
| Runs footer | static caption | **Earns it.** "A verdict here is what the walk recorded — open a run to see what it actually produced" is exactly the right caveat. |
| Detail pane | selected run | **Promise unfulfillable on a third of rows.** |
| Known-wrong panel | `/api/gaps`, `category: ui_legibility` | **Earns it**, and now has content. |

### The dominant defect: a third of the board cannot be read

Measured against the feed it renders (n=50):

- `goal` is null on **17** → rendered as *"goal text not recorded on this dispatch"*
- `executionId` is null on **17**
- **both** null on **16 — just under a third of the board**
- `answerBody` null on **47**
- `reached`: 45 false, 4 true, 1 null

So on sixteen rows a reader can neither see what was asked nor open the row to
find out, because the detail pane needs an `executionId`. Those rows carry a red
pill, an elapsed time, and a lane tag. They **inform no decision while reading
unmistakably as failure** — the surface's dominant visual impression is produced
by its least informative content. And with `answerBody` null on 94% of rows,
there is almost nothing for the presentation layer to render either.

This is a data-capture defect surfacing as a UI defect. No layout change fixes
it; re-rendering a null produces a prettier null. Filed as
`a-third-of-the-board-is-rows-a-human-cannot-read`.

### The attribution defect

`operator` is null on **35 of 50**; `trigger` is always present. The board shows
`claude-code-operator` on some rows and `gap-closing` or `run-goal` on others *in
the same column*, silently falling back. Those answer different questions — who
asked, versus what lane fired — and that distinction is precisely what separates
an operator's own work from the substrate's autonomous work. `trigger` even has a
literal value `operator`, which is a lane name and not a person. Filed as
`the-runs-column-conflates-who-asked-with-how-it-fired`.

### What the audit says overall

The board's **captions are honest and its verdict logic is right** — it shows
`reached` over `status`, it warns that a verdict is only what the walk recorded,
and it refuses to conflate null with zero. Almost every defect found is upstream
of the pixels: missing goal text, missing execution ids, missing answers, a
conflated field. The surface is a faithful instrument pointed at a sparse signal,
and it cannot be made good without improving what it is pointed at.

## What actually changed — and one closure that did not

An inventory, checked against the running system rather than recalled.

**Changed:**

- **Eleven gaps** filed and present in the live store; **four render** on the
  board's known-wrong panel, which held none before.
- **`ui_legibility_scan` executed for the first time** against the human surface
  — and left no durable trace, which is itself one of the filed gaps.
- **One commit landed in the container repo** (`f555bed4`, pushed to `origin/dev`)
  adding `hydrateFeedbackFromLog` to `store.ts`. **Dormant**: the unit has not
  restarted since 2026-08-28 and module-scope code runs only at import.
- Seven local commits on this report, **not pushed**.

**Not changed:** `/api/state` still returns empty arrays. The interactor channel
is still contaminated and unread. The runs feed still has no goal text on 17 of
50 rows. **No gap was genuinely closed.**

### The closure that did not happen

`the-walk-invents-a-file-path-for-a-fileless-gap` was filed at 07:01:14Z and
**closed ten minutes later** at 07:11:34Z with the remedy:

> *"Addressed by updating the walk logic to handle fileless gaps appropriately,
> preventing the synthesis of file paths when none are provided."*

Three checks refute it:

1. **No commit** touched `repos/goal-host-vessel` on 2026-09-06.
2. **The behaviour continues.** Since the closure the walk has coerced a gap id
   into a path three more times — twice as
   `/workspace/git/super-repo/interactor-signals-never-convert-to-gaps.md`, the
   id of another gap filed this session.
3. The record carries `detected_at: 2024-01-01T00:00:00Z`, a placeholder, and its
   `source` was rewritten from `operator:claude-fable-cockpit` to `substrate` —
   the system is credited with a finding it did not make.

**Method note.** The first grep used to test this matched only the two path
prefixes seen earlier and returned **0**, which reads as *"fixed."* The behaviour
was found only because sample lines were printed alongside the count, revealing a
third prefix. A negative from a pattern built out of previously-seen instances is
not evidence of absence.

This matters beyond one record. Law 7 measures progress by gap close rate, close
latency, and durability. A closure produced by *asserting* a remedy rather than
performing one makes all three measure fiction, in the flattering direction.
Filed as `a-gap-was-closed-with-a-remedy-that-never-happened`.

## Proving the design claim: what "closed" means, measured

The design argument — that a surface must display claims *with* their verification
state — is testable. If `closed` is displayed as one word over every record, how
much of what it reports is actually a repair?

Read from the live store (n=2,817), separated by identifier prefix:

| Record kind | Total | Closed | What closing means |
|---|---:|---:|---|
| `auto_draft_decision:*` | 890 | 890 | **Bookkeeping.** A decision log, one row per distinct goal, closed when the dispatch finishes by `closeAuthoringDecisions`. |
| `route-edit:*`, `recommit-*` | 631 | 211 | **Bookkeeping.** Edit-route records. |
| everything else | 1,296 | 741 | **Defects** — records describing something actually wrong. |

**A correction I nearly published.** My first reading was "848 gaps closed merely
because a dispatch completed" — the hollow-completion trap at store level. Reading
the code refuted it: `repos/goal-host-vessel/src/index.ts` closes those rows as
*"decision-log hygiene,"* one per distinct goal, and closing them on completion is
correct for what they are. The comment says so plainly. **The defect is not that
these close wrongly; it is that one `status` vocabulary spans three
incommensurable record kinds, so one count mixes them.**

Of the **741 genuine defect closures**:

- **547 expired** by `gap_lifecycle_scan`, **7 auto-closed** → **554 (74.8%) timed
  out rather than were repaired**
- **185 (25%)** carry no marker at all — closed, mechanism unrecorded
- **27 (3.6%)** carry a `remedy` string, and a remedy is *prose that nothing
  checks* — one of the 27 was verified this session and had not happened
- **1** is a genuine verified closure: *"RETRACTED — mechanism refuted by
  verification."* One record in 741 names its own refutation.

So law 7's close rate, computed over an undifferentiated `closed`, is dominated by
decision-log hygiene and TTL expiry. Filed as
`one-closed-vocabulary-covers-three-incommensurable-record-kinds`.

**This is the proof that structure is a semantic commitment.** No data changed
between the two readings above — only how the records were grouped. One structure
reports 1,841 closures as progress; the other reports 27 asserted remedies, 1
verified closure, and 554 timeouts. A rendering of the same store published at the
artifact link records the comparison.

The board already does the right thing once — it renders `reached` rather than
`status`, and says a verdict is only what the walk recorded. Everything here is an
argument for generalising that one instinct: separate the record kinds, distinguish
repaired from expired in the vocabulary itself, and gate a close on evidence that
the behaviour stopped.

## What this means for the human surface

**The surface's honesty is capped by the vocabulary it is handed.** The board's
single best instinct is that it renders `reached` rather than `status` — it refuses
to let a clean exit pass as a result. It cannot apply that instinct to gaps,
because the gap store never made the distinction: a record is `open` or `closed`,
and a closure carries no evidence field a renderer could show. So the surface is
*structurally unable* to be more honest about gaps than its data model, and
improving it here is not a UI task.

**A dated, falsifiable consequence.** Expiry is a fixed **7-day TTL** — across 707
expired records (n=400 sampled) the time from `created_at` to closure has median
**7.0 days** and minimum **exactly 7.00 days**. The panel resolves `substrateGap`
filtered to `category: ui_legibility` with *no status filter*, and renders a
counter of the form `N open · M closed`.

So around **2026-09-13**, with no code change and nothing repaired, the four
findings filed today flip to `closed` and the panel will read **`0 open · 4
closed`** — which is exactly what a genuinely fixed interface would look like.
The panel I populated this session will, in a week, quietly report its own defects
as repaired.

**It loses items two ways and both resemble success.** Expiry, as above; and
reclassification, since a lane that touches a record overwrites its category and
the gap drops out of the `ui_legibility` filter entirely. Neither departure means
the defect is gone. An emptying panel currently reads as an improving interface.

**Three repairs the surface can make without waiting for the store:**

1. **Render why an item left**, not only that it left — expired, reclassified, and
   repaired are different events.
2. **Show the age of each open item.** Forty days open and forty minutes open are
   different claims, and age is the field that makes a 7-day TTL visible.
3. **Never show a closed count without its mechanism.** A bare number is the
   flattering reading by default.

**And the reason this surface matters more than the store.** The conflation between
repair and timeout is invisible to the substrate — nothing internally complains,
which is why 554 timeouts have accumulated as closures. It becomes falsifiable at
exactly the moment it is shown to a person who can say *"no, that was not fixed."*
The human surface is not a downstream victim of the data model. It is the only
place the data model becomes correctable — the same reason rendering relevance is
what would make the relevance model trainable.

Filed as `the-known-wrong-panel-will-report-expiry-as-interface-repair`, with the
prediction pre-registered as its falsifier.

## Does the surface co-evolve with the system?

Half of it does, by design and unusually well. The other half does not exist.

### Rendering: solved, and correctly

`ui/src/components/ContentRender.tsx` states the principle outright:

> The shape vocabulary is OPEN — hundreds of shapes, learned by observation
> rather than declared, and ragged enough that whole prose sentences have been
> registered as shape names. No renderer-per-shape is possible. Content, however,
> arrives in a small CLOSED set of forms. So: dispatch on the form, and make the
> verbatim branch the DEFAULT.

Nine forms — `prose`, `text`, `rows`, `diff`, `empty`, `terminal`, `record`,
`scalar`, `stub` — cover 393 advertised shapes, and `terminal`, `record` and
`scalar` fire **only on positive evidence** (a full successful `JSON.parse` of a
non-truncated preview), falling back to verbatim rather than draw a value they
could not confirm. As the file puts it: a surface that renders blank for
unanticipated shapes *"has failed at exactly the moment it mattered, and one that
pretty-prints something it misidentified has failed worse."*

**A new shape renders with no code change.** That is exactly the co-evolution
property required, and the open-vocabulary/closed-form split is the right answer.
`renderPolicy` extends it: rendering is steered by a shaped impulse read at use
time, so the built-in heuristic is *"demoted from a decision to a prior"* — law 1
applied to the surface itself.

### Selection: absent

There is **no mechanism for what to show or when**. The UI source contains **zero
references to relevance**, while the substrate computes and stores
`impulseRelevance`, `impulseRelevance_write`, and `impulseRelevancePenalty_write`.
The relevance model never reaches the surface.

Ordering is fixed to `startedAt` then `dispatchId`, and that is **deliberate and
right**: sorting by status or reach would move a row out from under a reader at
the moment it becomes worth reading — `lib/sort.ts` names this as *the attested
failure this whole surface was rebuilt to fix*.

So **the repair is not to rank by relevance.** That would reintroduce the failure
they engineered out. The repair is to **select rather than reorder**: decide what
enters the list at all, and keep the stable comparator within it. Stability and
relevance are in genuine conflict only if you try to solve relevance by sorting.

Measured cost of having no selection: 16 of 50 rendered rows carry neither goal
text nor an `executionId`, and `answerBody` is null on 47 of 50.

### Input: free-form where it matters, closed where it is safe

The Ask box takes arbitrary natural language and the system owns the
decomposition — law 13 honoured. `surfaceIntent` is narrower on purpose: prose
about *changing the surface* is parsed deterministically against a closed
vocabulary, and what it cannot parse it **reports as unparsed** with the
vocabulary it does understand, never silently dropping a clause. Escalation to an
LLM is an explicit human step, not a hidden fallback. So "input in any form" holds
for asking the system to do work, and is deliberately bounded for reconfiguring
the surface — an honest trade, not a gap.

Filed as `the-surface-has-a-render-architecture-and-no-selection-architecture`.

## Postscript: the panel emptied while we were discussing it

Asked a second time what had actually changed, the answer turned out to be: **the
surface got worse, by the exact mechanism filed against it.**

Every gap below was filed with `category: ui_legibility` and reclassified within
roughly forty minutes. None was fixed.

| Gap | Filed as | Now | In panel |
|---|---|---|---|
| `a-third-of-the-board-is-rows-a-human-cannot-read` | `ui_legibility` | `audit` | no |
| `the-known-wrong-panel-will-report-expiry-as-interface-repair` | `ui_legibility` | `bug` | no |
| `one-closed-vocabulary-covers-three-incommensurable-record-kinds` | `ui_legibility` | *(none)* | no |
| `working-on-an-interface-gap-hides-it-from-the-interface` | `ui_legibility` | `interface` | no |

The panel fell from four findings to three during one conversation, and the gap
describing the disappearance **disappeared by the mechanism it describes**.

Two things are now clear that were not when it was filed:

1. **Reclassification is the dominant mechanism, not expiry.** It empties the
   panel in tens of minutes, where the TTL takes seven days.
2. **The classifier is not wrong.** Relabelling that record as `interface` is
   arguably *more* accurate than `ui_legibility`. So the defect is not the
   reclassification — it is that **the surface filters on one literal category
   string, so any improvement in classification silently deletes content from the
   human's view.**

That inverts the repair. Nothing needs fixing in the classifier; the surface must
filter on a set of interface-related categories, or on the subject of the record,
rather than on a single exact match. A view whose contents depend on an exact
string is not reading the store, it is reading one spelling of it.

## RETRACTION: the compose did not land a commit

Two earlier sections of this report state that the hydration change landed as
`f555bed4 feat(human-surface-vessel): close the feedback loop through the box`,
pushed to `origin/dev`. **That is wrong on every count.** Verified in the
container checkout:

- `git log -S hydrateFeedbackFromLog -- repos/human-surface-vessel/src/store.ts`
  returns **no commits**. Nothing ever introduced the symbol.
- `git status` reports the file as ` M` — the change is an **uncommitted
  working-tree edit**.
- `git show f555bed4:…/store.ts | grep -c hydrateFeedbackFromLog` → **0**.
  `f555bed4` is dated **2026-08-07** and does not contain the code.

**How the error was made.** I ran `git log --oneline -2 -- src/store.ts`, saw a
plausible commit at the top, and read *the most recent commit touching the file*
as *the commit that made this change*. It is the same error as the earlier
`fc-plan` misattribution: identifying a record by **proximity** rather than by
**identity**. The correct query names the symbol (`git log -S`), and it takes no
longer to run.

**What this means, which is worse than a bookkeeping error.** The unit's
`ExecStart` is `bun /workspace/git/super-repo/repos/human-surface-vessel/src/index.ts`
— the working tree *is* the runtime artifact. So compose wrote unreviewed code
into a live source path and left it there uncommitted: one restart from being
live, with no diff in history to review, nothing to revert, and no author on the
change. The standing do-not-restart advisory therefore holds for a stronger
reason than the one originally given. Filed as
`compose-left-unreviewed-code-in-the-runtime-path-uncommitted`.

**And the consequence for the session's headline claim.** This session produced
**no** substrate-authored commit. The compose lane refused two changes correctly
(comment-embedded code; dead code) and left a third uncommitted in the working
tree. Evidence that the substrate lands its own commits is *historical* — the
2026-09-04 four-link chain, n=1 — not something demonstrated here.
