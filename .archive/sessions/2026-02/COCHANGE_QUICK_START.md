# Cochange + Impulse + Activity Learning - Quick Start

**5-minute guide to using cochange embeddings with impulses and activity learning**

---

## Quick Reference

```
📝 Changed Code → 🔍 Cochange Analysis → 💾 Impulse Creation → 🤖 Activity Execution → 📊 Learning
```

---

## 1. Get Cochange Predictions (30 seconds)

```bash
# After modifying auth.ts
opencode mcp call metabob_suggest_related_changes \
  --changed_files='["src/auth.ts"]' \
  --top_k=5
```

**Output**:
```json
{
  "suggestions": [
    {
      "file_path": "src/auth-utils.ts",
      "total_issues": 12,
      "high_severity_issues": 2,
      "recommendation": "⚠️ High priority - has critical issues"
    },
    {
      "file_path": "src/session.ts",
      "total_issues": 5,
      "high_severity_issues": 0,
      "recommendation": "Review recommended"
    }
  ]
}
```

---

## 2. Create Impulse with Cochange Context (1 minute)

```typescript
// In your code or via REPL
const cochangeResult = await bash({
  command: `opencode mcp call metabob_suggest_related_changes --changed_files='["src/auth.ts"]'`,
  description: "Get cochange suggestions"
})

// Create impulse for activity to use
await Session.impulse.create(sessionID, {
  id: "cochange-auth-context",
  pointer: {
    type: "memo",
    content: `
# Cochange Analysis for src/auth.ts

Files that typically change together:
- src/auth-utils.ts (12 issues, 2 HIGH) ⚠️
- src/session.ts (5 issues, 0 HIGH)
- src/api/users.ts (3 issues, 0 HIGH)

Recommendation: Check auth-utils.ts for similar patterns
    `
  },
  budget: 1500  // Token budget
})
```

---

## 3. Execute Activity with Cochange Context (2 minutes)

```typescript
// Activity automatically receives impulses in session memory
const result = await activity({
  activityId: "fix-bug-complete",
  variables: {
    bug_description: "Authentication timeout not refreshing",
    file_path: "src/auth.ts"
  },
  reason: "Fix auth timeout with cochange awareness"
})

// Agent sees in prompt:
// <session_memory>
//   <impulse id="cochange-auth-context">
//     # Cochange Analysis for src/auth.ts
//     Files that typically change together...
//   </impulse>
// </session_memory>
```

---

## 4. Record Outcome for Learning (30 seconds)

```typescript
// After activity completes
const gitDiff = await bash({
  command: "git diff --name-only HEAD",
  description: "Get changed files"
})

const actualFiles = gitDiff.output.trim().split("\n")

// System automatically calculates cochange accuracy
// and reports to backend for learning
```

---

## Complete Example Script

Save as `cochange-workflow-example.ts`:

```typescript
import { Session } from "@opencode/core"
import { bash } from "@opencode/tools"
import { activity } from "@opencode/activity"

async function fixBugWithCochangeAwareness(
  sessionID: string,
  bugFile: string,
  bugDescription: string
) {
  console.log("🔍 Step 1: Analyze cochange patterns...")
  
  // Get cochange predictions
  const cochangeCmd = await bash({
    command: `opencode mcp call metabob_suggest_related_changes --changed_files='["${bugFile}"]' --top_k=5`,
    description: "Analyze cochange patterns"
  })
  
  const cochanges = JSON.parse(cochangeCmd.output)
  
  console.log(`Found ${cochanges.suggestions.length} related files`)
  cochanges.suggestions.forEach(s => {
    console.log(`  - ${s.file_path} (${s.recommendation})`)
  })
  
  console.log("\n💾 Step 2: Create impulse with context...")
  
  // Create rich context impulse
  const impulseContent = `
# Cochange Analysis for ${bugFile}

## Bug Description
${bugDescription}

## Related Files
${cochanges.suggestions.map(s => `
### ${s.file_path}
- Total issues: ${s.total_issues}
- High severity: ${s.high_severity_issues}
- Recommendation: ${s.recommendation}
${s.top_issues?.map(i => `  - [${i.severity}] ${i.description}`).join("\n") || ""}
`).join("\n")}

