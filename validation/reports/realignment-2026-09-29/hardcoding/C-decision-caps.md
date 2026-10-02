# TOPIC C — truncation / size caps on decision paths (census 2026-10-01, read-only)

Paths are relative to /home/avi/documents/work/substrate/repos. Line numbers are at the current working tree.
V = visible to the consumer (marker / "N of M"); P = partial (generic word only); S = silent.

## Decision caps

| # | file:line | cap | truncates | consumer | vis |
|---|---|---|---|---|---|
| 1 | goal-host index.ts:10962 / :10983 | 1500 per shape / 8000 total | pool digest (pool first, captured digest second) | reach judge verifyGoalReached (walk) -> beta, failure memory, concept lesson | P: prompt says "(truncated ...)" ALWAYS (:3992), even when nothing was cut; no per-item N of M; no answer priority (pool insertion order puts the terminal shape at the END, so the 8000 total cut removes it first) |
| 2 | goal-host index.ts:14603-14606 (captureReachDigest) | 600 / 4000 | per-exec captured digest feeding #1 and the incremental early-reach check (:10885-10888, 1500/8000 on top) | reach judge | S. These are the "shape-name era" 600/4000 caps that 7506f16 raised in the pool path only |
| 3 | goal-host index.ts:14306-14309 | 600 / 4000 | template-path content digest | verifyGoalReached + recordDeterministicLabel (goal_verification_label) | S |
| 4 | goal-host index.ts:5334, 5369, 5371 | 6000 | ReAct floor finalText/scratchpad -> digest | reach judge + deterministic oracles | S (the comment calls it "a truncated observation dump") |
| 5 | goal-host index.ts:3559/3966-3970 (consumers of `dig`) | inherits #1-#4 | citation verifier / recomputeIndependently read the digest | deterministic oracles | S. A truncated digest makes an oracle abstain or mismatch (comment at :3678/:3701 says it degrades to the LLM) |
| 6 | dev-vessel feature-compose.ts:1287 | 8000 | unified diff | semantic gate (LLM verdict on a landing) | S |
| 7 | dev-vessel feature-compose.ts:6951 | 1500 | semantic_gate reason into the record | landing record / lessons | S |
| 8 | goal-host index.ts:7234 / :7236 | 2000 / 3000 | answer / basis blocks of humanPresentation | human surface | S |
| 9 | goal-host index.ts:11361 (answerBody Basis), :10975 | 1500 per shape, then 3000 | answer the human reads in the vault; also the goal_answer pool shape | human + pool | S |
| 10 | goal-host index.ts:11432 / :11459 | 4000 | bridge body -> concept writeback (`goal_finding`) | concept-db (learning write, later recall) | S |
| 11 | goal-host index.ts:9741 | 2000 | poolProvenance contentPreview (mirrorWalkState) | human surface ledger | V (`chars`, `truncated:true`). The "totality-on-demand" path in the comment at :9731 was never built |
| 12 | goal-host index.ts:12325 / :12343 | 1600 per concept / 4000 total | recalled lessons -> walkConceptContext + _dispatchLessons | target inference + arg synthesis | S (3496df5 raised 300->1600 after a cut command) |
| 13 | goal-host index.ts:7627 | 120 summary / 400 content | PAYLOAD GUIDANCE concepts | arg-synthesis prompt | S. This is the same class as 3496df5 at 400 |
| 14 | goal-host index.ts:7669 | 800 per shape | PRIOR FINDINGS | arg-synthesis prompt | S |
| 15 | goal-host index.ts:8248 / :8291 | 8000 per finding / 8000 raw | bound findings -> terminal write body; processTerminalContent prompt | terminal artifact (human/vault) | S |
| 16 | goal-host index.ts:8094 | 1200 | priorVerdictFeedback (failure recall) | retry synthesis prompt | S |
| 17 | goal-host index.ts:4156 (rememberGoalFailure), :16762-16764 | 600 | hollow reasons -> failure memory | failure recall | S (low impact: reasons are short) |
| 18 | goal-host index.ts:9005 / :9007 | 1200 + 2500 data block / 1500 + 1500 | external-evidence window | corrector LLM | V (states the elision and M) — model to copy |
| 19 | goal-host index.ts:9152 | 12000 | API response | single-value extraction prompt | S |
| 20 | goal-host index.ts:5497 | 4000 | final_text persisted in the trace | trace readers / operator | V ("…[truncated N chars]" + final_text_len) |
| 21 | goal-host floor-observation.ts:83 | walkBudget-shaped (default 4000 / 12000) | floor tool observations | floor ReAct LLM | V + pointer — EXISTING SEAM |
| 22 | llm-resolver tool-result-bound.ts:53+ | llmModelPolicy-shaped | tool results in the tool loop | tool-use LLM | V + pointer — EXISTING SEAM |
| 23 | dev-vessel feature-compose.ts:3200-3217 | 26000 budget, 6000 per file | target file windows | drafter | V ("(truncated)" / "windowed") |
| 24 | dev-vessel feature-compose.ts:2918 | 400 per principle | concept principles | drafter | S |
| 25 | dev-vessel feature-compose.ts:3783/3787/2475 | 1500 / 600 / 1500 | prior tsc failures, consequences, raw_excerpt | drafter | S |
| 26 | dev-vessel feature-compose.ts:2515 / :2634 | 4000 / 2000 | SYMBOLS / CONTRACT block | drafter | S (the CONTRACT cut can drop the 3rd contract) |
| 27 | dev-vessel feature-compose.ts:6374-6375 | 4000 tsc / 24000 file | typecheck-repair prompt | repair LLM | S (guarded after the fact by truncatingRewriteReason) |
| 28 | dev-vessel escalation-disposition-apply.ts:193 | 2000 | human answer -> gap metadata | gap/drafter | S (incident 09-14: answers of 3,041-4,383 bytes cut) |
| 29 | concept-db resolvers/concept.ts:176 + services/embedding.ts:18 | 2000 chars, then MAX_SEQ_LEN=128 tokens | concept embedding | semantic recall ranking for every lesson | S. Recall effectively ranks on about the first 100 words (inference from the code) |
| 30 | dev-vessel concept-write.ts:140 | 2000 | fallback raw content | concept store | S |
| 31 | dev-vessel template-repair.ts:248 | 4000 | template description | template store / selection | S |

