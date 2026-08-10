# Capability validation — novel goals in ≤2 trials

Objective: clear the standing blockers, then measure whether the substrate can
complete **novel** goals of the kind humans routinely ask assistants, within two
trials, with every answer checked against independently computed ground truth.

Method notes that govern everything below:

- **Ground truth is computed inside the tree the substrate reads** —
  `/workspace/git/super-repo` (HEAD `9c479776`, branch
  `fix/orphaned-capability-goalDispatchAsync`), **not** the host working copy.
  Using the host copy would have manufactured mismatches.
- **`reached` is a claim, never evidence.** Every answer is compared to ground
  truth; the two open-ended goals are judged by executing the produced command
  and by reading the real source document.
- **No goal was reworded between trials.** The point is to measure the system,
  not to coach it into a pass.

---

## Part 1 — blocker status

### 1.1 The LLM plane is live (credit for the fix is not mine)

The memory index carried *"LLM PLANE DARK, AND THE COOLDOWN SELF-RE-ARMS …
waiting cannot clear it"* as the top operator blocker. Re-probed with a **real
paid call**, not `/health`:

```
POST 127.0.0.1:8220/resolve {"type":"llm_completion","prompt":"Reply with exactly the word: ALIVE"}
-> {"content":"ALIVE","provider":"openai","model":"google/gemini-2.5-flash",
    "fallback_from":"tencent/hy3:free"}
```

`llmQuotaState` reports `openrouter` and `anthropic` **present** and
`cooldown_until_ms: null` for **all six** providers. Thompson is sampling across
five models with live posteriors. The index already records the unblock (the
RunPod arm), so this is independent confirmation rather than a discovery — note
only that the serving path here is **openrouter**, so more than one arm is wired.

Method point worth keeping: the index said waiting could not clear it, which
would have justified never testing. **Re-probe standing blockers before planning
around them.**

### 1.2 Concept recall is severed by a 10× timeout mismatch, not by the mask

> **Superseded by the experiment in §4.** The mask is real, but unmasking does
> **not** restore recall. The actual cause is a timeout mismatch, diagnosed below
> in Part 4. Read this section for the configuration state only.

`concept-db` is `inactive`, `UnitFileState=disabled`, with **no journal entries
at all** — it has never started here. The cause is explicit operator
configuration in the container env:

```
ENABLED_ROLES=spoke
DISABLED_VESSELS=concept-db.service
```

Every walk logs the consequence honestly, e.g.
`[walk-concepts] no concepts recalled for goal_hash=661709c8:1 (terms tried: integers)`.

CLAUDE.md names concept-db `compose_lesson` → drafter prompt as **the** runtime
channel by which the system is taught. With it masked, the drafter runs with no
lesson recall, so the "learned pathway" ceiling is unavailable by construction.
**Not changed during this run** — flipping it requires a container-env change and
a restart, which would have invalidated the in-flight measurement.

### 1.3 The reach judge can pass a command contradicted by its own stderr

Smoke goal: *"How many TypeScript files are in the validation directory?"*
Ground truth **74** (identical in host tree and substrate tree).

```
reached: true
reason:  "…directly answers the goal's question, despite an error in the `find`
          command's path parsing"
answer:  {"stdout":"12\n",
          "stderr":"find: '/workspace/git/super-repo/the': No such file or directory
                    find: 'directory': No such file or directory",
          "exit_code":0}
```

Two mechanisms compound, and both have precise addresses.

**(a) The deterministic oracle declines on a path regex.**
`repos/goal-host-vessel/src/index.ts:1602` `verifyCountFilesReach` is a genuinely
good oracle — it recomputes the count itself and its comments record several
hard-won corrections. But its trigger is:

```js
const dirM = goal.match(/(repos|vessels)\/[\w.-]+\/[\w./-]+/);
if (!dirM) return null;
```

