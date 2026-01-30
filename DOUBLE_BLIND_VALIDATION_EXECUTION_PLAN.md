# Double-Blind Architecture - Validation & Implementation Plan

**Created**: 2026-01-30  
**Purpose**: Execute validation loop using meta-activities to ensure compliance across all three repositories  
**Architecture**: FINAL_ARCHITECTURE_SUMMARY.md  

---

## Overview

We have created a **self-improving validation system** using meta-activities that will:

1. ✅ **Validate** compliance across metabob-cli, metabob-opencode, metabob-rpc-api
2. ✅ **Generate** implementation activities for missing functionality
3. ✅ **Execute** activities in lockstep across all three repos
4. ✅ **Re-validate** to confirm fixes work
5. ✅ **Verify** validation detected improvements

---

## The Meta-Activities We'll Use

### 1. `validate-double-blind-architecture`
**Purpose**: Validate compliance with FINAL_ARCHITECTURE_SUMMARY.md

**What it validates**:
- **metabob-cli**: MCP tools return pure CPG (no scores)
- **metabob-opencode**: Agents use RPC API (no internal metrics)
- **metabob-rpc-api**: Server implements Thompson Sampling (hidden from agents)
- **Integration**: Data flows correctly, double-blind property preserved

**Output**:
- `METABOB_CLI_VALIDATION.md`
- `METABOB_OPENCODE_VALIDATION.md`
- `METABOB_RPC_API_VALIDATION.md`
- `CROSS_REPO_INTEGRATION_VALIDATION.md`
- `IMPLEMENTATION_ROADMAP.md`

### 2. `create-from-validation`
**Purpose**: Analyze validation failures and generate implementation activities

**What it does**:
- Analyzes validation output JSON
- Categories missing functionality by type
- Groups into logical activities
- Generates activity template JSON files
- Creates execution plan with dependencies

**Output**:
- `templates/generated/double-blind/*.json` (activity templates)
- `GENERATED_ACTIVITIES.md` (index and execution order)
- `VALIDATION_ANALYSIS.md` (detailed analysis)

### 3. `validate-create-verify-loop`
**Purpose**: Orchestrate complete validation → creation → execution → verification cycle

**What it does**:
- Runs initial validation
- Generates activities using `create-from-validation`
- Executes activities in dependency order
- Re-runs validation
- Verifies validation detected improvements
- Generates comprehensive report

**Output**:
- `LOOP_STEP_1_INITIAL_VALIDATION.md`
- `LOOP_STEP_2_CREATED_ACTIVITIES.md`
- `LOOP_STEP_3_EXECUTED_ACTIVITIES.md`
- `LOOP_STEP_4_FINAL_VALIDATION.md`
- `LOOP_STEP_5_VALIDATION_VERIFICATION.md`
- `VALIDATION_LOOP_COMPLETE_REPORT.md`

---

## Execution Plan

### Option A: Complete Automated Loop (Recommended)

Run the full validation → creation → execution → verification cycle:

```bash
# Execute complete loop
opencode activity run validate-create-verify-loop \
  --var validation_activity_id=validate-double-blind-architecture \
  --var target_system=double-blind-learning-system \
  --var fail_fast=false \
  --var min_success_rate=80 \
  --var min_improvement=20 \
  --var min_sensitivity_rate=50
```

**What happens**:
1. Runs `validate-double-blind-architecture` → identifies gaps
2. Runs `create-from-validation` → generates activities
3. Executes generated activities → implements missing pieces
4. Re-runs validation → confirms fixes
5. Verifies detection → ensures validation works
6. Generates report → documents everything

**Duration**: ~2-4 hours (depending on missing implementations)

---

### Option B: Step-by-Step (Manual Control)

Execute each step manually for more control:

#### Step 1: Run Initial Validation

```bash
opencode activity run validate-double-blind-architecture
```