Not char caps, but the same class (decision-input truncation): the feature-compose plan is cut silently at maxOps (classes/hollow-landing), and the activity-api discover-by-shapes candidate set was cut by recency before the Thompson draw (fixed in 1d9701d by sampling first and truncating after).

| 32 | goal-host index.ts (all LLM verdict/synthesis calls) | max_tokens | judge/terminal-synthesis OUTPUT | reach | S: 0 reads of stop_reason/finish_reason in index.ts (a820b31e fixed only compose) |
| 33 | activity-api embedding-service.ts:311 | 128 tokens | template/task embeddings | recommend/discover ranking (inference) | S, same window as #29 |

Existing readers of a truncation marker: human-surface form-census.ts:160-173 (refuses truncated previews by design); human-surface routes/impulses.ts:510-520 (policy-shaped visibleSliceSize with a per-request override recorded in the trace = the 'ask for the rest' pattern).

## Log-only caps
Out of 494 `.slice(0,N>=100)` / `.slice(-N)` / `substring` hits in the six vessels' src (tests excluded):
- about 280 are log, tap, error or detail strings (keyword heuristic: goal-host 64/163, development-vessel 197/304, activity-api 3/15, concept-db 1/9, llm-resolver 2/2).
- About 170 more are ids, titles, gap summaries, slugs and query strings (spot-read).
- About 35 are the decision caps above.
The split is a heuristic and has not been audited line by line.

