# Phase 5: Comprehensive Testing Plan

## Overview
End-to-end testing to verify all Agent Compliance Enforcement phases work together correctly.

## Test Objectives

### Phase 1: Automatic Annotation Capture
**Goal**: Verify annotations are automatically captured after agent modifies code
**Test**: Agent creates files without calling metabob_annotate_component
**Expected**: 
- Phase 1 post-hook should NOT fire (requires actual code changes in git repo)
- Phase 4 should detect low annotation coverage
- Correctness verdict should show warning

### Phase 2: Markdown Detection
**Goal**: Verify markdown file creation is detected and flagged
**Test**: Agent creates non-allowed markdown file (test-docs.md)
**Expected**:
- Phase 2 write tool should allow creation (not enforcement, just detection)
- Phase 4 should detect markdown file in filesChanged
- Correctness verdict should show "documentation-file-created" warning

### Phase 3: Template Validation
**Goal**: Verify required tool calls are enforced
**Test**: Template has NO requiredToolCalls (to allow violations)
**Expected**:
- Validation passes (no enforcement in this test)
- Shows Phase 3 can be configured per-template

### Phase 4: Correctness Enhancement
**Goal**: Verify compliance violations reduce confidence score
**Test**: Activity creates files without annotations + creates markdown
**Expected**:
- Annotation coverage check: 0 annotations for 2 files = 0% (warning)
- Markdown file check: test-docs.md detected (warning)
- Confidence score: 1.0 * 0.8 * 0.85 = 0.68 (suspicious verdict)

## Test Template Structure

### Task 1: violate-annotation-requirement
```json
{
  "id": "violate-annotation-requirement",
  "description": "Create file without calling annotation tool",
  "prompt": "Create /tmp/test-compliance-file.txt. DO NOT annotate."
}
```

**Purpose**: Tests Phase 1 & 4 - annotation coverage detection

### Task 2: violate-markdown-requirement
```json
{
  "id": "violate-markdown-requirement",
  "description": "Create non-allowed markdown file",
  "prompt": "Create /tmp/test-docs.md with documentation."
}
```

**Purpose**: Tests Phase 2 & 4 - markdown file detection

### Task 3: verify-compliance-enforcement
```json
{
  "id": "verify-compliance-enforcement",
  "description": "Verify violations were detected",
  "prompt": "Check activity logs for compliance warnings"
}
```

**Purpose**: Validates that all phases detected violations

## Expected Test Results

### Activity Execution
```
✅ Task 1: Creates /tmp/test-compliance-file.txt
✅ Task 2: Creates /tmp/test-docs.md
✅ Task 3: Verifies warnings present
```

### Correctness Verdict
```json
{
  "computed": true,
  "verdict": "suspicious",
  "confidence": 0.68,
  "issues": [
    {
      "severity": "warning",
      "category": "low-annotation-coverage",
      "message": "Low annotation coverage: 0 annotations for 2 changed files (0%). Best practice is to annotate at least half of changed files."
    },
    {
      "severity": "warning",
      "category": "documentation-file-created",
      "message": "Created 1 non-allowed markdown file(s): /tmp/test-docs.md. Use metabob_annotate_component instead of creating documentation files."
    }
  ]
}
```

### Confidence Calculation
```
Starting confidence: 1.0
After low annotation coverage (0%): 1.0 * 0.8 = 0.8
After markdown file violation: 0.8 * 0.85 = 0.68
Final verdict: "suspicious" (< 0.8)
```

## Test Execution Steps

### 1. Register Template
```bash
cd repos/metabob-opencode/packages/opencode
# Copy template to templates/testing/ directory
cp ../../../test-agent-compliance-template.json templates/testing/
```

### 2. Run Test Activity
```bash
# Execute via CLI or activity tool
bun run cli activity execute --template test-agent-compliance-enforcement
```

### 3. Inspect Results
```bash
# Get activity ID from execution output
ACTIVITY_ID="act_xxx"

# Check activity info
bun run cli activity inspect $ACTIVITY_ID

# Look for correctness verdict
cat ~/.local/share/opencode/storage/activity/${ACTIVITY_ID}.json | jq '.correctnessVerdict'
```

### 4. Verify Evidence
```bash
# Check execution evidence
cat ~/.local/share/opencode/storage/activity/${ACTIVITY_ID}.json | jq '.executionEvidence'

# Check work artifacts
cat ~/.local/share/opencode/storage/activity/${ACTIVITY_ID}.json | jq '.workArtifacts'
```

## Success Criteria

### ✅ Phase 1 Validation
- [ ] No automatic annotations triggered (files not in git repo)
- [ ] Phase 4 detects 0 annotation coverage

### ✅ Phase 2 Validation
- [ ] Markdown file creation allowed by write tool
- [ ] Phase 4 detects test-docs.md in filesChanged

### ✅ Phase 3 Validation
- [ ] Template validation passes (no requiredToolCalls set)
- [ ] Demonstrates configurable enforcement

### ✅ Phase 4 Validation
- [ ] Low annotation coverage warning issued
- [ ] Markdown file warning issued
- [ ] Confidence score reduced appropriately
- [ ] Verdict reflects compliance issues

### ✅ Integration Validation
- [ ] All phases work together
- [ ] Evidence collection complete
- [ ] Logging includes compliance metrics

## Test Limitations

### Why /tmp Files?
- Activities track git-managed files in workArtifacts
- /tmp files won't trigger git hooks (Phase 1)
- But will still be tracked in filesChanged for Phase 4 testing
- Demonstrates Phase 4 works independently

### Phase 1 Not Fully Tested
- Automatic annotation capture requires git-tracked files
- Would need separate test with actual repo changes
- This test focuses on Phase 4 detection layer

### Alternative: Full Integration Test
For complete Phase 1 testing, would need:
```json
{
  "prompt": "Edit src/test-file.ts and add a function. Agent should call metabob_annotate_component."
}
```

## Metrics to Capture

### Execution Metrics
- Duration per task
- Tool calls made
- Files changed count

### Compliance Metrics
- Annotation coverage percentage: 0%
- Markdown files created: 1
- Confidence score: 0.68
- Verdict: "suspicious"

### Evidence Collected
- sessionsSpawned: 3 (one per task)
- toolCalls: write tool only, no annotation tool
- filesChanged: ["/tmp/test-compliance-file.txt", "/tmp/test-docs.md"]

## Follow-Up Tests

### Test 2: Compliant Activity
Create template that DOES call metabob_annotate_component:
- Expected: High annotation coverage
- Expected: High confidence score
- Expected: "correct" verdict

### Test 3: Template Enforcement
Create template with requiredToolCalls:
- Expected: Validation fails if tool not called
- Expected: Clear error message

### Test 4: Mixed Compliance
Create template with some violations, some compliance:
- Expected: Partial confidence reduction
- Expected: Specific warnings for each issue

## Documentation Outputs

### 1. Test Execution Log
- Capture full activity execution output
- Include all task results
- Show tool calls made

### 2. Correctness Verdict Report
- Extract correctness verdict JSON
- Show each issue detected
- Explain confidence calculation

### 3. Phase Integration Matrix
- Table showing which phases triggered
- Expected vs actual results
- Pass/fail for each phase

### 4. Lessons Learned
- What worked well
- What needs improvement
- Configuration recommendations
