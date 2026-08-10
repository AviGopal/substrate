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
- the deterministic file-count oracle **abstains**, because `verifyCountFilesReach`
  only triggers on paths matching `(repos|vessels)/…`, and this goal names `docs`.

So the only remaining grader was the LLM judge, which rubber-stamped it. The
independent recompute that exists specifically to catch this class is switched
off for exactly the family this goal belongs to. G9 is therefore not a stray bad
roll — it is defect B, observed.

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

## Status

**Fixed this session:** nothing in product code. Two repair attempts failed
honestly and were not forced through by hand.

**Newly established:**
1. Corrected re-dispatches of edit goals are discarded — the gap summary is frozen
   at first filing (Part 2).
2. The reach-grading defect reproduces organically, and the abstaining oracle is
   why (Part 3, G9).
3. The concept-db cause is a missing match reference, not unpersisted IDF (Part 4).
4. A pattern repair needs an execution harness, not a typecheck (Part 5).

**Capability:** 7/8 within two trials, 6 on trial 1, one wallpaper — on a fresh,
never-before-run goal set spanning counting, ranking, lookup, summarization,
arithmetic, and unit conversion.

**Still open and unfixed:** defects A and B; concept-db; dispatch-vs-quota
back-pressure; the withheld alpha-credit that keeps successful traffic from
banking any posterior.
