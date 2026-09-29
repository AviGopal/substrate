# Completeness critic, round 2 (across both rounds)

Read-only checks run 2026-09-29 (UTC). Inputs: `raw/critic.md` (round-1 critic), the round-2 coverage statements, a grep of every round-2 raw file for each residual topic, the `openspec/changes` listing, the transcript directory, `records/`, and three live read-only checks on substrate-live (`/workspace/git/*` clones and the human-surface unit).

## 1. Round-1 gaps: status

| # | Round-1 gap | Status | Evidence |
|---|---|---|---|
| 1 | reports-2..8 raw files refused | PARTIAL | `records/reports-{2..8}.json` exist (33-51 KB each), so the detail is durable. There is still no `raw/reports-{2..8}.md`, and any synthesis that greps `raw/*.md` will miss these seven shards. Synthesis must read `records/*.json` too. |
| 2 | openspec 109-176 unread | CLOSED | Every non-stray directory at index >= 100 is referenced by at least one of openspec-7/8/9/10 (checked by grep). The "active plans" were spread over shards 7-10, not in the ranges the shards were named for, but between them all of these are covered: live-self-view, causal-attempt-ledger, consumer-side-landing-probes, contained-self-development, decentralized-compose-ownership, do-anything-surface, human-surface-stack, obsidian-legibility-surface, unified-install-interface, value-per-cost-selection and the five 08-26..09-12 proposal-only entries. Stray http-response/json/tsc fossils: covered by 7/8/9/10. |
| 3 | openspec archive unread | CLOSED | openspec-10 covers all 4 archive entries. resumable-landings `design.md` was not read, which is minor. |
| 4 | 49 session transcripts unmined | CLOSED (text only) | Every jsonl id prefix appears in a transcripts-* file (0 uncovered). Caveats: tool_result bodies, sidechains and 520 peer-relay messages were not mined, so the numbers are the operator's reported readings and not re-measured. |
| 5 | predecessor/adjacent operator memory | MOSTLY CLOSED | memory-adjacent read devbob (70 live notes plus 374 archive descriptions), substrate-utils, metabob-mcp, metabob-dashboard and exp-repo. Still open: the **01-30..04-22 hole** (no memory, no transcripts) and the metabob-mcp/dashboard transcripts (9 files, about 20 MB, unmined). |
| 6 | syzygy-local-* uncovered | CLOSED (local side) | syzygy.md. Hub-side (syzygy.host) journals and relay state need SSH and are still uncovered. |
| 7 | node-2 journals | CLOSED | node2-runtime.md. Open: registry contents (the /vessels endpoint returns 404) and whether a node-2 dispatch is visible to the hub's goal_status. |
| 8 | federation relay live state | CLOSED | federation-relay.md. It found that `.relay-pub-key.protobuf` is a **private key** sitting untracked in the working tree. |
| 9 | validation/ outside reports/ | MOSTLY CLOSED | validation-other-1/2/3 cover findings, results, substrate-authored, adversarial-probes, gaps, state, investigations, failure-modes and scripts. Still open: `validation/dev-responses/`, `state/agent-coordination.json`, `state/shortest-paths.json`, the probe JSON bodies, and **the 947+ non-md evidence receipts under validation/reports/ subdirs**. Counts: container-lifecycle-audit 227, substrate-live-integration 214, lifecycle rerun 190, install-demo 133, self-care-evidence 49, substrate-technical-investigation 27, autonomy-readiness 23, settled-outcome-debit 19. No shard checked them. The receipts behind the 26/26 MET and PASS claims are still unaudited. |
| 10 | vessel-repo docs and .claude tooling | CLOSED | vessel-docs-tooling.md. The 67 K8s-era fossil docs were only classified in bulk. |
| 11 | concept-db content and other tables | CLOSED | concept-db-db.md: 45 compose_lessons, 719 architecturePrinciples, 1,991 doc-concepts, concept_edge, oracle tables, impulse. It did not analyse the content of thompson_selection_log or context_thompson_scores. |
| 12 | pre-09-18 gap history | CLOSED (with holes) | gap-history.md. For 08-16..09-07 the only surviving copies are operator job snapshots. Two 08-07 temps are unparseable. audit-findings-batch.json and gap-conceptgraph.json were not analysed. |
| 13 | timer outputs without readers | CLOSED | timers-readers.md: 46 node-1 timers and 16 node-2 timers. The rhythm families were not enumerated one by one. |
| 14 | cross-shard claimed-fixed-then-broken timeline | **OPEN (synthesis)** | No shard owns it. The inputs now exist: transcripts-1..4 claims tables, memory-1..10, gap-history recurrence families and reports-5 chains. The join is still to be done. |
| 15 | keep/fossil join of live executions vs activities/resolvers/templates | **OPEN (synthesis)** | The pieces are spread across files: live-activities, live-resolvers, git-devvessel-2, timers-readers (writers without readers), openspec-8/9/10 (strays, scaffold) and validation-other-3 (script callers). No single join has been built yet. |

