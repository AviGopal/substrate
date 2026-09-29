# Completeness critic — realignment sweep 2026-09-29

The checks below were run read-only on 2026-09-29. They are inventory counts only; I did not read content.

## 1. Output durability of the sweep itself (most urgent)

- Only **24 of the 32 collector raw files exist** in `raw/`. `reports-1` is the only reports raw file.
  **reports-2 … reports-8 were refused by the Write tool** and exist only as structured records inside the orchestrator.
  That leaves 7 of the 8 report shards (about 160 reports, including CHECKINS, GAPS_OBSERVED, MECHANISM-AUDIT, WHY-THINGS-KEEP-BREAKING and COMPLETED_REPORT) with **no durable detail**.
  The orchestrator should persist those records to `raw/reports-{2..8}.md` before synthesis, or the "raw file holds the rest" promise is false.
- The report-shard numbering is only stable because `raw/*.md` sorts after `PROCESS_*`. The new raw files now sit at positions 129–161 of `find validation/reports -name '*.md'`.
  Any re-run keyed on sed ranges will shift. Future shards should use an explicit file list.

## 2. Sources NOT covered

### 2a. openspec — 68 of 176 top-level entries plus the archive (HIGH)

The collectors covered listing entries 1–108 only. Entries 109–176 were not read, and they are the **most recent and most active plans**:

| change | last commit | tasks done/open |
|---|---|---|
| contained-self-development | 09-28 | 34/23 |
| decentralized-compose-ownership | 09-28 | 42/2 |
| value-per-cost-selection (+ goals/, the untracked 1.5e goal) | 09-28 | 26/15 |
| 2026-09-24-live-self-view | 09-28 | 11/2 |
| consumer-side-landing-probes | 09-27 | 0/7 |
| causal-attempt-ledger | 09-26 | 0/36 (the ledger ran 12 times regardless) |
| unified-install-interface (modified in the working tree) | 09-23 | 1/50 |
| 2026-09-12-host-independent-federation-join | 09-14 | proposal only |
| 2026-08-29-cross-vessel-wiring-repair | — | proposal only |
| 2026-08-28-escalation-disposition-executor | — | proposal only |
| 2026-08-27-live-recipe-rescues-failed-partner | — | proposal only |
| 2026-08-26-reuse-before-mint-crossfamily-dedup | — | proposal only |
| 2026-08-26-large-file-edit-capability | — | proposal only |
| do-anything-surface | 08-07 | 0/0 |
| human-surface-stack | 08-07 | 0/0 |
| obsidian-legibility-surface | 07-19 | 0/0 |