## History (incidents and outcomes)
- 06-24 600/4000 -> 06-25 7506f16 1500/8000. The incident was "content not shown" on genuinely reached goals. The fix landed only in the pool path; captureReachDigest and the template path are still 600/4000 (#2, #3).
- 06-18 1a9d385a: the patcher's ReAct history was cut at 800 chars, so non-trivial edits exhausted. The fix shows the latest result at 6000.
- 08-06 9cd1dd7: escalation re-dispatch cut goals at 400 chars. 0 of 158 decompose goals kept an anchor+replacement pair. The cap was removed. Memory: "66% of decompose-gaps are their parent's body truncated at 400".
- 08-09 65adb623: the verify failure stored its first 300 chars, which is the banner. That taught the drafter the wrong failure class. The fix stores the tail. a820b31e: a draft cut at max_tokens was credited as complete; stop_reason is now read.
- 08-15 3496df5: recalled lessons cut at 300 chars dropped the working command, and the drafter invented params. Raised to 1600. f7289d8 / 21314ec: the evidence window showed the preamble and hid the data. Now first/last with a stated elision, then centred on the data rows.
- 09-10 13f7d07: a 400-char truncation minted a nonexistent edit_site. Lesson: "a truncation safe for prose is a correctness bug for a path".
- 09-14: escalation answers were cut at 2000 chars, which removed load-bearing scope (#28; still open).
- 09-22 e439de0 -> 3bd2a46: a producer-side "<2500 chars" cap manufactured "incomplete" hollow verdicts and was reverted the same day.
- 09-26 hollow-landing: the plan is silently truncated at maxOps (1/3 edits applied, still FAVORABLE).
- 10-01 cea3f4a4 (from the brief): a 4,965-char correct report was cut to 1500 -> "incomplete" -> beta penalty + concept lesson.
Pattern: each fix raised one number at one call site (the anti-pattern "Specific paths instead of seams"). Sibling sites kept the old cap (#2/#3 vs #1; #13 vs #12).

## REALIGNMENT mapping
- §2.2 (one reader) lists fail-open branches that become abstains (C5). A truncated verdict input is a fail-open the doc does not list. The reach verdict that feeds goal_verification_label/beta is computed on a possibly-truncated digest, and nothing records that it was.
- §2.1 (evaluator) has no row for "verdict input completeness". A selfFactSpec row could assert digest_len == source_len (or truncation recorded) for every label.
- §2.0b: floor-observation.ts is already the Rank-0 seam for observation bounding (pointer, shaped budget).
- §2.3 cites the 13f7d07 truncation as a fabricated-field case.
- §6.2 "Specific paths instead of seams" fits the history exactly.
- §7: silent on this topic. It would ride step 1 (slice verified at the consumer) and step 5.
- Explicitly silent: reach-judge input size, human-surface answer caps, concept embedding window, lesson recall caps.

## Proposal
Consolidate: generalise floor-observation.ts + llm-resolver tool-result-bound.ts into one shared `boundContent` helper (packages/ or goal-host). Do not mint a third helper.
- Inputs: items [{shape, role: answer|terminal|evidence|context, text}] and a budget read from a shape (walkBudget / llmModelPolicy fields, law 1).
- Order: answer/terminal shapes first, at full length up to a high cap. Evidence goes next and context last.
- Every cut is visible: head + tail (or the f7289d8 data-centred window) + "[shown X of N chars]" + a pointer.
- It returns {text, cuts:[{shape, shown, size}]}, which is recorded in the trace and on the goal_verification_label.
- Verdict guard: if the answer/terminal item was cut, the LLM judge must abstain on completeness (reached=null / "insufficient view"). A truncated input never yields a hollow verdict or a beta update. Drop the unconditional "(truncated …)" phrase at :3992.
- Classify each cap as decision vs log, with a lint/expectation row: a `.slice(0,N)` whose result reaches an LLM prompt, a label, a concept write or a human block must go through the helper.

Migration order, by impact:
1. Reach judge digests (#1-#5), consolidating the three digest builders into one.
2. Semantic gate diff (#6).
3. Human answer/basis/bridge (#8-#10, #15). The human gets the full answer, plus the totality-on-demand pointer that #11 promised.
4. Lesson/guidance/prior-findings into arg synthesis (#12-#14, #16).
5. Drafter blocks (#24-#28).
6. Concept embedding window (#29): chunk or embed the summary plus the head of the artifact.

Verification:
- Positive control: replay cea3f4a4's 4,965-char report (and a synthetic 20k correct answer) through the judge. Expect reached=true and cuts=[].
- Negative control: the same report with its last section deleted. Expect reached=false.
- Truncation control: a forced tiny budget must produce an abstain, not a hollow verdict.
- Check at the consumer: the label row carries the cuts.

Builder: goal-host index.ts and feature-compose.ts are in autonomyScope.excluded_paths (REALIGNMENT §2.0), so the items are as follows.
- Steps 1, 2, 3 and 5 are (a), operator bootstrap under operator identity.
- The helper module itself and the concept-db embedding (#29) are (b) dispatched goals, if they sit outside the excluded set. The realignment records cite the entry as the FILE `repos/goal-host-vessel/src/index.ts`, not the directory, so floor-observation.ts is probably outside the set (inference: the live record was unreadable because discovery returned no poolImpulse producer, which is an address failure).
