# Canary Registry Prune Candidates — 2026-04-27

**Source**: `https://activity.metabob.com/v2/activities/templates` (paginated)
**Templates fetched**: 2322 unique (server reports total=2767; data thinning attributed to inter-page id collisions / soft-deleted rows visible only on direct fetch)
**Candidates total** (any rule): 2322
**HIGH-confidence delete candidates** (R1+R6+R7+R8): 794

## Headline Summary

| Rule | Definition | Confidence | Count |
|------|------------|------------|-------|
| R1 | Corrupted id (⟨/⟩ chars or doubled wrap) | HIGH | 794 |
| R2 | Tags contain hyphens | MEDIUM | 9 |
| R3 | Never executed (sample_count==0) | LOW | 2074 |
| R4 | Failure-heavy (β > 3α, sc≥10) | MEDIUM | 1 |
| R5 | Stale (>90d, sc<5) | MEDIUM | 0 |
| R6 | Test / auto-generated artifact | HIGH | 13 |
| R7 | Unknown resolver reference | HIGH | 3 |
| R8 | No tasks | HIGH | 8 |
| R9 | Duplicate task graph | MEDIUM | 994 |

## Registry Spread

- Categories: feature=169, refactor=33, bugfix=22, infrastructure=312, tool=1522, meta=250, validation=2, uncategorized=6, upkeep=1, test=5
- Thompson α range: 1..7; β range: 1..10
- Created_at range: 2026-04-02T17:18:52.172347575Z … 2026-04-28T02:03:05.22530985Z

## READY TO DELETE — High Confidence (R1 + R6 + R7 + R8)

Total: **794** templates flagged. Operator should review the id list before issuing DELETE.

### R1: Corrupted id (HIGH)