It fires **only** for goals naming a `repos/…` or `vessels/…` path. A count goal
about `docs`, `validation` or `scripts` falls straight through to the fluent LLM
judge. The strong verifier is scoped to a minority of phrasings.

**(b) The honesty check reads stderr only when stdout is empty.**
`src/index.ts:6538-6543`:

```js
const exit = … ? Number(o["exitCode"] ?? o["exit"]) : 0;
if (exit && exit !== 0)      return `the command exited ${exit}` …
if (!st && stderr.trim())    return `the command produced only stderr: …`
```

With `stdout="12\n"` and `exit=0`, the two `find: … No such file or directory`
lines are never examined. A **partially** failed command that still prints
something passes clean. And because `find` exited 0 here, an exit-code-only gate
cannot catch this class either.

**Fix shape:** consult stderr for error signatures even when stdout is non-empty,
and widen the oracle's path matcher beyond `repos/|vessels/`. Both are in
`repos/goal-host-vessel/src/**`, which is gated — they must be dispatched as
goals, not hand-edited.

### 1.4 RETRACTED — this was starvation, not a structural floor gap

> **Retraction (added after the serial re-run).** Everything in this section was
> measured while the LLM plane was exhausted (Part 2). Re-run serially on a
> healthy plane, the *same goal text* behaves completely differently:
>
> ```
> under contention:  inferred_target_shapes: []          confidence 0    -> HOLLOW
> serial, healthy:   inferred_target_shapes: [shellResult] confidence 0.8 -> 5050, trial 1
> ```
>
> Target inference maps "sum the integers 1 to 100" to `shellResult` correctly
> and the walk reaches on the first trial. **There is no floor gap of the kind
> described below.** The empty inference and the random activity sampling were
> both downstream of a starved provider.
>
> The section is kept, struck, because the failure mode it describes is real and
> worth recognising — *when the plane is starved, target inference silently
> degrades to empty and the walk becomes indistinguishable from having no
> capability at all.* That is a diagnosis-confounding property worth naming: the
> observable signature of "no route exists" and "the LLM could not answer" are
> identical in the walk log.

~~The floor gap: a goal with no inferable target shape has no fallback~~

CLAUDE.md's floor is parity with a ReAct agent: *"No goal should be structurally
out of reach just because no learned pathway exists yet."*

Observed on *"What is the sum of all the integers from 1 to 100?"* — a question
needing no tool and no vessel:

```
[walk-concepts] no concepts recalled (terms tried: integers)
goal-target inference {"inferred_target_shapes":[],"confidence":0}
step 1 ran activity:⟨report-top-failures-24h⟩            status=failed new_shapes=0
step 2 ran activity:⟨obsidian-assist-active-note-delivery⟩ status=failed new_shapes=0
HOLLOW — deterministic:hollow_walklog_capped — all 2 logged walk step(s) produced
0 new shapes; LLM judge SKIPPED (it cannot out-testify the walk's own log)
```

The shell safety net at `src/index.ts:9247` **correctly declines**: it demands an
imperative-inspection verb (`count|list|find|show|how many|…`) *and* an inspection
noun (`files|directories|vessels|…`), and a sum-of-integers question is neither.
There is no other terminal.

**So the reachable set is bounded by the shape graph.** A pure-reasoning question
maps to no producible shape, gets no target, and the walk samples activities at
random until the hollow detector stops it. This is the single most important
finding for the stated objective, because *questions needing no tools are a large
fraction of what humans ask assistants*.

Credit where due: the hollow detector worked exactly as designed, and its refusal
to let the LLM judge overrule the walk's own log (`it cannot out-testify the
walk's own log`) is the right precedence. The system failed **honestly** here.

---

## Part 2 — I contaminated my own measurement, and that is itself the finding

The first attempt dispatched all ten goals **concurrently**. That run must be
discarded, and the reason is more useful than the numbers would have been.

### 2.1 What went wrong

Most trials came back `reached: false` with this reason:

```
reach verifier unreachable after retries — verdict unknown, failing closed
```

That is not a capability verdict. `verifyGoalReached` returned `null`, and
`src/index.ts:8114-8121` retries only twice with 400ms and 800ms backoff before
failing closed. The cause was in the provider logs:

```
openai error: 429 Rate limit exceeded: free-models-per-day-high-balance
[llm-resolver-vessel] all completion providers cooling — de-advertising
                      llm_completion until quota returns
anthropic: cooldown_until_ms: 1786347381810   (set during my run)
```

Ten concurrent goals, each making several LLM calls for target inference, command
synthesis, self-correction and reach judging, **exhausted the free-model daily
quota and drove the paid arm into cooldown.** By the end the plane refused
outright — honestly:

```
"no llm arm is currently servable (0 policy arm(s) checked); last-resort model
 'claude-sonnet-5' is also unwilling (no key, cooling, or cold) — refused instead
 of dialling a known-dry model"
```

**The measured failures are mostly starvation, not incapacity.** Reporting that
run as a capability result would have been a fabricated negative — the same error
class this repo's audit history keeps recording, arriving from a new direction.

### 2.2 Why this is a real finding and not just my mistake

Three things are worth keeping:

1. **The fleet degraded honestly under starvation.** It de-advertised
   `llm_completion` rather than serving a dry arm, failed reach closed rather than
   guessing, and refused the last-resort model explicitly. Nothing invented a
   green.
2. **The retry budget is mismatched to the failure it guards.** 400ms/800ms is
   sized for a transient blip. The actual outage mode is a **daily** quota cap,
   so every in-flight goal converts to `reached:false` regardless of merit. A
   verifier outage and a genuine miss are recorded identically, which makes reach
   statistics unreliable exactly when the plane is stressed.
3. **Concurrency has no back-pressure against the shared LLM budget.** Nothing
   between "dispatch 10 goals" and "the plane is dry" pushed back. This is the
   compose-storm failure mode (30 concurrent typecheck runs on 8 vCPU) in a new
   resource: last time CPU, this time provider quota.

### 2.3 Two of my ten goals had ambiguous ground truth

Also my error, caught before scoring. `docs` holds **17** markdown files at the
top level and **60** recursively:

- *"…all markdown files in the docs directory"* — 17 and 60 are both defensible.
- *"…largest markdown file in the docs directory"* — `docs/SUBSTRATE.md`
  top-level, `docs/architecture/SUBSTRATE_AS_MDP.md` recursively.

Both readings are scored correct in any re-run. **A goal whose ground truth
depends on an unstated convention cannot measure the system**, only my phrasing.

### 2.4 An aside that is also evidence: the substrate committed my file for me

While writing this, `git add` staged this report and, before I could commit, the
substrate's own `substrate-pull-sync` ran a commit and **swept my staged file
into its commit** — `19b027ba feat(pull-sync): converge the selector and the
fleet definition too`. My content is in the tree under a message about something
else entirely.

Two things follow.

**A hazard.** An operator staging files in a repository the substrate
self-commits has no safe window: `git add` publishes into a shared index that
another writer may commit at any moment. Stage-then-commit is not atomic against
a concurrent committer. The practical rule is to commit in one step, or to work
outside the tree the substrate writes.

**Evidence for the thing being validated.** `19b027ba`, `4e21e9f0` and
`9c479776` all landed during this session with no operator hands, and the
pull-sync commit body is a real diagnosis in its own right — it identifies that
`/usr/local/bin/apply-inventory` is what `entrypoint.sh` executes rather than the
git copy, so *"a selection feature added in the repo never reached any running
container."* That is the same class of defect this session's configuration audit
found by hand, found independently by the system, and committed autonomously.
Against CLAUDE.md's hard criterion — *"a substrate-authored commit landing on the
remote working branch with no operator hands"* — that criterion is met.

### 2.5 The corrected protocol

