# Blocker clearance and a second capability demonstration

Method note that governs everything below: a goal **passes only when its answer
matches a ground truth computed independently, in the tree the substrate actually
reads** (`/workspace/git/super-repo`). `reached` is recorded as data and never
used as the verdict. This run justifies that rule — one goal returned
`reached:true` on a wrong answer, and nothing but the paired ground truth caught it.

All dispatches were **strictly serial**. The earlier contaminated run in
`capability-validation.md` established why: N concurrent dispatches exhaust the
shared provider quota, target inference degrades to `[]`, and "no route exists"
becomes indistinguishable from "the LLM was starved."

---

## Part 1 — blocker status, re-probed rather than assumed

| blocker | status | evidence |
|---|---|---|
| LLM plane dark | **clear** | real paid call returns `ALIVE` via openrouter → `google/gemini-2.5-flash`; `llmQuotaState` shows openrouter + anthropic present, `cooldown_until_ms: null` on all six providers |
| `llmCompletion` advertised-but-unresolvable | **clear** | `/health` and the registry now both carry `llm_completion` *and* `llmCompletion`; 362 shapes registered |
| reach grading passes broken commands | **CONFIRMED, reproduced organically** | see Part 3, G9 |
| concept recall dead | **re-diagnosed — my earlier cause was wrong** | see Part 4 |
| dispatch-vs-quota back-pressure | **open, unfixed** | nothing bounds concurrent dispatch against provider quota |
| alpha-credit withheld on satisfier wins | **open, unfixed** | every satisfier success logs `WITHHELD alpha-credit` |

No failed systemd units. `substrate-live` up 2 days.

---

## Part 2 — the finding that caps operator-driven repair

**A repair goal re-dispatched with corrected instructions is a no-op.**

Repair A (fix the stderr honesty gate) was dispatched twice with *materially
different* goal texts — the second explicitly opening "A previous attempt failed
because it edited the wrong block: it anchored inside the earlier `if (pol)`
branch." Both trials produced:

- the same `goal_hash` (`1ef8d7d8:1`),
- the same gap (`route-edit-1ef8d7d8:1`),
- the same wrong anchor in `fc-plan` (`if (bo[f] === false) ...`),
- the same semantic-gate rejection.

Reading the gap back after trial 2 shows its `summary` is still **trial 1's text,
1945 characters, verbatim**. The correction never reached the drafter. For
edit-intent goals, trial 2 is structurally guaranteed to repeat trial 1, which
caps the "two or fewer trials" contract at *one real attempt*.

Two things are worth separating here, because I could only establish one of them:

- **Established:** two different goal texts for the same file+intent map to the
  same gap, and the gap summary is frozen at first filing.
- **Not established:** the mechanism. The logged `goal_hash` is *not*
  `goalHashOf(raw goal)` — I computed FNV-1a over the exact texts and neither
  matches, and a known goal text (`How many TypeScript files are in the
  validation directory?` → logged `a6739df8:1`) also fails to reproduce its
  logged value. So some normalization sits between the goal and the hash that I
  did not pin down. Stated as an open question, not a diagnosis.

### What the substrate got right here

The system **caught its own inert patch**. The semantic gate rejected the draft
with exactly the critique the change deserved:

> "The patch adds a new stderr check to a block that is conditionally executed
> based on `pol.flagFields`, which is not the `_degenerateReason` helper... The
> `stderr` variable is also initialized as an empty string, meaning the new
> condition will never be met."

It then refused to claim a reach (`deterministic:edit-intent-no-landed-edit`)
rather than reporting the failed compose as success. Both repair attempts failed
**honestly**. That is the behaviour the design asks for.

---

## Part 3 — capability demonstration, round 2

Eight goals, none reused from the previous round, all ground truths recomputed
against `/workspace/git/super-repo` immediately before scoring.

| goal | task kind | answer | verdict |
|---|---|---|---|
| G1 largest file in `docs` recursively | ranking + size | `SUBSTRATE_AS_MDP.md`, 77428 bytes | ✓ trial 1 |
| G2 `.md` in `openspec` recursively | counting | 241 | ✓ trial 1 |
| G3 17 factorial | pure arithmetic | 355,687,428,096,000 | ✓ trial 2 |
| G4 250 miles → km | unit conversion | 402.33 | ✓ trial 1 |
| G7 first line of `README.md` | lookup | `# substrate — a self-improving development substrate` | ✓ trial 1 |
| G8 summarize `docs/SUBSTRATE.md` | summarization | accurate, 2 sentences | ✓ trial 1 |
| G9 directories directly inside `docs` | counting | **10 (truth 9), both trials** | ✗ **wallpaper** |
| G10 length of `'substrate'`×12 | reasoning | 108 | ✓ trial 1 |

**7/8 correct within two trials; 6 on trial 1. One wallpaper.**

Two goals are worth reading closely.

**G3** failed trial 1 with no answer at all and succeeded on trial 2 — the retry
budget earned its keep exactly once.

**G9 is the valuable result.** It reproduces, organically and on a fresh goal,
the reach-grading defect that I could *not* reproduce on demand earlier in the
session:

```
{"shape":"shellResult","stdout":"10\n","stderr":"","exit_code":0}
reason: "The output correctly indicates the count of directories directly
         inside the docs directory, fulfilling the goal's intent."
```

The synthesized command omitted `-mindepth 1`, so it counted `docs` itself:
`find docs -maxdepth 1 -type d | wc -l` → 10, against a true 9. Confirmed by
running both forms.

This failure is **invisible to every gate the system currently has**:

- `exit_code` is 0, so the exit-code branch cannot fire;
- `stderr` is empty, so the stderr branch cannot fire *even if defect A were
  fixed* — this case would survive that repair;
- the deterministic oracle **abstains twice over** (below).

So the only remaining grader was the LLM judge, which rubber-stamped it.

### G9 abstains for two independent reasons, and only one of them is defect B

I first recorded this as "defect B, observed." That is half right, and the half
that is wrong matters, because it would have made repair B look like the fix.

1. **Path family — defect B.** `verifyCountFilesReach` only triggers on paths
   matching `(repos|vessels)/…`, and this goal names `docs`.
2. **Unit family — a separate, previously unrecorded gap.** The guard
   `countsSomeOtherUnit` declines the goal *before* the path regex is even
   reached, because this oracle answers "how many **files**" and G9 counts
   **directories**. Verified by executing the guard:

   ```
   DECLINED  How many directories are directly inside the docs directory?
   accepted  How many markdown files are in the docs directory?
   ```

   That decline is correct behaviour — the comment above it records a real
   incident where claiming a file count for a different unit produced 20/20
   reached and 0/20 correct. The gap is that **nothing picks the goal up
   afterwards**: of the sixteen `verify*Reach` oracles in this file (files, git
   commits, aggregates, ranks, averages, two-source compare, gap ratios, shape
   producers, deps), **none counts directories** — for any path, including
   `repos/`.

**Consequence: landing repair B would not fix G9.** It would fix the path
abstention for *file*-count goals naming `docs`, `scripts/…`, `openspec`,
`validation`, or `packages`. G9 would remain wallpaper until a directory-count
oracle exists. The correct post-fix probe for B is therefore a **file**-count
goal such as "How many markdown files are in the docs directory?", graded by the
presence of the `deterministic:verified-file-count` marker in the walk log —
not by a right answer, which a freshly synthesized command could produce on its
own.

G9's **second trial returned the same wrong answer**, so this is deterministic,
not variance. Its reach reason is the sharper statement of the defect:

> "the output '10' is a valid numerical count"

The judge graded the answer's **form**, not its truth. A grader that checks
whether a count *looks like* a count will pass every plausible wrong number,
which is why the independent recompute — not a better prompt — is the load-bearing
repair.

### Incidental observation

G4 (a unit conversion) wrote two empty UI panels as a side effect —
`uiQuestion_write` and `uiPanel_write`, both titled "Untitled" with empty bodies.
A pure-reasoning goal should not be minting UI surface objects.

---

## Part 4 — concept recall: my earlier cause was wrong

`capability-validation.md` recorded the cause as "BM25 IDF not persisted under
SurrealDB 3.0." That was me repeating **the code's own log message** as if it
were a diagnosis. Reading the source overturns it:

`repos/concept-db/src/resolvers/concept.ts:398-413` builds both FTS statements as

```sql
SELECT *, search::score(0) AS fts_score FROM concept
WHERE content @@ '<term>' AND org_id = $org_id ... ORDER BY fts_score DESC
```

`search::score(0)` addresses **match reference 0**, but the bare `@@` operator
registers no match reference for it to bind to. The migration that defines the
index (`sql/core/004-bm25-search.surql:20-27`) documents the numbered form
`content @0@@ $query` as the intended pattern, and `git log -L` on the function
shows the numbered form was **never used**. `Number(c.fts_score ?? 0)` then turns
an absent score into 0 — producing exactly the observed all-zeros signature.
"IDF not persisted" is an in-code hypothesis that was never tested.

Separately, the ~41s latency is not the term-frequency fallback (pure TypeScript
over ≤60 rows). It is `SELECT *` materialising `content` plus two 384-dim f32
embedding vectors for every matched row, with `ORDER BY` forcing a full sort
before `LIMIT` can truncate. The sibling dense query already fixes this with
`OMIT content_embedding, summary_embedding`; the FTS queries never were. The 009
migration header documents this same fault ballooning surreal to ~30GB.

**Not fixed, and deliberately not dispatched.** concept-db is masked
(`DISABLED_VESSELS=concept-db.service`), pull-sync skips masked units, so the
change would land on `origin/dev` and never deploy or be measurable here. Landing
a medium-confidence, unverifiable change to a masked vessel is how a wrong mint
happens. Filed as a diagnosis instead.

---

## Part 5 — a repair proposal that was caught before it burned a dispatch

The scouted fix for defect B was to widen the alternation to
`(repos|vessels|docs|scripts|openspec|validation|packages)`. Executing it against
a case list — rather than reading it — showed it is **inert**: the pattern body
after the group is `\/[\w.-]+\/[\w./-]+`, which demands two further path
segments, so `docs` and `scripts/substrate` still fail to match.