- `activity:⟨API Data Fetcher with Limited Tools⟩` | category=tool | sample_count=0 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨API Data Fetcher with Tool Constraints⟩` | category=tool | sample_count=0 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨API Data Fetcher with Validation⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨API Data Fetcher⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨API JSON Fetch and Save⟩` | category=tool | sample_count=0 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨API Metrics Fetch and Validate⟩` | category=tool | sample_count=0 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨API Metrics Fetch and Validation⟩` | category=tool | sample_count=0 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨API Metrics Fetcher No-Curl⟩` | category=tool | sample_count=0 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨API Metrics Fetcher and JSON Exporter⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨API Metrics Fetcher and Validator⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨API Metrics Fetcher with Shell⟩` | category=tool | sample_count=0 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨API Metrics Fetcher with Validation⟩` | category=tool | sample_count=0 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨API Metrics Fetcher⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨API Trace Analysis Tool⟩` | category=tool | sample_count=0 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Activity Effectiveness Analysis⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Activity Metrics Report Generator⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Activity Performance Analysis⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Advanced LLM Code Review Script⟩` | category=tool | sample_count=0 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Activity Backend Traces⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Activity Data Patterns⟩` | category=tool | sample_count=0 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Activity Effectiveness Metrics⟩` | category=infrastructure | sample_count=0 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Activity Execution Statistics⟩` | category=tool | sample_count=0 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Activity Execution Traces⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Activity Performance Metrics⟩` | category=infrastructure | sample_count=0 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Activity Usage Traces⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze App Usage Trace Patterns⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze App Usage Traces and Patterns⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze App Usage Traces for Insights⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze App Usage Traces with Impulse Data⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze App Usage Traces⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Application Traces for Insights⟩` | category=tool | sample_count=0 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Application Usage Traces⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Development Loop Performance⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze GitHub Workflow Statistics⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Local Activity Execution Stats⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Local Activity Execution Traces⟩` | category=tool | sample_count=0 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Local Activity Traces⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Local Execution Trace Statistics⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Local Trace Files⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Loop Performance and Create Improvement Issue⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Loop Performance and Create Issue⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Metrics and Categorize Traces⟩` | category=tool | sample_count=0 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Metrics and Generate Improvement Recommendations⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Module Dependencies⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Performance Trace Data⟩` | category=tool | sample_count=0 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Performance Traces⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze System Health & Performance⟩` | category=tool | sample_count=0 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze System Health and Performance Issues⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Tool Usage Statistics⟩` | category=tool | sample_count=0 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Trace Data Error Patterns⟩` | category=tool | sample_count=0 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Trace Data Error Statistics⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Trace Data for Error Statistics⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Trace Error Statistics⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Trace Performance Metrics⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Traces for UX Issues⟩` | category=infrastructure | sample_count=0 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Usage Patterns from Metrics⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Usage Traces and Generate Report⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Usage Traces for Insights⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Variant Family Performance⟩` | category=tool | sample_count=0 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Workflow Configuration⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Workflow Data for Issues⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Workflow Ecosystem Health⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Workflow Effectiveness Data⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Workflow Effectiveness Issues⟩` | category=tool | sample_count=0 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Workflow Effectiveness⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Workflow Health and Activity Effectiveness⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Workflow Issues and Performance⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Workflow Issues⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Workflow Metrics for Issues⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Workflow Performance Issues⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Workflow Performance Metrics⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Workflow Performance Statistics⟩` | category=tool | sample_count=0 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Workflow Performance⟩` | category=tool | sample_count=0 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze Workflow and Activity Issues⟩` | category=tool | sample_count=0 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze and Categorize Trace Data⟩` | category=tool | sample_count=0 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Analyze and Categorize Traces⟩` | category=tool | sample_count=0 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨App Trace Analysis and Insights⟩` | category=tool | sample_count=0 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨App Trace Analysis with Insights⟩` | category=tool | sample_count=0 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨App Usage Trace Analysis⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Application Performance Analysis⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Application Performance Trace Analysis⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Application Trace Analysis & Optimization Insights⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Application Trace Analysis and Insights⟩` | category=tool | sample_count=0 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Application Trace Analysis and Optimization⟩` | category=tool | sample_count=0 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Application Trace Analysis⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Application Trace Performance Analysis⟩` | category=tool | sample_count=0 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Application Usage Trace Analysis⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Autonomous Development Loop Performance Analysis⟩` | category=infrastructure | sample_count=0 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Backend Activity Metrics Query⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Backend Activity Metrics Reporter⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Bun TypeScript API Metrics Fetcher⟩` | category=tool | sample_count=0 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨CI Pipeline Status Report⟩` | category=infrastructure | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Categorize Trace Data⟩` | category=tool | sample_count=0 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Compile Activity Effectiveness Metrics⟩` | category=tool | sample_count=0 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Compile Validation Report⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Compile Validation Results Report⟩` | category=tool | sample_count=0 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Comprehensive Activity Performance Analysis⟩` | category=tool | sample_count=0 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Comprehensive App Trace Analysis⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Comprehensive App Usage Trace Analysis⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- `activity:⟨Comprehensive Application Trace Analysis⟩` | category=tool | sample_count=1 | corrupted id (⟨/⟩ or doubled wrap)
- _… and 694 more (see manifest)_

### R6: Test artifact patterns (HIGH)

- `activity:⟨f49-canary-probe-1777303717⟩` | category=tool | sample_count=0 | test/auto-generated artifact pattern
- `activity:⟨test-activity-backend-validation⟩` | category=test | sample_count=0 | test/auto-generated artifact pattern
- `activity:⟨test-camel-case⟩` | category=test | sample_count=0 | test/auto-generated artifact pattern
- `activity:⟨test-camelcase-validation⟩` | category=tool | sample_count=0 | test/auto-generated artifact pattern
- `activity:⟨test-debug⟩` | category=infrastructure | sample_count=0 | test/auto-generated artifact pattern
- `activity:⟨test-global-template-001⟩` | category=feature | sample_count=0 | test/auto-generated artifact pattern
- `activity:⟨test-hello-world⟩` | category=tool | sample_count=0 | test/auto-generated artifact pattern
- `activity:⟨test-migration-054-multilevel⟩` | category=uncategorized | sample_count=0 | test/auto-generated artifact pattern
- `activity:⟨test-minibob-delegation⟩` | category=tool | sample_count=0 | test/auto-generated artifact pattern
- `activity:⟨test-schema-fix⟩` | category=tool | sample_count=0 | test/auto-generated artifact pattern
- `activity:⟨test-snake-case⟩` | category=test | sample_count=0 | test/auto-generated artifact pattern
- `activity:⟨test-template⟩` | category=test | sample_count=0 | test/auto-generated artifact pattern
- `activity:⟨test-verification⟩` | category=test | sample_count=0 | test/auto-generated artifact pattern