The re-run is **serial** — one goal at a time, after the cooldown expires. Serial
is not merely gentler; it is the only way to attribute a failure to a goal rather
than to contention with its nine siblings.

---

## Part 3 — the serial result

**7 of 7 goals correct, all on the first trial, zero wallpaper.**

Scoring rule: a goal passes only if a trial's **answer matches ground truth**.
`reached` is recorded but is never the verdict — this session had already
observed `reached:true` on an answer wrong by 6×.

| goal | asked | answer | trials |
|---|---|---|---|
| count-sh | `.sh` scripts directly in `scripts/substrate` | **36** ✓ | 1 |
| git-branch | current git branch | **fix/orphaned-capability-goalDispatchAsync** ✓ | 1 |
| count-lines | lines in `CLAUDE.md` | **361** ✓ | 1 |
| list-repos | every subdirectory of `repos` | all **22** names ✓ | 1 |
| arithmetic | sum of integers 1–100 | **5050** ✓ | 1 |
| oracle-path | `.ts` files in `repos/goal-host-vessel/src` | **47** ✓ | 1 |
| summarize | two-sentence summary of `FEDERATION.md` | accurate ✓ | 1 |

Every answer was checked by hand against a value computed independently, not by
reading the reach verdict.

### 3.1 How the successes actually happened

Six of seven ran on the **satisfier plane** — `VESSEL-RESOLVE SATISFIER produced
"shellResult" directly … REACHED via 1-step chain`. This is the ReAct-parity
floor doing exactly what CLAUDE.md specifies, and it is fast: most reached in
15-30 seconds.

Three behaviours are worth calling out because they are the difference between a
system that works and one that merely reports working:

- **Self-correction fired and fixed a bad command.** `count-sh` logged
  `executor "shellResult" cold-command self-correction attempt 1 — now produces a
  value`, then returned the right answer.
- **A hollow result was caught and recovered, not shipped.** `count-lines` first
  logged `refusing to satisfy … HOLLOW — the goal asked for the number of lines in
  CLAUDE.md, but the output does not contain this numerical value`, dropped to
  `execution_path=universal_tool_fallback`, and came back with 361.
- **The deterministic oracle fired where it applies.** `oracle-path` graded
  `deterministic:verified-file-count — counted 47 .ts file(s) recursively`, i.e.
  the grader recomputed the answer itself rather than asking an LLM whether the
  output looked right.

### 3.2 The oracle was right and my ground truth was wrong

I scored `oracle-path` against **34**; the oracle answered **47**. The oracle won:

| tree | `.ts` under `goal-host-vessel/src` |
|---|---|
| `/workspace/git/super-repo/repos/…` (where I measured) | 34 |
| `/workspace/git/vessels/…` (pull-sync clone, what the oracle counts) | **47** |
| `/vessels/…` (deployed) | **47** |

The oracle documents in-source that it counts the clone the repos-relative path
denotes. The super-repo submodule is simply behind. **Two of three trees agree
with the system; my ground truth came from the stale one.** This is the
three-trees hazard the memory index warns about, and I walked into it while
building the instrument meant to catch it.

### 3.3 The ceiling does not accumulate — the one real capability finding

Every satisfier-plane success logged:

```
WITHHELD alpha-credit for satisfier:shellResult — no in-chain producer-to-consumer
edge and no landed sha
```

So the system **solves these goals and banks nothing from them**. The floor is
genuinely met; the ceiling (a learned pathway that makes the second instance
cheaper) is not being built from this traffic, because a one-step satisfier reach
has no producer-to-consumer edge to credit. This is consistent with the prior
finding that reuse donors are 96% one shape — the traffic that succeeds is
exactly the traffic that earns no posterior.

That is the substantive gap this validation found, and it is a *learning* gap,
not a capability gap.

### 3.4 Conditions and honest caveats

- `concept-db` was masked throughout, so **every** run logged
  `concept-db could not be asked — recall unavailable`. All seven succeeded
  without lesson recall; what recall would add is untested.
