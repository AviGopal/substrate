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

### 1.2 Concept recall is structurally dead on this deployment

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

### 1.4 The floor gap: a goal with no inferable target shape has no fallback

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

### 2.4 The corrected protocol

The re-run is **serial** — one goal at a time, after the cooldown expires. Serial
is not merely gentler; it is the only way to attribute a failure to a goal rather
than to contention with its nine siblings.