**Outputs**:
- `METABOB_CLI_VALIDATION.md`
- `METABOB_OPENCODE_VALIDATION.md`
- `METABOB_RPC_API_VALIDATION.md`
- `CROSS_REPO_INTEGRATION_VALIDATION.md`
- `IMPLEMENTATION_ROADMAP.md`

**Review** the validation reports to understand what's missing.

---

#### Step 2: Generate Implementation Activities

```bash
opencode activity run create-from-validation \
  --var validation_output_file=CROSS_REPO_INTEGRATION_VALIDATION.md \
  --var target_system=double-blind-learning-system \
  --var output_directory=templates/generated/double-blind
```

**Outputs**:
- `templates/generated/double-blind/*.json` (8-15 activity templates)
- `GENERATED_ACTIVITIES.md` (execution plan)
- `VALIDATION_ANALYSIS.md` (detailed breakdown)

**Review** the generated activities and execution order.

---

#### Step 3: Execute Generated Activities

```bash
# Read execution order from GENERATED_ACTIVITIES.md
cat GENERATED_ACTIVITIES.md

# Execute each activity in order
# Example for first few activities:

# Phase 1: Fix metabob-cli
opencode activity run fix-mcp-tool-search-issues
opencode activity run fix-mcp-tool-analyze-impact
opencode activity run fix-mcp-tool-suggest-changes

# Phase 2: Implement RPC API foundation
opencode activity run implement-text-embedding-service
opencode activity run setup-surrealdb-schema
opencode activity run implement-recommendation-endpoint

# Phase 3: Integrate OpenCode
opencode activity run create-rpc-client
opencode activity run integrate-recommendation-flow
opencode activity run implement-feedback-submission

# Continue with remaining activities...
```

**Important**: 
- Follow the execution order from `GENERATED_ACTIVITIES.md`
- Some activities may have dependencies (must run in order)
- Others can run in parallel

---

#### Step 4: Re-run Validation

```bash
opencode activity run validate-double-blind-architecture
```

**Compare** with initial validation to see improvements.

---

#### Step 5: Verify Validation Sensitivity

```bash
opencode activity run validate-validation-activity \
  --var validation_activity_id=validate-double-blind-architecture \
  --var target_system=double-blind-learning-system \
  --var validation_command="opencode activity run validate-double-blind-architecture"
```

**Confirms** that validation correctly detected the improvements.

---

## What Each Repository Needs

### metabob-cli (repos/metabob-cli)

**Current State**: Probably mostly compliant (MCP tools likely pure CPG already)

**Potential Issues**:
- MCP tools may expose similarity scores (prohibited)
- May include confidence values (prohibited)
- May return internal metrics (prohibited)

**Expected Fixes**:
- Strip scores from MCP tool responses
- Return only structural data (component_ids, file_paths, dependencies)
- Keep cpg-inference pure analysis

**Lockstep Commits**:
```bash
cd repos/metabob-cli
# Make fixes
git add -A
git commit -m "feat: ensure MCP tools return pure CPG without scores

- Remove similarity scores from metabob_search_codebase_issues
- Remove confidence values from metabob_suggest_related_changes
- Keep responses to structural analysis only

Part of: Double-blind architecture compliance
Related: metabob-opencode@<commit>, metabob-rpc-api@<commit>"
```

---

### metabob-opencode (repos/metabob-opencode)

**Current State**: Needs RPC API integration

**Missing**:
- RPC client for `/api/v1/recommendations/get`
- RPC client for `/api/v1/feedback/record`
- Activity execution with impression_id tracking
- No exposure of internal learning metrics

**Expected Activities**:
1. Create RPC client class
2. Integrate recommendation flow
3. Implement feedback submission
4. Update activity executor to use impression_id
5. Remove any internal metric logging

**Lockstep Commits**:
```bash
cd repos/metabob-opencode
# Make fixes
git add -A
git commit -m "feat: integrate RPC API for double-blind recommendations

- Add RPC client for recommendations and feedback
- Update activity executor to track impression_id
- Remove internal learning metric exposure
- Ensure agents see only minimal data

Part of: Double-blind architecture compliance
Related: metabob-cli@<commit>, metabob-rpc-api@<commit>"
```