- The substrate **restarted itself mid-run** (it landed `be14a118`, bumping
  goal-host and llm-resolver). Four goals in run 1 were refused with
  `{"draining":true}` — the vessel declined rather than swallowing them, which is
  correct behaviour, but it consumed those goals' trials. They were re-run.
- The two ambiguous goals (§2.3) were dropped rather than scored.
- Sample size is 7. This demonstrates capability on common assistant tasks; it is
  not a reach-rate estimate.


---

## Part 4 — the concept-recall blocker, diagnosed by intervention

Every walk in this session logged
`[walk-concepts] concept-db could not be asked — recall unavailable`. CLAUDE.md
names concept-db `compose_lesson` → drafter prompt as **the** channel by which
the system is taught, so this is the ceiling blocker. §1.2 assumed the cause was
the `DISABLED_VESSELS=concept-db.service` mask. It is not.

### 4.1 The intervention

`systemctl start concept-db` — reversible, no env change, no container restart.
It came up cleanly: `status: healthy`, database connected, embedding model
loaded, and it immediately began upkeep (minting `compose_lesson` concepts,
backfilling embeddings). Discovery picked it up: **13 → 14 vessels, 371 → 386
shapes**, with `concept`, `concept_select_for_prompt` and friends advertised.

Two goals dispatched afterwards **still** logged `concept-db could not be asked`.
So the mask was not the blocker.

### 4.2 The actual cause

The recall path resolves correctly — `conceptDbUrl()` filters discovery results
by `/concept-db/i`, so the fact that `development-vessel` also advertises shape
`concept` (and is listed first) is correctly excluded. The resolved URL is right.

The call itself is what fails:

```
GET  /health                    -> 200 in 0.02s
POST /v2/impulses/resolve       -> 200 in 41.75s      <-- the recall call
```

and the caller allows four seconds:

```js
recallConceptRows(_q3, 5, 4_000)      // src/index.ts:9062
```

**A 4s budget against a ~42s provider.** `recallConceptRows` returns `null` on
timeout, and `null` is correctly reported as "could not be asked" rather than
"nothing found" — the code is scrupulous about that distinction. The result is
that recall has never once succeeded here.

concept-db's own logs name the reason it is slow:

```
WARN [searchConcepts] BM25 scores all zero (SurrealDB 3.0 IDF not persisted)
     — applying term-frequency proxy ranking {"term":"substrate","matchCount":110}
```

The full-text index is not persisting IDF under SurrealDB 3.0, so every query
degrades to a term-frequency proxy that scans the matched set. **The blocker is a
search-index regression, surfacing as a timeout, masquerading as a masked
vessel.**

### 4.3 Why this matters more than it looks

- **`/health` is green throughout.** The vessel answers liveness in 20ms while
  its only load-bearing route takes 42s. This is the same lesson the
  configuration audit recorded — *a health probe that asks "is my process up"
  cannot detect that the thing it exists to do is broken.*
- **Unmasking would have looked like a fix.** The vessel starts, registers, and
  reports healthy. Anyone verifying by `systemctl is-active` and
  `registry/stats` would have declared recall restored, and every walk would have
  gone on silently failing open.
- **Order of repair:** fixing the BM25/IDF persistence (or adding an index-backed
  path) comes first; raising the 4s budget without it just moves a 42s stall into
  every goal's critical path. Unmasking is last, not first.

### 4.4 State restored

`concept-db` was stopped again (`systemctl stop concept-db`) and is `inactive`;
`DISABLED_VESSELS=concept-db.service` was never edited, and the registry is back
to 13 vessels / 371 shapes. **Nothing about the deployment's configured state was
changed by this experiment.** It was left off deliberately: until the search
regression is fixed, recall cannot succeed within the caller's budget, and the
vessel's upkeep loop competes for the same scarce provider quota that Part 2
showed is the binding resource.
