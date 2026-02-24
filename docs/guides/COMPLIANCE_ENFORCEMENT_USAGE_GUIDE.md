# Agent Compliance Enforcement: Usage Guide

## Overview

The Agent Compliance Enforcement system ensures that agents properly document their work using annotations instead of creating markdown files. This guide shows you how to use the compliance features.

## For Template Authors

### Enforcing Required Tools

Add `requiredToolCalls` to your template's validation section to enforce that specific tools must be called during task execution:

```json
{
  "tasks": [
    {
      "id": "implement-feature",
      "validation": {
        "requiredToolCalls": ["metabob_annotate_component"],
        "forbiddenPatterns": ["TODO", "FIXME", "console.log"]
      }
    }
  ]
}
```

**What happens**:
- If the agent completes the task WITHOUT calling `metabob_annotate_component`, validation fails
- Error message shows which tools were required vs actually called
- Task can be retried with clear guidance

### Example: Fix Bug Template

```json
{
  "name": "Fix Bug with Compliance",
  "tasks": [
    {
      "id": "implement-fix",
      "prompt": {
        "template": "Fix the bug in {{file}}. Call metabob_annotate_component to document your changes."
      },
      "validation": {
        "requiredToolCalls": ["metabob_annotate_component"],
        "forbiddenPatterns": ["TODO", "FIXME"]
      }
    }
  ]
}
```

## For Activity Executors

### Understanding Correctness Verdicts

After an activity completes, the correctness verdict includes compliance checks:

```json
{
  "verdict": "suspicious",
  "confidence": 0.68,
  "issues": [
    {
      "severity": "warning",
      "category": "low-annotation-coverage",
      "message": "Low annotation coverage: 2 annotations for 5 changed files (40%). Best practice is to annotate at least half of changed files."
    },
    {
      "severity": "warning",
      "category": "documentation-file-created",
      "message": "Created 1 non-allowed markdown file(s): docs/guide.md. Use metabob_annotate_component instead of creating documentation files."
    }
  ]
}
```

### Interpreting Confidence Scores

| Confidence | Verdict | Meaning |
|------------|---------|---------|
| ≥ 0.8 | correct | High compliance, all requirements met |
| 0.6 - 0.8 | suspicious | Some compliance issues detected |
| < 0.6 | suspicious | Multiple compliance violations |
| < 0.3 | incorrect | Critical failures or severe violations |

### Compliance Penalties

- **Low annotation coverage** (< 50%): -20% confidence
- **Markdown file violations**: -15% confidence
- **Multiple violations**: penalties multiply

**Example**:
```
Starting confidence: 1.0
After low coverage (30%): 1.0 * 0.8 = 0.8
After markdown file: 0.8 * 0.85 = 0.68
Final verdict: "suspicious"
```

## For Agents (Prompt Guidance)

### Best Practices

1. **Always annotate code changes**:
   ```
   After modifying src/auth.ts, call:
   metabob_annotate_component({
     file_path: "src/auth.ts",
     component_name: "authenticateUser",
     reason: "Switched from sessions to JWT for stateless auth"
   })
   ```

2. **Avoid creating markdown files**:
   ```
   ❌ Don't: write({ filePath: "docs/auth-design.md", content: "..." })
   ✅ Do: metabob_annotate_component({ ... })
   ```

3. **Use allowed markdown only**:
   - README.md
   - ARCHITECTURE.md
   - API.md
   - CONTRIBUTING.md
   - CHANGELOG.md

### Example Agent Workflow

```typescript
// 1. Make code changes
await write({
  filePath: "src/payment.ts",
  content: "export function processPayment() { ... }"
})

// 2. Document the change
await metabob_annotate_component({
  file_path: "src/payment.ts",
  component_name: "processPayment",
  component_type: "function",
  reason: "Added Stripe integration for credit card processing"
})

// 3. Avoid this:
// ❌ await write({ filePath: "docs/payment-flow.md", content: "..." })
```

## Compliance Levels

### Level 1: Detection (Automatic)

**Phases 1, 2, 4** automatically detect violations:
- Missing annotations
- Markdown file creation
- Low coverage

**Action**: Warnings issued, confidence reduced

### Level 2: Prevention (Template-Level)

**Phase 3** prevents task completion:
- Template specifies `requiredToolCalls`
- Validation fails if tools not called
- Clear error with guidance

**Action**: Execution fails, retry required

### Level 3: Correction (Automatic)

**Phase 1** automatically fixes violations:
- Post-hook captures missing annotations
- Runs after activity completes

**Action**: Automatic remediation

## Configuration

### Annotation Coverage Threshold

**Default**: 50% (hardcoded)

To check coverage:
```bash
cat ~/.local/share/opencode/storage/activity/<activity-id>.json | jq '.correctnessVerdict'
```

### Allowed Markdown Files

**Default allowlist**:
- README.md
- ARCHITECTURE.md
- API.md
- CONTRIBUTING.md
- CHANGELOG.md