- **archive/**: 4 entries were never read. They are 2026-05-17-stratified-goal-generator-harness, 2026-05-30-autonomous-palette-write-resolvers, 2026-05-30-substrate-gap-drafter-wiring and 2026-09-24-resumable-landings (23/0, the only archived "done" change in September).
- **Stray residue at openspec/changes/ top level**, which is itself codebase-bloat-fossils evidence:
  - about 45 http-response resolver `.ts/.js/.d.ts/.map` files (http-response-camel, new-simple-…, fix-…, types)
  - route-edit-9077062c-*.json ×3
  - gap-msvqgv4y-*.json ×3
  - config-patch.json, impulses-patch.json, patch-config-types.json
  - delete-old-http-response*.json
  - add-goal-summary-*.json ×5
  - 2026-08-18-*.json ×3

  These are substrate-authored landings that landed in the wrong tree. The openspec-5/6 collectors read an earlier cohort of the same family; this later cohort is unread.

### 2b. Session transcripts — the richest record of "previous attempts" (HIGH)

- `~/.claude/projects/-home-avi-documents-work-substrate/*.jsonl`: **49 transcripts, 885 MB, 08-29 → 09-28**, with 8 of them on 09-28. None were mined.
  They hold the actual attempt → error → "fixed" claims that memory notes only summarise, and they are where a "proclaimed fixed" can be timestamped against later contradiction.

### 2c. Predecessor projects' operator memory (MEDIUM)

These hold pre-substrate history, the same failure classes under older names:
- `-home-avi-documents-work-exp-repo-metabob-devbob/memory`: 70 files. This is the metabob-devbob era, before the super-repo's 01-30 start.
- `-home-avi-documents-work-substrate-utils/memory`: 18 files.
- metabob-mcp (the cockpit): 3 memory files and 3 transcripts.
- metabob-dashboard: 9 memory files and 6 transcripts.
- exp-repo: 3 memory files.

### 2d. validation/ outside reports/ (MEDIUM)

- findings/ 81 files.
- investigations/ 245.
- failure-modes/ 3,342 (the failure-mode harness corpus).
- results/ 46.
- substrate-authored/ 17.
- adversarial-probes/ 15.
- gaps/ 9. These may hold **pre-09-18 gap-store history**; the live store collapsed and holds almost nothing before 09-18.
- state/ 5 (lift-status and closure-status were read by openspec-1 only).
- validation/scripts/ 292, which was counted as a census only. Its callers were not verified against the script-retention law.
- **947 non-md evidence files under validation/reports/**: container-lifecycle-audit 227, substrate-live-integration 214, lifecycle rerun 190, install-demo 133, self-care-evidence 49, and others. Every collector skipped them, so receipts behind "PASS" claims were never checked.
- `autonomy-ledger-2026-09-20/soak-log.tsv` and `causal-attempt-ledger/GAPS_OBSERVED.md` both have **uncommitted working-tree changes** (+6 lines in GAPS_OBSERVED). The collectors may have read a different version than HEAD.
- `causal-attempt-ledger/backup-trace-store-reconcile/` was not read.

### 2e. Documentation outside super-repo docs/ (MEDIUM)

- Vessel repo docs: 112 `.md` files at depth ≤3 under repos/, 10 per-vessel CLAUDE.md files, and READMEs. The docs collectors only read super-repo `docs/` and CLAUDE.md/README.md.
- The `.claude/` tooling was not audited against reality: the metabob-substrate skill, the deploy skill, the 4 hooks (vessel-edit-gate, memory-mirror, session-start, session-end) and commands/. These are the operator's teaching channel, and they may encode stale tool names or endpoints.
- 3 untracked guides (CONTAINER_NETWORK_LIFECYCLE, HUMAN_PROJECT_LIFECYCLE, SYZYGY_LOCAL_SURFACE) were read by docs-2, but they are not committed.

### 2f. Deployments and nodes (HIGH for node-locality and federation)

- **Two more running containers, `syzygy-local-surface` and `syzygy-local-inventory`, were covered by no collector.** A third deployment exists (a surface/inventory profile), and its gap store, memory, registry and journals are unknown.
- Node 2 (compose2-live) was only partially covered:
  - gap store (70 rows): covered
  - notes.json and standing.json: covered
  - discovery stats: covered
  - unit active-state: covered
  - **journals: not inspected by anyone**
  - DB: none
  - clone HEADs were matched for some repos only; goal-host and dev-vessel were matched, but the obsidian and human-surface clones were not checked on node 2.
- Federation relay and peers: no collector queried the relay's live peer table, replication state or `.relay-pub-key` provenance. Relay history came from git only. The untracked `scripts/substrate/federation-relay/.relay-pub-key.protobuf` sits in the working tree and is a credential-hygiene flag.
- Host super-repo working tree: **11 submodules and 7 scripts/units are modified but uncommitted**:
  - Dockerfile.substrate
  - gen-env.sh
  - setup-git-push.sh
  - Makefile
  - dev-vessel units
  - .claude/settings.json

  Deployment drift between the host, the image and the container clones was only partly characterised by git-deployment.

### 2g. Repos with thin or no history coverage

- human-surface-vessel, clock-vessel and relevance-sink-vessel are plain files, not submodules. The live human surface runs from `/workspace/git/human-surface-release`, and **no collector read that clone's history**. That matters because it is the one surface the substrate cannot author.
- repos/deployment (helm/k8s, 1,014 commits): summary only.
- workbench: subjects only, from host.
- obsidian-vessel: about 180 July autonomous diffs were seen as numstat only.
- concept-db: July autonomous diffs were not read.
- Submodule-internal history for discovery-vessel and identity-vessel was read from the **host**, which may lag the live clone (git-small matched these, but only via HEAD equality).
- Super-repo commits between 01-30 and 01-31 were missed by git-super-1, which started at 01-31. There were 2 or more commits on 01-30. This is trivial.

### 2h. Live stores and tables not surveyed

- Concept-db: counts and group-bys only. Nobody read concept content, architecturePrinciple rows, concept_edge (count only), the bodies of the 57 compose_lessons, or whether their `edit_site` targets match live files.
- SurrealDB:
  - the `execution` table is capped at 150k rows and covers only 09-24 onward
  - history before 09-24 came only from trace_digest and July activity_execution_traces
  - **not surveyed:** the oracle/feedback corpus (provide_feedback verdicts), refusal_events in full, and goal_verification_labels beyond counts
  - `impulse`/concept tables were not surveyed
  - thompson_selection_log was covered for 7 days only
  - init_migrations vs sql/migrations was covered for activity-api only; the other vessels' migrations were not checked
- Gap store:
  - auto-draft-decisions.jsonl was not read
  - the body of landability_predictions.log (66,866 lines) was not read
  - 12 of the 14 orphaned gaps.json.*.tmp files were not read; 2 are unparseable
  - **no collector reconstructed the pre-09-18 gap history** from the tmp files, the .bak files, validation/gaps or git history
  - the 47 files in /workspace/parked-landings were counted but not read
- Pool: 17 of the 21 orphaned tmp snapshots were not read. Nobody read trace-spool, mitosis-applied.jsonl, or node 2's watchdog log.
- Journals: retention starts at **09-25** on node 1. Any claim about runtime behaviour before 09-25 rests on reports and memory, not logs.
- Timers: git-deployment listed about 40 timer scripts, but **nobody checked whether the timers' outputs have readers**, and that is exactly the write-read-mismatch class.

### 2i. Analyses nobody did (cross-cutting)

- No collector built a **"claimed fixed → later broken" timeline across sources**. Each collector downgraded outcomes only within its own shard. The recurrence alignment the user asked for ("same issue, different hat") needs a cross-shard join on class key plus identifier (file:line, table, env var, commit), and nobody holds that join yet.
- Nobody checked whether the 7 recurrence chains listed by reports-5 are still open **today** against live code in one pass. Only spot checks exist: v_activity_score is still read (paradigm.ts:606/2205), the `SELECT … FROM template` hardcode (surreal.ts:384) is still unfixed, and the retirement sweep has still retired 0.
- No census of **what is actually executing now**, meaning activities with executions in the last 5 days, against the 4,010 activity rows and 257 dev-vessel resolvers. live-activities and git-devvessel-2 each hold half of this, and they need joining to produce the keep/fossil list the user asked for.

## 3. Class-key merge map (near-duplicates)

These singleton or small keys should fold into the seed keys:

| from | to | reason |
|---|---|---|
| install | sync-deploy-drift | install/boot path is deploy drift |
| goal-vocabulary-regex | goal-walk-floor | target inference vocabulary |
| operator-authorship-recursion | gap-content | operator-authored goals = missing gap generator (law 6/13) |
| gap-store-integrity | trace-store-db | persistence-store integrity; consider renaming the target to `state-store-integrity` |
| schema-ownership | trace-store-db | migrations and schema |
| runaway-amplification | spend-envelope-throughput | flood and amplification is throughput control |
| failure-as-absence | false-verification | negative read as OK (missing view → empty) |
| shell-exec-bounds | false-verification | 30s shell kill turned the post-land suite into a silent pass |
| landing-attribution | false-verification | unaccounted and misattributed landings |
| llm-plane-misdiagnosis | false-verification | unattributed negative |
| llm-plane-availability | spend-envelope-throughput | capacity and starvation |
| failure-reason-dropped | write-read-mismatch | reason written nowhere a reader looks (failure side had no store) |
| path-root-ambiguity | write-read-mismatch | `repos/` prefix strip/join mismatch between producer and consumer |
| auth-credential-plumbing | endpoint-routing | Bearer vs ApiKey, request addressing |
| credential-hygiene | endpoint-routing | same seam; flag secrets separately |
| edit-primitive-safety | drafter-quality | duplicate anchors double-insert |
| stale-whole-rewrite | autonomous-regression | stale-base rewrite reverts other landings |
| self-repair-conflict | autonomous-regression | substrate self-repair conflicting with itself |
| concurrent-operator-sessions | test-residue-live-state | operator/experiment activity contaminating live state and denominators |

The following overlapping seed pairs are **boundary definitions, not merges**. Record the rule so collectors stop double-keying:

- **hollow-landing vs false-verification.** hollow-landing covers the artifact: the commit is inert. false-verification covers the judge: a gate or predicate passes something wrong. The recurring super-class "green flag over broken artifact" spans both, so tag hollow-landing as primary when a commit exists.
- **dormant-mechanism vs codebase-bloat-fossils.** dormant-mechanism is code with no invoker. codebase-bloat-fossils is residue files and duplicates. A dormant mechanism becomes a fossil once a replacement exists.
- **autonomous-regression vs directed-overshoot.** Split by author only; the same defect classes appear in both.
- **endpoint-routing is a sub-class of write-read-mismatch** (producer addresses where the consumer isn't). Keep the key for grep-ability.
- **memory-recall overlaps write-read-mismatch.** The 680 knowledge notes unread were a write-read mismatch. Primary key: memory-recall.

## 4. Priority recommendations for a follow-up sweep

1. Persist reports-2..8 structured records to raw files.
2. Read openspec entries 109–176 and the archive, especially the 7 active September changes.
3. Mine the 49 session transcripts for claim→contradiction timestamps. Grep for "fixed", "closed", "✅", "landed" against later "still", "regressed", "again".
4. Survey syzygy-local-surface/inventory and node-2 journals.
5. Join live execution with the activity/resolver inventory to produce the keep/fossil list.
6. Reconstruct pre-09-18 gap history from tmp, .bak, validation/gaps and git.
7. Audit validation/{findings,investigations,results} and the evidence receipts behind PASS claims.