A second candidate that fixed the inertness introduced a **false positive**:
`\b(...|packages)\b` matches "How many packages are there?", which would make the
oracle count a directory the goal never named — a wrong deterministic verdict,
strictly worse than abstaining.

The pattern that passes all eleven cases, including four false-positive traps:

```
/(repos|vessels)\/[\w.-]+\/[\w./-]+|\b(?:docs|scripts|openspec|validation|packages)\/[\w./-]+|\b(?:docs|openspec|validation|packages)\b(?=\s+(?:directory|folder|dir)\b)/
```

Baseline matches 1/7 of the probe cases; this matches 11/11 of the extended set.

The reusable lesson is the method, not the regex: **a pattern-matching repair must
be verified by executing the pattern against a case list.** Typechecking cannot
distinguish a working pattern from an inert one, and both candidates above would
have typechecked, landed, deployed, and reported `reached:true`.

---

## Part 6 — repair B landed green, fixed nothing, and introduced a regression

Repair B was dispatched once, as a fresh goal (so the frozen-summary problem in
Part 2 did not apply). It reported success on trial 1:

```
EARLY EDIT-INTENT ROUTED to feature_compose → verdict=FAVORABLE
landed SHA c9faf50d41cc3dd4ecf686b2acf16ad090c83d03
reached: true   execution_path=feature_compose   attempt_count=1
```

It typechecked, the semantic gate passed it, a real commit landed, and it
deployed to `/vessels` within minutes. **The named function was never touched.**

The goal text named `verifyCountFilesReach` explicitly, twice. The regex landed
at line 1232, inside **`verifyRegistryInventoryReach`** — a different oracle.
`verifyCountFilesReach` at line 1628 still carries the original pattern:

```
1232:  const dirM = goal.match(/(repos|vessels)\/...|\b(?:docs|scripts|...)/);   <- landed here
1628:  const dirM = goal.match(/(repos|vessels)\/[\w.-]+\/[\w./-]+/);            <- the target, unchanged
```

The polarity is inverted too: the target site reads `if (!dirM) return null;`
(abstain when no path is named); the landed site reads `if (dirM) return null;`
(abstain when one is). The pattern was written for the first meaning.

### The regression

The line it replaced was a **broader** abstention test. Executing both against
real goal strings:

| goal | abstained before | abstains now |
|---|---|---|
| How many shapes does `src/foo` serve? | yes | **no** |
| How many vessels advertise `a/b`? | yes | **no** |
| How many shapes are in the registry for `my-tool/thing`? | yes | **no** |

So `verifyRegistryInventoryReach` now **claims** goals it previously declined —
the exact scope-misrepresentation the function's own comment exists to prevent
("this oracle's parse cannot represent the goal's scope, so it must abstain").
The change is live in `/vessels` and `in_flight` was 2 at the time of checking.

**This is the session's strongest evidence for the reach-grading thesis.** For an
edit goal, `reached:true` means *a commit landed*, not *the requested change was
made*. It is the same failure as G9 one level up: G9's judge accepted a number
for being shaped like a count; this judge accepted a commit for being shaped like
a landing. Neither checked the thing it was supposed to check.

Note also that the semantic gate is **inconsistent**: it caught repair A's
wrong-block edit with a precise critique, and passed repair B's wrong-function
edit. Whatever it checks, it is not "does this patch modify the function the goal
named" — a check that is cheap, deterministic, and would have caught B.

**Recommended and NOT performed:** revert `c9faf50d`. It is an unrequested
behaviour change to a grading oracle, pushed to the shared `dev` branch and
already deployed. Reverting means pushing to shared `dev`, which is outward-facing
and was not part of the authorization to dispatch repairs, so it is left for an
explicit decision rather than done unilaterally.

## Status

**Fixed this session:** nothing. Repair A failed honestly (twice). Repair B
reported success, edited the wrong function, and left a regression behind.

**Newly established:**
1. Corrected re-dispatches of edit goals are discarded — the gap summary is frozen
   at first filing (Part 2).
2. The reach-grading defect reproduces organically; G9 abstains on **two**
   independent grounds, only one of which is defect B, and no directory-count
   oracle exists at all (Part 3).
3. The concept-db cause is a missing match reference, not unpersisted IDF (Part 4).
4. A pattern repair needs an execution harness, not a typecheck (Part 5).
5. An edit goal's `reached` verdict tests that a commit landed, not that the named
   function changed — and the semantic gate does not check it either (Part 6).

**Regression introduced by this session:** `c9faf50d` narrows the abstention test
in `verifyRegistryInventoryReach`. Live. Revert recommended, not performed.

**Capability:** 7/8 within two trials, 6 on trial 1, one wallpaper — on a fresh,
never-before-run goal set spanning counting, ranking, lookup, summarization,
arithmetic, and unit conversion.

**Still open and unfixed:** defects A and B; concept-db; dispatch-vs-quota
back-pressure; the withheld alpha-credit that keeps successful traffic from
banking any posterior.