Round-1 residue items with no owner in either round:
- The pool: 17 of 21 orphaned tmp snapshots, trace-spool and mitosis-applied.jsonl. openspec-8 only mentions mitosis-applied.
- `causal-attempt-ledger/backup-trace-store-reconcile/`, never read.
- The uncommitted diffs of `autonomy-ledger-2026-09-20/soak-log.tsv` and `causal-attempt-ledger/GAPS_OBSERVED.md`, never diffed.
- obsidian-vessel and concept-db July autonomous diffs, and repos/deployment history in depth. These are low value.

## 2. New finding from this critic's live check

- **human-surface-release is now a fossil clone, and a memory claim is stale.** MEMORY.md (09-22) says "human surface runs from `/workspace/git/human-surface-release` — grep the UNIT". The live unit today is `WorkingDirectory=/vessels/human-surface-vessel` with `ExecStart=bun /vessels/human-surface-vessel/src/index.ts`, and it is active. `/workspace/git/human-surface-release` is a full super-repo clone (5,033 commits) frozen at `da2515d8`, 2026-09-22 14:51 (an operator-bypass submodule bump). No unit, script or /usr/local/bin entry references it (grep of /etc/systemd/system, /usr/local/bin and /workspace/active-scripts returned nothing). Keys: `sync-deploy-drift`, `codebase-bloat-fossils`, `docs-drift` (the operator cache is stale).
  - Consequence: the 09-22 "authorability = submodule membership" fix moved the surface into the image layer (`/vessels`). Per memory, `/vessels` is the IMAGE LAYER, so the live human surface may once again sit outside any push clone. **Not verified**: whether `/workspace/git/vessels/human-surface-vessel` now exists as a push clone. This is the load-bearing check for "can the substrate author its human surface".
- `/workspace/git/ledger-u-probe` holds causal-attempt-ledger fixture runs (last commit `c410578`, 09-26 05:09, "ledger U probe run12-…"). It is test residue left in the live workspace. Key: `test-residue-live-state`.
- `/workspace/git/{compose,universal-tool-fallback,remotes}` resolve to the enclosing repo's HEAD `aef8161c0` (09-07 "Automated commit"). They are not independent repos, so their provenance is unknown. They may be fossil directories.

## 3. Load-bearing items still uncovered (ranked)

