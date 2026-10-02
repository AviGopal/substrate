# Round 4 — non-filesystem, non-arithmetic tasks: the floor is the only plane that works

Previous rounds are open to the objection that they measured file counting and
arithmetic. This round removes both. Eight goals, eight distinct kinds, **all input
data inline in the goal text** — no path is read, no number is computed from the
repo. Write code, write a regex, transform data, extract structure, debug,
translate, explain, order under constraints.

## Method: the graders were controlled before anything was dispatched

Every grader is mechanical, and each was proven in three directions **offline**:

| control | requirement | result |
|---|---|---|
| **positive** | accepts a known-correct answer | 8/8 accept |
| **negative** | rejects a plausible wrong answer | 8/8 reject |
| **echo** | rejects the goal's own text fed back as the answer | 8/8 reject |

The echo control is the load-bearing one. The floor grades on a digest that falls
back to a **scratchpad containing the goal text**, so a keyword grader could
otherwise pass on the question itself. All 24 controls passed before dispatch.

One grader was repaired mid-run, in the substrate's favour: the regex grader
originally picked one candidate line by heuristic and selected the markdown header
`## Basis`. It now tries every line and inline-code span and passes if **any**
satisfies the full spec. Controls were re-run and still hold.

**A prediction was registered before the run**, from reading the routing code:
*2–4 of 8, and an 8/8 should be treated as evidence the graders are broken rather
than as evidence of capability.*

## Result: 4/8, three on the first trial

| goal | kind | verdict | plane |
|---|---|---|---|
| cap-04 extract 5 fields from a prose note | EXTRACT | ✓ trial 1 | `universal_tool_fallback` |
| cap-07 translate a sentence to Spanish | TRANSLATE | ✓ trial 1 | `universal_tool_fallback` |
| cap-10 order 6 release steps under 6 constraints | PLAN | ✓ trial 1 | `universal_tool_fallback` |
| cap-08 explain the TCP three-way handshake | EXPLAIN | ✓ trial 2 | `universal_tool_fallback` |
| cap-01 write a `rle()` function | WRITE CODE | ✗ both trials | `fresh_derivation` |
| cap-02 write a hex-colour regex | WRITE REGEX | ✗ | `learned_pathway` |
| cap-03 CSV → JSON | TRANSFORM | ✗ both trials | `fresh_derivation`, `satisfier` |
| cap-05 find the bug in a snippet | DEBUG | ✗ both trials | — , `feature_compose` |

The prediction held. The successes are real work, hand-read:

- **cap-04** returned exactly `{"customer":"Marcus Bell","order_id":"AX-4471","city":"Rotterdam","item":"walnut desk lamp","status":"delayed"}` — five fields, all exact.
- **cap-07** returned `La biblioteca cierra a las siete los domingos.`
- **cap-10** derived `A C E B F D` by working the constraints out loud ("nothing is
  merged until the test suite has passed → A before C…").
- **cap-08** named SYN, SYN-ACK and ACK correctly — but in **one** sentence when the
  goal asked for exactly two. My grader allowed ≤4 sentences, so this is a content
  pass with a format miss, and it should be read that way.

## The finding: every success came from the floor, every failure from a smarter plane

```
universal_tool_fallback                            4 of 4 correct
satisfier / learned_pathway / fresh_derivation /
feature_compose                                    0 of 4 correct
```

cap-08 is a clean within-goal A/B: trial 1 ran on the `satisfier` plane and failed;
trial 2 ran on `universal_tool_fallback` and answered correctly. Same goal text,
same day, opposite outcome, and the plane is the variable.

This inverts the usual reading of the execution contract. The floor is supposed to
be the *worst case* — parity with a ReAct-style agent. On non-filesystem work it is
the **only** thing that works, and the learned/satisfier machinery above it is not
merely weaker: it actively converts answerable goals into false successes.

## The three wallpaper cases are worse than wrong answers

They are reach claims about artifacts that do not exist.

```
cap-02  reached:true  "The output provides a valid regex pattern that fulfills the goal requirements."
        answer body:  the goal text echoed + {"producedBy":"activity:⟨auto-bridge-sourceCode⟩",
                                              "executionId":"exec_yxkp9gq0"}
cap-03  reached:true  "The output correctly converts the CSV into a JSON array of objects."
        answer body:  None
cap-01  reached:true  (both trials)
        answer body:  None
```

The journal shows precisely what the judge graded for cap-02:

```
REACH-CONTENT sourceCode (80 chars) = {"producedBy":"activity:⟨auto-bridge-sourceCode⟩","executionId":"exec_yxkp9gq0"}
```

The `sourceCode` artifact is **80 characters of metadata pointing at itself**. No
regex was produced anywhere. The judge read that stub and asserted a valid pattern
existed. Every REACH-CONTENT artifact in the window is the same shape — 80, 97, 89,
106 characters — never content.

### The system already knows, and says so on a channel nothing reads

```
reach->mint: SKIP ungrounded reach exec_yxkp9gq0 — bare-LLM-yes / no executed-tool anchor;
             not an extractable recipe
oracle-label: consumed automated verdict=achieved for exec_yxkp9gq0
reach-patch ok (walk-complete): exec_yxkp9gq0 reached=true
```

The mint path diagnoses the reach as **ungrounded — "bare-LLM-yes / no executed-tool
anchor"** and correctly refuses to extract a recipe from it. The caller-facing
verdict says `reached=true` anyway, and the oracle writes `achieved`. Measured over
the run window: **4 of 4 ungrounded-reach skips still reported `reached=true`.**

So the honesty signal exists, is accurate, and is wired only to the learner. Nothing
connects it to the verdict the caller sees or to the oracle label. That is a
one-line-in-principle fix with a large payoff: an ungrounded reach should not be
reported as reached, and must not be labelled `achieved`.

## Two routing misroutes worth naming

- **cap-05 (debug a snippet) routed to `feature_compose`** — the code-*editing*
  path — for a goal that asked for a two-line explanation and never named a file.
  It returned nothing.
- **cap-01 (write a function) went to `fresh_derivation`** and produced a null body
  twice. Predicted in advance: `write` with no note/memory/concept noun does not
  trip the composition clause, and with no `repos/<vessel>/…` path the ask gets
  absorbed by edit-shaped targets rather than answered as text.

## An input guard that worked

The first attempt to run this suite was refused by goal-host, correctly:

```
"malformed goal: interpolation did not render"
"an unanswerable goal that is dispatched anyway collapses every attempt onto one
 goal_hash and feeds the learner beta updates for a goal nobody could answer"
```

The goal texts still carried a `{{NONCE}}` placeholder from the design phase. The
substrate caught it; my harness read the refusal as backpressure and retried for ten
minutes. The guard is right and the harness was wrong.

On coalescing: the key is exact-trimmed-goal-text and applies **only while a
dispatch is `running`** (`index.ts:12217-12225`). The harness polls each dispatch to
a terminal state before retrying, so no nonce is needed and none was used — a nonce
would change what target inference reads purely to defeat a guard we can detect. The
dispatcher now detects `coalesced:true` and does not count it as a trial.

## Status

**Capability on non-filesystem, non-arithmetic assistant work: 4/8 within two
trials, 3 on trial 1, 3 wallpaper.** Genuine successes in extraction, translation,
planning-under-constraints and explanation. Genuine failures in code generation,
regex authoring, data transformation and debugging.

Across four rounds, scored by answer and never by `reached`: **26 of 33**, with 24
on the first trial — but the composition matters more than the total. Filesystem and
arithmetic goals ran at 22/25. Non-filesystem goals run at 4/8, and every one of
those four was carried by the fallback rather than by anything the system has
learned.

**Unchanged and still open:** the `c9faf50d` regression; the `activity-api` restart
churn (mitigation still blocked by the permission classifier); gap filing still
blocked, so none of this is filed as a substrate gap.