### R7: Unknown resolver references (HIGH)

- `activity:⟨activity:⟨analyze-usage-trace-patterns\⟩⟩` | category=tool | sample_count=0 | unknown resolver(s): tool
- `activity:⟨analyze-usage-trace-patterns⟩` | category=tool | sample_count=0 | unknown resolver(s): tool
- `activity:⟨create-daily-note⟩` | category=tool | sample_count=0 | unknown resolver(s): write

### R8: No tasks (HIGH)

- `activity:⟨activity:⟨core-activity-audit\⟩⟩` | category=uncategorized | sample_count=0 | no tasks
- `activity:⟨activity:⟨extract-pattern\⟩⟩` | category=uncategorized | sample_count=0 | no tasks
- `activity:⟨activity:⟨interactive-goal-executor\⟩⟩` | category=uncategorized | sample_count=0 | no tasks
- `activity:⟨create-activity-from-goal⟩` | category=uncategorized | sample_count=1 | no tasks
- `activity:⟨f49-canary-probe-1777303717⟩` | category=tool | sample_count=0 | no tasks
- `activity:⟨interactive-goal-executor⟩` | category=uncategorized | sample_count=4 | no tasks
- `activity:⟨repair-failing-tests-scoped⟩` | category=tool | sample_count=0 | no tasks
- `activity:⟨test-debug⟩` | category=infrastructure | sample_count=0 | no tasks

## REVIEW REQUIRED — Operator Judgement (R2, R4, R5, R9)

### R2: Hyphenated tags (MEDIUM)

- `activity:⟨activity:⟨core-activity-audit\⟩⟩` | category=uncategorized | sample_count=0 | hyphen tags: infrastructure.auto-created
- `activity:⟨activity:⟨extract-pattern\⟩⟩` | category=uncategorized | sample_count=0 | hyphen tags: infrastructure.auto-created
- `activity:⟨activity:⟨interactive-goal-executor\⟩⟩` | category=uncategorized | sample_count=0 | hyphen tags: infrastructure.auto-created
- `activity:⟨compose-activity-sequence⟩` | category=infrastructure | sample_count=0 | hyphen tags: self-improvement,workflow-composition
- `activity:⟨create-activity-from-goal⟩` | category=uncategorized | sample_count=1 | hyphen tags: infrastructure.auto-created
- `activity:⟨debug-failed-execution⟩` | category=infrastructure | sample_count=1 | hyphen tags: self-improvement,failure-analysis
- `activity:⟨extract-template-from-traces⟩` | category=infrastructure | sample_count=1 | hyphen tags: self-improvement,template-extraction
- `activity:⟨interactive-goal-executor⟩` | category=uncategorized | sample_count=4 | hyphen tags: infrastructure.auto-created
- `activity:⟨optimize-slow-activity⟩` | category=infrastructure | sample_count=0 | hyphen tags: self-improvement

### R4: Failure-heavy (MEDIUM)

- `activity:⟨acquire-error-log-context⟩` | category=tool | sample_count=10 | α=1 β=10

### R5: Stale (MEDIUM)



### R9: Duplicate task graphs (MEDIUM)