---

### metabob-rpc-api (repos/metabob-rpc-api)

**Current State**: Likely missing most Week 1-6 implementations

**Missing** (from FINAL_ARCHITECTURE_SUMMARY.md):

**Week 1**:
- Text embedding service (sentence-transformers → 32-dim)
- SurrealDB schema (variants, assignments, associations, embeddings)
- Vector indexes

**Week 2**:
- Thompson Sampling implementation
- Context selection (association-based)
- Impression tracking
- `POST /api/v1/recommendations/get` endpoint

**Week 3**:
- `POST /api/v1/feedback/record` endpoint
- Parameter updates (alpha/beta)
- Association weight updates
- Celery task integration

**Week 4**:
- Celery Beat configuration
- Periodic parameter updates (15 min)
- Association pruning (weekly)
- Analytics generation (daily)

**Expected Activities**:
1. Implement text embedding service
2. Setup SurrealDB schema and indexes
3. Implement Thompson Sampling logic
4. Create recommendation endpoint
5. Create feedback endpoint
6. Setup Celery Beat tasks
7. Implement parameter update logic
8. Add analytics generation

**Lockstep Commits**:
```bash
cd repos/metabob-rpc-api
# Make fixes for Week 1-2
git add -A
git commit -m "feat: implement Thompson Sampling recommendation system

- Add text embedding service (sentence-transformers)
- Setup SurrealDB schema with vector indexes
- Implement Thompson Sampling variant selection
- Create POST /api/v1/recommendations/get endpoint
- Add impression tracking
- Ensure no internal metrics in responses

Part of: Double-blind architecture compliance (Week 1-2)
Related: metabob-cli@<commit>, metabob-opencode@<commit>"

# Then Week 3-4
git add -A
git commit -m "feat: implement feedback processing and background learning

- Create POST /api/v1/feedback/record endpoint
- Implement alpha/beta parameter updates
- Add association weight learning
- Setup Celery Beat for periodic updates
- Add analytics generation (internal only)

Part of: Double-blind architecture compliance (Week 3-4)
Related: metabob-cli@<commit>, metabob-opencode@<commit>"
```

---

## Lockstep Commit Strategy

Since changes span all three repositories and must work together:

### 1. Create Feature Branch in All Repos

```bash
# In metabob-devbob root
cd repos/metabob-cli
git checkout -b feat/double-blind-compliance

cd ../metabob-opencode
git checkout -b feat/double-blind-compliance

cd ../metabob-rpc-api
git checkout -b feat/double-blind-compliance
```

---

### 2. Execute Activities Per Phase

**Phase 1: CLI Fixes**
```bash
# Run CLI fix activities
opencode activity run fix-mcp-tool-*

# Commit in metabob-cli
cd repos/metabob-cli
git add -A
git commit -m "feat: ensure MCP tools return pure CPG..."
git push origin feat/double-blind-compliance

# Note commit hash: cli_commit_1
```

**Phase 2: RPC API Foundation**
```bash
# Run RPC foundation activities
opencode activity run implement-text-embedding-service
opencode activity run setup-surrealdb-schema
opencode activity run implement-recommendation-endpoint

# Commit in metabob-rpc-api
cd repos/metabob-rpc-api
git add -A
git commit -m "feat: implement Thompson Sampling recommendation system

Related: metabob-cli@<cli_commit_1>"
git push origin feat/double-blind-compliance

# Note commit hash: rpc_commit_1
```

**Phase 3: OpenCode Integration**
```bash
# Run OpenCode integration activities
opencode activity run create-rpc-client
opencode activity run integrate-recommendation-flow

# Commit in metabob-opencode
cd repos/metabob-opencode
git add -A
git commit -m "feat: integrate RPC API for double-blind recommendations

Related: metabob-cli@<cli_commit_1>, metabob-rpc-api@<rpc_commit_1>"
git push origin feat/double-blind-compliance

# Note commit hash: opencode_commit_1
```