1. **Cross-shard recurrence timeline (#14).** The user named this failure directly: "same issue, same reason, different hat, each time proclaimed resolved". Round 2 produced the inputs; the join still has to be built, keyed on (class key, identifier), where the identifier is a file:line, table, field, env var, commit or port. Without it, the realignment cannot tell which recurrences share a root.
2. **Keep/fossil join (#15).** This is the user's other explicit ask ("organize the fossils and resolvers such that they are available"). It needs one table: activity/resolver/template/timer/script → executions in the last N days → reader exists? → replaced-by. The inputs exist; the join does not.
3. **Evidence receipts under validation/reports/ subdirs (947+ files).** PASS/MET claims (container-lifecycle 26/26 MET, install-demo, self-care, autonomy-readiness) have never been checked against their receipts. Given the false-verification and operator-instrument-fault density, these claims are unaudited.
4. **Human-surface authorability, re-checked today** (section 2). The 09-22 fix may have regressed through the image-layer move.
5. **Born-closed gap pollution in the gap-triple denominator.** openspec-8 found 3,372 born-closed pseudo-gaps from goal-host auto_draft in a 6,278-row store. Any gap close-rate metric (law 7) computed on the live store is inflated unless those rows are excluded. No shard recomputed the gap triple without them.
6. **Security residue that needs operator action**, not research: a private relay key untracked in the working tree, and a hub admin API key (read, write, admin, no expiry) printed in transcript f37f1a1a 09-03T00:48 in ~/.claude/projects. Rotation status is unknown.
7. Node-2 visibility: whether a node-2 dispatch is observable from the hub, and the contents of the node-2 registry. This matters for node-locality and is not established.
8. Lower priority: the 01-30..04-22 history hole; metabob-mcp/dashboard transcripts; `validation/dev-responses`; the pool tmp snapshots, trace-spool and mitosis-applied; `backup-trace-store-reconcile`; the do-anything falsifiers 1, 2 and 5 (never measured); the discovery registry on the syzygy hub (needs SSH).

## 4. Key merge map (both rounds)

Principle: fold singletons into seed keys. Keep a new key only when it names a distinct, recurring **generator**.

| from | to | note |
|---|---|---|
| install | sync-deploy-drift | Same as round 1. |
| goal-vocabulary-regex | goal-walk-floor | |
| operator-authorship-recursion | gap-content | The missing gap generator. |
| gap-store-integrity | trace-store-db | Both rounds used this key. Consider renaming the target `state-store-integrity`. |
| schema-ownership | trace-store-db | |
| runaway-amplification | spend-envelope-throughput | |
| llm-plane-availability | spend-envelope-throughput | |
| llm-provider-plane | spend-envelope-throughput | Round-2 name for the same availability/credential/arm-cooling class as llm-plane-availability. |
| llm-plane-misdiagnosis | operator-instrument-fault | **Revised from round 1** (was false-verification). It is the operator's own probe misreading the LLM plane. |
| failure-as-absence | false-verification | The system's judge reads a negative as OK. |
| shell-exec-bounds | false-verification | |
| landing-attribution | false-verification | |
| failure-reason-dropped | write-read-mismatch | |
| path-root-ambiguity | write-read-mismatch | |
| auth-credential-plumbing | endpoint-routing | |
| edit-primitive-safety | drafter-quality | |
| stale-whole-rewrite | autonomous-regression | |
| self-repair-conflict | autonomous-regression | |
| concurrent-operator-sessions | test-residue-live-state | |

Keys kept distinct:
- **operator-instrument-fault** (new in round 2). Its boundary with false-verification: false-verification is a *system* gate or predicate passing something wrong; operator-instrument-fault is the *operator's* probe giving a false negative or false positive (wrong address, host port vs in-container, `grep -c`, exit codes, mtime). transcripts-3 counted 40 or more instances, which makes it the dominant operator-side generator, and MEMORY's "negative is unattributed until a positive control" law is its rule.
- **credential-hygiene**: do NOT fold it into endpoint-routing, which is what round 1 did. Leaked keys (a relay private key, a hub admin key in a transcript) are a security-remediation class, not a routing defect.

Boundary rules (unchanged from round 1): hollow-landing (the artifact) vs false-verification (the judge); dormant-mechanism (no invoker) vs codebase-bloat-fossils (residue or duplicate once replaced); autonomous-regression vs directed-overshoot (split by author); endpoint-routing ⊂ write-read-mismatch; memory-recall is primary over write-read-mismatch for memory.

## 5. Process notes for synthesis

- The shard index labels for openspec did not match the real `ls` ordering. Shards 8 and 9 both flagged this. Future sharding should use explicit name lists.
- Several round-2 shards derive "later" evidence only from MEMORY.md index lines (transcripts-1/2/3). A claimed-fixed entry whose "later" column is sourced from MEMORY.md is operator cache, and law 10 says the cache is derived. Mark those rows as needing live re-verification.
- validation-other-1 established that activity counts in validation/ are from a July-only window (activity_execution_traces 07-13..07-14, 18,135 rows). They must not be used for current keep/fossil decisions; use the `execution` table (09-24 onward, 150k cap).