- `activity:tpl_1775767677880_g4maf` | category=infrastructure | sample_count=0 | duplicate task graph
- `activity:tpl_1775768158936_o207aq` | category=infrastructure | sample_count=0 | duplicate task graph
- `activity:tpl_1775804024061_i7c9t` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775806915581_h1x1sa` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775807614459_d09ca3` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775810688285_9gnl9v` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775810983646_pwevlk` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775813831946_a92aus` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775817124796_09q1va` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775820373181_a1wc9m` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775823882956_4je47f` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775824195430_u9uum7` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775824805041_3238t` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775825052865_h3dx4k` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775825307099_p0wqs` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775826097695_qpoqx8` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775826110888_nlnoo` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775828565266_24itb7` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775828598466_opq2tn` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775828606838_ln6pab` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775828734808_hh4mpd` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775828764335_piws8m` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775828939690_3r9wrw` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775828971850_yq9xta` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775829196593_jdcj6g` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775829273380_r730tt` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775829437253_5oa8wb` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775829753598_jbak94` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775831418419_l0u44j` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775831499704_l2olp4` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775834915869_fxf19p` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775835032143_pgu6e` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775835388546_w1dlx` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775835585061_v73puk` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775835652256_cvy1k` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775838361285_ogh9p` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775838619540_fj0tna` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775838625302_55t3rq` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775838750309_06646f` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775839284837_yvi847` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775842055747_u2f6w` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775842123338_n2xs8e` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775842129416_xrdm9q` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775842331388_fb7gph` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775842583222_7unl7r` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775842845548_m0ps6` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775845717273_m1q9u` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775845725000_p6kqqw` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775845830030_i8e89i` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775845850374_35enkl` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775845972955_ooqeqm` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775846023458_m1ao7q` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775846204895_f5v5bk` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775846331778_o1rjt` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775846499214_1mkmi` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775846602792_pyer52` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775849176984_vdcww` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775849416286_9pg2yf` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775849427673_q46ice` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775849620140_px1tue` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775850553675_yftsb` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775852429707_1pfzj` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775852674933_5t9dj` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775852853461_9mlhmp` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775852871097_wrbtod` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775853711607_c1prg` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775854092715_b6z9f` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775854119202_rxfx0p` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775855878317_3x6bt9` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775856050739_5c7ojh` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775856343854_iuo6se` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775856381374_7yqith` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775856409946_6w5sy` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775856473943_ktuno` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775856770971_du5stkm` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775857019875_wrlco` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775857084519_bic3v` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775859820894_hmqgd` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775859848773_b9hoa3` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775859899046_wpbp0s` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775860248014_ndcojo` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775860386773_xcunhg` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775860494235_2h4ian` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775863215875_94v5gp` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775863258278_hgogtq` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775863445651_k897q` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775863643014_0bfavc` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775863802393_vqycva` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775863829265_0ih7nh` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775864192683_hqpjzh` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775866857669_ev5hb7` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775867020888_b9de2c` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775868398709_oeuptq` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775868573948_zomp1` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775868597513_5solx3` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775868621951_4lzghi` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775868793941_vm1oih` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775869276531_apy5x` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775869496011_mewnd9` | category=tool | sample_count=0 | duplicate task graph
- `activity:tpl_1775869690281_0jpn4k` | category=tool | sample_count=0 | duplicate task graph
- _… and 894 more (see manifest)_

## OBSERVE — Leave Alone For Now (R3)

R3 (never executed) is the largest bucket. Many of these are very fresh; some are pre-execution registrations. Do **not** auto-delete; let Thompson Sampling decide via gradual decay or follow up after R1/R6/R7/R8 cleanup.
Total: 2074 templates. (See manifest for full id list.)

## Generated SQL (when admin scope arrives)