**Continue for remaining phases...**

---

### 3. Create Pull Requests (Linked)

```bash
# metabob-cli PR
cd repos/metabob-cli
gh pr create \
  --title "feat: Double-blind architecture compliance - MCP tools" \
  --body "Part of double-blind learning system implementation.

## Changes
- Remove scores from MCP tool responses
- Ensure pure CPG analysis only

## Related PRs
- metabob-opencode: #XXX
- metabob-rpc-api: #YYY

## Architecture
See: FINAL_ARCHITECTURE_SUMMARY.md"

# metabob-rpc-api PR
cd repos/metabob-rpc-api
gh pr create \
  --title "feat: Double-blind architecture compliance - RPC API" \
  --body "Part of double-blind learning system implementation.

## Changes
- Thompson Sampling recommendation system
- Feedback processing
- Celery Beat background learning

## Related PRs
- metabob-cli: #XXX
- metabob-opencode: #ZZZ

## Architecture
See: FINAL_ARCHITECTURE_SUMMARY.md"

# metabob-opencode PR
cd repos/metabob-opencode
gh pr create \
  --title "feat: Double-blind architecture compliance - RPC integration" \
  --body "Part of double-blind learning system implementation.

## Changes
- RPC client for recommendations and feedback
- Activity execution with impression tracking
- No internal metric exposure

## Related PRs
- metabob-cli: #XXX
- metabob-rpc-api: #YYY

## Architecture
See: FINAL_ARCHITECTURE_SUMMARY.md"
```

---

### 4. Merge in Lockstep

**Important**: Merge all three PRs at approximately the same time to avoid breaking integrations.

```bash
# After all PRs approved, merge in order:
# 1. metabob-cli (foundational, no dependencies)
# 2. metabob-rpc-api (depends on CLI MCP format)
# 3. metabob-opencode (depends on RPC API endpoints)
```

---

## Success Metrics

### After Initial Validation
- **Issues Identified**: 20-40 expected
- **Critical Issues**: 5-10 expected
- **Activities Generated**: 8-15 expected

### After Implementation
- **Validation Pass Rate**: Should improve from ~30% → 90%+
- **Activity Success Rate**: Should be ≥80%
- **Validation Sensitivity**: Should be ≥50%

### Overall
- ✅ All MCP tools return pure CPG
- ✅ All agents see minimal data
- ✅ Server tracks everything internally
- ✅ Thompson Sampling working
- ✅ Feedback loop functional
- ✅ Celery Beat updating parameters
- ✅ Double-blind property preserved

---

## Troubleshooting

### If Validation Finds Too Many Issues (>50)

The architecture may be significantly out of compliance. Consider:
1. Break into smaller phases
2. Fix critical issues first
3. Run multiple validation cycles

### If Generated Activities Fail to Execute

Check:
1. Dependencies between activities
2. Required files/tools available
3. Repository access permissions
4. Activity template validity

### If Validation Doesn't Detect Improvements

Indicates validation logic is broken:
1. Run `validate-validation-activity` to diagnose
2. Check validation checks are correct
3. Verify validation is looking at updated code

---

## Next Steps

**Recommended Approach**:

1. **Now**: Run Option A (complete automated loop)
   ```bash
   opencode activity run validate-create-verify-loop \
     --var validation_activity_id=validate-double-blind-architecture \
     --var target_system=double-blind-learning-system
   ```

2. **Review** generated reports and activities

3. **Execute** generated activities with lockstep commits

4. **Create** linked PRs across all three repos

5. **Merge** in lockstep once approved

6. **Verify** production deployment works end-to-end

---

**Status**: Ready to execute  
**Estimated Duration**: 4-8 hours for full compliance  
**Expected Outcome**: Three repositories fully compliant with double-blind architecture