## Action Items
1. Fix primary bug in ${bugFile}
2. Check ${cochanges.suggestions.filter(s => s.high_severity_issues > 0).length} high-priority files
3. Look for similar patterns in related files
4. Update tests covering these components
  `
  
  await Session.impulse.create(sessionID, {
    id: `cochange-${bugFile.replace(/\//g, "-")}`,
    pointer: {
      type: "memo",
      content: impulseContent
    },
    budget: 2000
  })
  
  console.log("✅ Impulse created\n")
  
  console.log("🤖 Step 3: Execute activity with context...")
  
  // Execute activity - it will receive impulse in session memory
  const result = await activity({
    activityId: "fix-bug-complete",
    variables: {
      bug_description: bugDescription,
      file_path: bugFile
    },
    reason: `Fix bug with cochange awareness: ${bugDescription}`
  })
  
  console.log(`Activity completed: ${result.status}`)
  
  console.log("\n📊 Step 4: Check what was actually changed...")
  
  // Get actual changes
  const gitDiff = await bash({
    command: "git diff --name-only HEAD",
    description: "Get changed files"
  })
  
  const actualFiles = gitDiff.output.trim().split("\n").filter(Boolean)
  
  console.log(`Changed ${actualFiles.length} files:`)
  actualFiles.forEach(f => console.log(`  - ${f}`))
  
  // Calculate cochange accuracy
  const predictedFiles = cochanges.suggestions.map(s => s.file_path)
  const hits = actualFiles.filter(f => predictedFiles.includes(f))
  const accuracy = hits.length / predictedFiles.length
  
  console.log(`\n📈 Cochange Accuracy: ${(accuracy * 100).toFixed(1)}%`)
  console.log(`  Predicted: ${predictedFiles.length} files`)
  console.log(`  Correct: ${hits.length} files`)
  console.log(`  Missed: ${predictedFiles.filter(f => !actualFiles.includes(f)).join(", ")}`)
  console.log(`  Extra: ${actualFiles.filter(f => !predictedFiles.includes(f)).join(", ")}`)
  
  return {
    result,
    cochangeAccuracy: accuracy,
    predictedFiles,
    actualFiles
  }
}

// Usage
await fixBugWithCochangeAwareness(
  "ses_abc123",
  "src/auth.ts",
  "Authentication timeout not refreshing on user activity"
)
```

---

## Run the Example

```bash
# Option 1: Via REPL
bun repl
> .load cochange-workflow-example.ts
> await fixBugWithCochangeAwareness("ses_...", "src/auth.ts", "bug description")

# Option 2: Via script
bun run cochange-workflow-example.ts
```

---

## Expected Output

```
🔍 Step 1: Analyze cochange patterns...
Found 3 related files
  - src/auth-utils.ts (⚠️ High priority - has critical issues)
  - src/session.ts (Review recommended)
  - src/api/users.ts (✅ No known issues)

💾 Step 2: Create impulse with context...
✅ Impulse created

🤖 Step 3: Execute activity with context...
Activity completed: success

📊 Step 4: Check what was actually changed...
Changed 3 files:
  - src/auth.ts
  - src/auth-utils.ts
  - src/api/users.ts

📈 Cochange Accuracy: 66.7%
  Predicted: 3 files
  Correct: 2 files
  Missed: src/session.ts
  Extra: (none)
```

---

## Common Patterns

### Pattern 1: Pre-execution Cochange Check

```typescript
// Before any multi-file change
const cochanges = await metabob_suggest_related_changes({
  changed_files: ["src/auth.ts"]
})

if (cochanges.suggestions.length > 0) {
  console.log("⚠️  Related files to review:")
  cochanges.suggestions.forEach(s => console.log(`  ${s.file_path}`))
}
```

### Pattern 2: Post-execution Verification

```typescript
// After making changes
const predicted = await getPredictedCochanges(originalFiles)
const actual = await getActuallyChangedFiles()

const missed = predicted.filter(f => !actual.includes(f))
if (missed.length > 0) {
  console.warn(`⚠️  You may have missed: ${missed.join(", ")}`)
}
```

### Pattern 3: Rich Context Impulse

```typescript
async function createRichImpulse(file: string) {
  const [cochanges, components, issues, annotations] = await Promise.all([
    metabob_suggest_related_changes({ changed_files: [file] }),
    metabob_list_file_components({ file_path: file }),
    metabob_search_codebase_issues({ query: `file:${file}` }),
    metabob_get_component_annotations({ file_path: file })
  ])
  
  return {
    type: "memo",
    content: synthesize({ cochanges, components, issues, annotations })
  }
}
```

---

## Troubleshooting

### "CPG not available"
- **Cause**: Background analysis still initializing
- **Fix**: Continue without cochange predictions, or wait 30-60s

### "No suggestions returned"
- **Cause**: File not indexed yet, or file has weak cochange signals
- **Fix**: Run `opencode metabob status` to check indexing progress

### Low cochange accuracy
- **Cause**: Template operates on files with unpredictable change patterns
- **Fix**: Increase `top_k` parameter, or add manual file checks

---

## Next Steps

1. **Read full guide**: `COCHANGE_IMPULSE_ACTIVITY_LEARNING_GUIDE.md`
2. **Check API reference**: Section 7 of full guide
3. **Explore examples**: `repos/cpg-inference/examples/`
4. **Run benchmarks**: `pytest repos/cpg-inference/tests/test_benchmarks.py::test_benchmark_cochange_prediction`

---

## Key Metrics to Track

- **Cochange Accuracy**: % of predicted cochanges that actually happened
- **Missed Files**: Files that changed but weren't predicted
- **Extra Files**: Files predicted but didn't change
- **Activity Duration**: Time to complete with vs without cochange context
- **Issue Resolution**: Number of issues fixed in related files

**Target**: 70%+ cochange accuracy for mature templates