```sql
-- READY TO DELETE (high confidence; review id list above before running):
-- 794 templates total

-- First 50 for illustration; full list in /tmp/canary-prune-manifest.json under .sqlGenerated
DELETE activity_template WHERE meta::id(id) IN [
  "activity:⟨API Data Fetcher with Limited Tools⟩",
  "activity:⟨API Data Fetcher with Tool Constraints⟩",
  "activity:⟨API Data Fetcher with Validation⟩",
  "activity:⟨API Data Fetcher⟩",
  "activity:⟨API JSON Fetch and Save⟩",
  "activity:⟨API Metrics Fetch and Validate⟩",
  "activity:⟨API Metrics Fetch and Validation⟩",
  "activity:⟨API Metrics Fetcher No-Curl⟩",
  "activity:⟨API Metrics Fetcher and JSON Exporter⟩",
  "activity:⟨API Metrics Fetcher and Validator⟩",
  "activity:⟨API Metrics Fetcher with Shell⟩",
  "activity:⟨API Metrics Fetcher with Validation⟩",
  "activity:⟨API Metrics Fetcher⟩",
  "activity:⟨API Trace Analysis Tool⟩",
  "activity:⟨Activity Effectiveness Analysis⟩",
  "activity:⟨Activity Metrics Report Generator⟩",
  "activity:⟨Activity Performance Analysis⟩",
  "activity:⟨Advanced LLM Code Review Script⟩",
  "activity:⟨Analyze Activity Backend Traces⟩",
  "activity:⟨Analyze Activity Data Patterns⟩",
  "activity:⟨Analyze Activity Effectiveness Metrics⟩",
  "activity:⟨Analyze Activity Execution Statistics⟩",
  "activity:⟨Analyze Activity Execution Traces⟩",
  "activity:⟨Analyze Activity Performance Metrics⟩",
  "activity:⟨Analyze Activity Usage Traces⟩",
  "activity:⟨Analyze App Usage Trace Patterns⟩",
  "activity:⟨Analyze App Usage Traces and Patterns⟩",
  "activity:⟨Analyze App Usage Traces for Insights⟩",
  "activity:⟨Analyze App Usage Traces with Impulse Data⟩",
  "activity:⟨Analyze App Usage Traces⟩",
  "activity:⟨Analyze Application Traces for Insights⟩",
  "activity:⟨Analyze Application Usage Traces⟩",
  "activity:⟨Analyze Development Loop Performance⟩",
  "activity:⟨Analyze GitHub Workflow Statistics⟩",
  "activity:⟨Analyze Local Activity Execution Stats⟩",
  "activity:⟨Analyze Local Activity Execution Traces⟩",
  "activity:⟨Analyze Local Activity Traces⟩",
  "activity:⟨Analyze Local Execution Trace Statistics⟩",
  "activity:⟨Analyze Local Trace Files⟩",
  "activity:⟨Analyze Loop Performance and Create Improvement Issue⟩",
  "activity:⟨Analyze Loop Performance and Create Issue⟩",
  "activity:⟨Analyze Metrics and Categorize Traces⟩",
  "activity:⟨Analyze Metrics and Generate Improvement Recommendations⟩",
  "activity:⟨Analyze Module Dependencies⟩",
  "activity:⟨Analyze Performance Trace Data⟩",
  "activity:⟨Analyze Performance Traces⟩",
  "activity:⟨Analyze System Health & Performance⟩",
  "activity:⟨Analyze System Health and Performance Issues⟩",
  "activity:⟨Analyze Tool Usage Statistics⟩",
  "activity:⟨Analyze Trace Data Error Patterns⟩"
  /* … 744 more */
];
```

**Caveat**: many ids contain `⟨` literals — escape via `meta::id()` extraction or use record-id form `activity:⟨...⟩` in the WHERE. Manifest contains a pre-formatted SQL block ready to run.

## Surprises / Anomalies

- **Every template has `total_executions: 0` in the list response top-level.** The real exec counts live in `.metrics`. List endpoint does not denormalize sample_count, so any UI that filters on top-level `total_executions` sees zero everywhere.
- **Server reports `total: 2767` but pagination yields 2322 unique ids.** Confirmed by re-fetching at multiple offsets: 445-row gap. Likely SurrealDB query non-determinism on duplicate-id rows or soft-deletion not propagated to count.
- **794 templates have `⟨` literals in their id** — a 34% corruption rate. F-49 sanitization gap is much wider than the early-percolation finding suggested.
- **Doubled-wrapping** like `activity:⟨activity:⟨core-activity-audit\\⟩⟩` is real and present. Suggests a registration path that re-wraps an already-wrapped id; cleanup should focus on dedup'ing these against the canonical id (e.g., `core-activity-audit`).