**Location**: 
- `src/session/activity-correctness.ts:14-19`
- `src/tool/write.ts:178-188`

## Debugging Compliance Issues

### Check Activity Correctness

```bash
# Get activity ID from execution
ACTIVITY_ID="act_xxx"

# View correctness verdict
bun run cli activity inspect $ACTIVITY_ID

# Or directly from storage
cat ~/.local/share/opencode/storage/activity/${ACTIVITY_ID}.json | jq '.correctnessVerdict'
```

### Check Annotation Coverage

```bash
# View execution evidence
cat ~/.local/share/opencode/storage/activity/${ACTIVITY_ID}.json | jq '.executionEvidence.toolCalls'

# Count annotation tool calls
cat ~/.local/share/opencode/storage/activity/${ACTIVITY_ID}.json | \
  jq '.executionEvidence.toolCalls | map(select(.tool == "metabob_annotate_component")) | length'
```

### Check Files Changed

```bash
# View work artifacts
cat ~/.local/share/opencode/storage/activity/${ACTIVITY_ID}.json | jq '.workArtifacts'
```

## Common Scenarios

### Scenario 1: Template Requires Annotation

**Template**:
```json
{
  "validation": {
    "requiredToolCalls": ["metabob_annotate_component"]
  }
}
```

**If agent forgets**:
- Validation fails
- Error: "Required tool 'metabob_annotate_component' was not called"
- Lists tools that WERE called
- Task must be retried

### Scenario 2: Low Annotation Coverage

**Activity Result**:
```
Files changed: 10
Annotations created: 3
Coverage: 30%
```

**Outcome**:
- Warning issued in correctness verdict
- Confidence reduced to 0.8
- Verdict: "suspicious"
- Suggests annotating more files

### Scenario 3: Markdown File Created

**Agent action**:
```typescript
write({ filePath: "docs/feature-guide.md", content: "..." })
```

**Outcome**:
- Warning issued in correctness verdict
- File listed in violation message
- Confidence reduced to 0.85
- Suggests using annotations instead

### Scenario 4: Multiple Violations

**Activity Result**:
```
Files changed: 8
Annotations: 2 (25% coverage)
Markdown files: ["notes.md"]
```

**Outcome**:
- Two warnings issued
- Confidence: 1.0 * 0.8 * 0.85 = 0.68
- Verdict: "suspicious"
- Both issues listed with guidance

## Testing Compliance

### Run Test Suite

```bash
cd repos/metabob-opencode/packages/opencode

# Copy test template
cp ../../../test-agent-compliance-template.json templates/testing/

# Execute test
bun run cli activity execute --template test-agent-compliance-enforcement

# Verify results
ACTIVITY_ID="act_xxx"
cat ~/.local/share/opencode/storage/activity/${ACTIVITY_ID}.json | jq '.correctnessVerdict'
```

### Expected Test Results

- Annotation coverage: 0% (0 annotations for 2 files)
- Markdown violation: test-docs.md detected
- Confidence: 0.68
- Verdict: "suspicious"
- Two warnings issued

## Best Practices

### For Template Authors

1. **Use `requiredToolCalls` for critical tools**
2. **Add `forbiddenPatterns` to catch debug code**
3. **Document why tools are required in template description**
4. **Test templates to verify enforcement works**

### For Activity Creators

1. **Check correctness verdict after execution**
2. **Review compliance warnings**
3. **Fix low coverage before considering activity complete**
4. **Use annotations over markdown files**

### For System Administrators

1. **Monitor annotation coverage trends**
2. **Identify templates with low compliance**
3. **Tune confidence penalties based on data**
4. **Add project-specific markdown allowlists if needed**

## Troubleshooting

### "Validation failed: Required tool not called"

**Problem**: Template requires a tool but agent didn't call it

**Solution**: 
1. Check which tool was required (error message shows this)
2. Update agent prompt to explicitly call the tool
3. Retry the task

### "Low annotation coverage" warning

**Problem**: Agent created many files but few annotations

**Solution**:
1. Review which files were changed
2. Call `metabob_annotate_component` for important files
3. Aim for > 50% coverage

### "Documentation file created" warning

**Problem**: Agent created non-allowed markdown file

**Solution**:
1. Delete the markdown file
2. Use `metabob_annotate_component` instead
3. If file is necessary, add to allowlist

## Further Reading

- **Design**: `AGENT_COMPLIANCE_ENFORCEMENT_DESIGN.md`
- **Complete Implementation**: `AGENT_COMPLIANCE_ENFORCEMENT_COMPLETE.md`
- **Phase 3 Details**: `PHASE3_IMPLEMENTATION_SUMMARY.md`
- **Phase 4 Details**: `PHASE4_IMPLEMENTATION_SUMMARY.md`
- **Phase 5 Testing**: `PHASE5_TEST_PLAN.md`

## Support

For questions or issues with compliance enforcement:
1. Check the completion reports for detailed implementation notes
2. Review test templates for examples
3. Inspect activity storage files for debugging
4. Adjust template validation as needed for your use case
