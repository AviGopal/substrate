# What happens when a human asks the substrate for ordinary things

Eight goals, none about the substrate's own internals: a recipe, a mortgage
calculation, a declined-vendor email, a Lisbon itinerary, a half-marathon plan,
a board-game recommendation, a two-planet distance comparison, and a
population comparison. Dispatched through `/run-goal`, polled to a terminal
state, and hand-graded from the answer content rather than from `reached`.

## Result

| Goal | `reached` | Hand verdict | Path |
|---|---|---|---|
| Dinner recipe from four ingredients | ✅ | **valid answer, delivered as nothing** | satisfier |
| Mortgage payment + total interest | ✅ | ✅ correct to the cent | floor |
| Decline-a-vendor email | ✅ | ✅ usable draft | floor |
| Lisbon 3-day itinerary | ❌ | ❌ honest miss | walk |
| 8-week half-marathon plan | ❌ | ❌ honest miss | walk |
| Board game, 5 adults, 45 min | ❌ | ❌ honest miss | walk |
| Neptune vs Uranus distance | ❌ | ❌ **killed before it ran** | reuse |
| Lisbon vs Porto population | ✅ | ✅ correct and current | floor |

Four reached. Three of those four are genuinely good answers. None of the four
failures crashed — three were graded honestly as hollow by the system's own
gates, and one died in the dispatcher.

## What the good answers show

The **mortgage** answer is right to the cent. $2,528.27/month and $510,177
total interest; the closed-form amortisation gives $2,528.27 and $510,178, and
the three-dollar difference is exactly what you get by multiplying the *rounded*
payment by 360 — which is what a person would do. This matters because
integer/float arithmetic is a filed weak class (`gap-floor-integer-arithmetic-false-reach`);
here it held.

The **population** answer was grounded, not recalled. The walk searched, hit
Pordata, and read *"No final de 2025, a população residente no município de
Lisboa ascendia a 658.236 pessoas."* I initially expected ~545k — the 2021
census figure — and the substrate was more current than I was. The lesson is
the standing one: check what the walk actually fetched before calling a number
fabricated.

The **email** is usable, with one presentation defect: the model's tool-choice
reasoning ("I don't need to use any of the provided tools…") is prefixed to the
draft the human receives.

## Defect 1 — a reached answer delivered as nothing

The recipe goal reached. The walk log holds the full answer, 5,688 characters
of it. `answerBody` was `null`.

`answerBody` is built at `index.ts:9835` under

```ts
if (isQuestionGoal && reached === true) {
```

and `isQuestionGoal` (`index.ts:8215`) is a regex over the goal's **leading
word** — an alternation of `what|who|when|…|give|find`. The goal opened
"I have chicken thighs, white rice, spinach and one lemon. Give me a dinner
recipe…". It says *give me*. Four words too late.

So the human surface renders a green tick and an empty panel, for a goal the
system answered correctly. This is law 13 in miniature — *humans are resolvers,
not preprocessors* — and it is the goal-vocabulary-as-regex class again: the
repair is not another alternative in the alternation but gating delivery on
**whether an answer was produced** rather than on how the sentence starts.

## Defect 2 — the better the floor performs, the more reliably it kills the goal

The Neptune/Uranus goal never executed a step. Its record:

```
REUSE-BEFORE-DERIVE — the store recommends the floor for this goal (8/9 reached)
reused floor pathway did NOT reach — falling through to the full walk
no pick — missing shapes [llm_completion_dispatch] have no producer
error: template 'universal-tool-fallback' not found in shared catalogue or activity-api
```

`pinnableHead` (`pathway-head.ts:55`) declines to pin `satisfier:*` heads because
they are not catalogue rows, and its docstring explains at length why pinning one
is fatal: `getTemplate` 404s, and a caller-pinned target deliberately refuses to
fall through to the next candidate. `universal-tool-fallback` is not a catalogue
row either — `index.ts:11257` states so in as many words, "universal-tool-fallback
is not a pool-walk candidate" — but it carries no `satisfier:` prefix, so it
passes the guard and gets pinned.

The dynamic is the part worth sitting with. `recommendReachingPath` returns the
floor **because the floor has an 8/9 record on this goal family**. The stronger
that record grows, the more often the floor is recommended, and the more often
the recommendation kills the dispatch. Learning makes this class of goal *less*
likely to work, and the mechanism that inverts it is a guard written for exactly
this failure that names one id and not the other.

## Defect 3 — the walk has learned about nothing but itself

The three honest misses are the same story. For a Lisbon itinerary, the walk
selected:

```
learned-composition-vessel-health-report-to-concept-to-shellresult-to-memorynote-write
satisfier:goal_summary   →  {"template_count":100,"avg_success_rate":0.31,…}
```

For a board game it reached for `activity_recommend` and got 16kB of activity
templates. Every learned composition in the store is about the substrate, so a
human goal gets pattern-matched into vessel health reports and template
statistics.

The gates worked — each was graded HOLLOW with an accurate reason ("The output
did not provide a complete 3-day itinerary for Lisbon as requested"), and β was
withheld where penalising would have been unfair. The system was honest about
failing. But note what it had in hand when it gave up:

```
webSearchResult (3188 chars): "My Perfect 3 Day Lisbon Itinerary & Travel Guide (2026)" …
webSearchResult (3448 chars): "Intrigue … group 3–5 · best 5 · timer 45 min" …
```

The grounding was correct and sufficient. A board game for five adults in
forty-five minutes was sitting in the fetched page. There is no producer that
consumes `webSearchResult` and emits a written answer, so the walk produced the
evidence, judged the evidence hollow, and terminated. **This is a missing
last mile, not a missing capability** — and it is why the floor, which has no
such gap because it reasons and answers in one step, outperforms the learned
plane on every human goal in this battery.

## Defect 4 — the floor inherits the target shapes the walk just failed with

Defect 3 said "no producer turns a search result into an answer". That was the
symptom. The floor's own verdict log names the cause:

```
floor: ENTER … goalHash=92201578 targetShapes=["activity_recommend"]
floor: verdict  goalHash=92201578 reached=false groundedOk=0 finalTextLen=13
floor: ENTER … goalHash=47236b4e targetShapes=["project_plan","activity_metrics","activityExecutionTrace_write"]
floor: verdict  goalHash=47236b4e reached=false groundedOk=0 finalTextLen=251
floor: ENTER … goalHash=6fbae658 targetShapes=["llm_completion","uiPanel_write"]
floor: verdict  goalHash=6fbae658 reached=true  finalTextLen=915
```

The post-walk floor drop at `index.ts:11507` passes `seededOutputShapes` — the
walk's *inferred* target — straight into `universalToolFallback`. When the walk
has already not reached, that inference is a **refuted hypothesis**, and handing
it to the floor makes the floor try to satisfy it too. Asked for a board game,
constrained to produce `activity_recommend`, the floor emitted thirteen
characters.

Every goal in this battery that entered the floor *without* an inherited
substrate-internal shape reached and answered well. The tier that exists to give
ReAct parity when no learned pathway covers a goal is being narrowed by the
failed guess of the pathway that didn't cover it.

## Defect 5 — the gate that blocked the fix for Defect 4

The one-line repair for Defect 4 was refused:

```
feature_compose verdict=REFUSED — vacuous edit: every added line is a
declaration whose binding is never used (uf)
```

`uf` is used six times. `vacuousEditReason` (`vacuous-edit.ts:439`) counts
references in a "code only" copy built by three whole-file regex replaces that
blank string literals. The first one treats an apostrophe in a prose comment as
a string delimiter and pairs it with the next apostrophe anywhere later in the
file. Measured on `goal-host-vessel/src/index.ts`:

```
original        1,048,462 chars   uf refs 6
after ' strip     519,801 chars   uf refs 6     ← half the file already gone
after " strip     369,512 chars   uf refs 0     ← quotes now unbalanced; real code deleted
after ` strip     279,328 chars   uf refs 0     ← 73.4% deleted
```

The gate did not misjudge the edit. It judged a file with three quarters of its
code deleted, in which no binding is used, and refused accordingly. Any
declaration-line modification to a heavily-commented file trips it.

The repair filters comment lines and scopes every replace to a single line, so a
stray apostrophe can corrupt at most its own line. Verified both directions on
the real file: `uf` recovers 5 references and passes, and the case the stripping
was written for — a name bound then used only inside a string literal — still
counts one reference and is still correctly reported unused.

## The shape of it

Everything that reached, reached on the floor or on a single satisfier — the
ReAct parity floor, one step, no composition. Everything routed through the
learned plane missed. The substrate's learning has been entirely self-directed,
so its compounding advantage exists only on its own internals; on ordinary human
work it currently has a working floor, an unreachable ceiling, and a chain of
guards each of which turns a correct component into a failure: a good floor
record into a dead dispatch (2), a refuted target inference into a thirteen-
character answer (4), and a used binding into a refused repair (5).

## Fixes landed

| Defect | Change | Status |
|---|---|---|
| 1 — answer delivered as nothing | `if (isQuestionGoal && reached === true)` → `if (reached === true)` | landed `17f2e41`, live, **verified**: a goal opening "I have got two ripe avocados…" returned `answerBody` of 915 chars where the same shape previously returned 0 |
| 2 — floor id pinned as a template | `pinnableHead` declines `"universal-tool-fallback"` | landed `c303d7e`, live, **verified**: the same goal family now runs 13 walk attempts instead of dying at zero steps with `template … not found` |
| 5 — vacuous-edit false refusal | line-scoped `codeOnly` | dispatched |
| 4 — floor inherits refuted seeds | pass `[]` when `walk.reached === false` | blocked by 5; re-dispatch once 5 is live |

Both landed fixes were dispatched as goals with **verbatim** old/new anchors and
landed on the first attempt — the method now stands at 4 for 4 against roughly
one in three for described edits.
