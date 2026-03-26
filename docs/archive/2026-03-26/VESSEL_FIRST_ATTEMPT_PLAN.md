# Vessel Conversion - First Attempt Plan

## Philosophy: Skeptical, Minimal, Verifiable

**Assumptions:**
- ❌ Nothing works until proven
- ❌ LLM success assertions are unreliable
- ❌ Complex systems fail in unexpected ways
- ✅ Start with simplest possible case
- ✅ Verify with objective measurements
- ✅ Build debugging visibility first

---

## Goal: Prove Vessel Concept Works

**Success Criteria (Objective, No LLM):**
1. ✅ MiniBob process starts with vessel module loaded
2. ✅ Vessel state contains registered component (verify via console.log)
3. ✅ Call `vessel.runGoal()` programmatically
4. ✅ Goal executes and modifies a file on disk
5. ✅ File modification verified with `git diff` (objective proof)
6. ✅ Execution metrics recorded (cost, duration, files modified)

**Anti-Success (What We're Skeptical Of):**
- ❌ LLM says "Success!" but nothing changed
- ❌ Process crashes silently
- ❌ Vessel loads but can't execute activities
- ❌ Activities execute but don't modify anything
- ❌ File modified but not what we intended

---

## Minimal Implementation: 3 Files

### File 1: Vessel Bootstrap (Already Created)
`repos/minibob/src/vessel-bootstrap.ts` ✅

**Status:** Implemented, needs verification

### File 2: Simple Test Script
`repos/minibob/test-vessel.ts` (NEW)

**Purpose:** Programmatically test vessel without human interpretation

```typescript
/**
 * Vessel Conversion - First Attempt Test
 * 
 * Objective: Prove vessel can modify its own codebase
 * Success: File is modified, verified with git diff
 */

import { initializeVessel } from './src/vessel-bootstrap'
import { readFileSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'

console.log('=== VESSEL FIRST ATTEMPT TEST ===\n')

// STEP 1: Initialize vessel
console.log('STEP 1: Initializing vessel...')
const vessel = initializeVessel({
  workingDirectory: __dirname,
  provider: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY!,
  model: 'claude-sonnet-4-20250514',
  vesselType: 'minibob-test',
  enableSelfImprovement: false // Don't auto-optimize during test
})

console.log('✓ Vessel initialized')
console.log('  Type:', vessel.state.snapshot().metadata.type)
console.log('  Working directory:', vessel.state.snapshot().metadata.workingDirectory)
console.log()

// STEP 2: Register test component
console.log('STEP 2: Registering test component...')
const testComponent = {
  name: 'TestComponent',
  value: 42,
  increment: function() { this.value++ }
}
vessel.state.register('testComponent', testComponent)

const registered = vessel.state.list()
console.log('✓ Component registered')
console.log('  Registered components:', registered)
console.log()

// STEP 3: Create test file to be modified
console.log('STEP 3: Creating test file...')
const testFilePath = __dirname + '/test-target.ts'
const originalContent = `// Test file for vessel modification
export const VERSION = 1;
export const STATUS = "original";
`
writeFileSync(testFilePath, originalContent)
console.log('✓ Test file created:', testFilePath)
console.log('  Content:', originalContent.replace(/\n/g, '\\n'))
console.log()

// STEP 4: Run goal to modify file
console.log('STEP 4: Running goal to modify test file...')
console.log('  Goal: "Increment VERSION to 2 and change STATUS to \\"modified\\" in test-target.ts"')
console.log()

const startTime = Date.now()

try {
  const result = await vessel.runGoal(
    'In the file test-target.ts, change VERSION from 1 to 2, and change STATUS from "original" to "modified". Only modify these two lines. Do not add comments or explanations.',
    {
      files: [testFilePath]
    },
    {
      maxActivities: 3,
      maxCost: 2.0
    }
  )
  
  const duration = Date.now() - startTime
  
  console.log('✓ Goal execution completed')
  console.log('  Duration:', duration, 'ms')
  console.log('  Activities executed:', result.executions.length)
  console.log('  Total cost: $', result.totalCost.toFixed(4))
  console.log('  Completed:', result.completed ? 'YES' : 'NO')
  console.log('  Reason:', result.completionReason)
  console.log()
  
} catch (error) {
  console.error('✗ Goal execution FAILED')
  console.error('  Error:', error instanceof Error ? error.message : String(error))
  process.exit(1)
}

// STEP 5: Verify modification (OBJECTIVE PROOF)
console.log('STEP 5: Verifying file modification...')

const modifiedContent = readFileSync(testFilePath, 'utf-8')
console.log('  Modified content:', modifiedContent.replace(/\n/g, '\\n'))

// Check 1: VERSION changed
const hasVersion2 = modifiedContent.includes('VERSION = 2')
console.log('  ✓ VERSION = 2:', hasVersion2 ? 'YES' : 'NO')

// Check 2: STATUS changed
const hasModifiedStatus = modifiedContent.includes('STATUS = "modified"')
console.log('  ✓ STATUS = "modified":', hasModifiedStatus ? 'YES' : 'NO')

// Check 3: Git diff (ultimate proof)
try {
  const gitDiff = execSync('git diff test-target.ts', { cwd: __dirname }).toString()
  console.log('\n  Git diff:')
  console.log(gitDiff.split('\n').map(line => '    ' + line).join('\n'))
} catch (error) {
  console.warn('  (git diff not available)')
}

// STEP 6: Final verdict
console.log('\n=== FINAL VERDICT ===')

if (hasVersion2 && hasModifiedStatus) {
  console.log('✓✓✓ SUCCESS: Vessel modified its own codebase!')
  console.log('    - File was modified')
  console.log('    - Modifications match intent')
  console.log('    - Verified objectively (no LLM assertion)')
  process.exit(0)
} else {
  console.log('✗✗✗ FAILURE: File not modified as expected')
  console.log('    - VERSION=2:', hasVersion2)
  console.log('    - STATUS="modified":', hasModifiedStatus)
  process.exit(1)
}
```

### File 3: Activity Template for Simple Edit
`repos/minibob/templates/simple-file-edit.json` (NEW)

**Purpose:** Dead-simple activity with clear success criteria

```json
{
  "id": "simple-file-edit",
  "name": "Simple File Edit",
  "category": "tool",
  "description": "Edit a file by replacing specific strings. No reasoning, just execute.",
  "tasks": [
    {
      "id": "read-file",
      "description": "Read the target file",
      "prompt": {
        "template": "Read the file at {{filePath}}.\n\nUse the read tool:\nread({ filePath: \"{{filePath}}\" })\n\nShow me the current content.",
        "variables": [
          {
            "name": "filePath",
            "type": "string",
            "description": "Path to file to read"
          }
        ]
      },
      "validation": {
        "requiredFiles": ["{{filePath}}"]
      }
    },
    {
      "id": "modify-file",
      "description": "Replace old strings with new strings",
      "prompt": {
        "template": "In the file {{filePath}}, replace:\n\n{{replacements}}\n\nUse the edit tool for EACH replacement:\nedit({ filePath: \"{{filePath}}\", oldString: \"...\", newString: \"...\" })\n\nDo NOT add comments. Do NOT explain. Just execute the replacements.",
        "variables": [
          {
            "name": "filePath",
            "type": "string"
          },
          {
            "name": "replacements",
            "type": "string",
            "description": "List of oldString -> newString replacements"
          }
        ]
      }
    },
    {
      "id": "verify-changes",
      "description": "Verify the file was modified",
      "prompt": {
        "template": "Read the file again to verify changes:\nread({ filePath: \"{{filePath}}\" })\n\nCheck that all replacements were applied.",
        "variables": [
          {
            "name": "filePath",
            "type": "string"
          }
        ]
      }
    }
  ]
}
```

---

## Execution Plan

### Phase 1: Setup (5 minutes)
```bash
cd repos/minibob

# Create test files
touch test-vessel.ts
touch templates/simple-file-edit.json

# Ensure vessel-bootstrap exists
ls src/vessel-bootstrap.ts

# Ensure environment
export ANTHROPIC_API_KEY="your-key"
```

### Phase 2: Run Test (2 minutes)
```bash
bun run test-vessel.ts
```

**Expected output (if successful):**
```
=== VESSEL FIRST ATTEMPT TEST ===

STEP 1: Initializing vessel...
✓ Vessel initialized
  Type: minibob-test
  Working directory: /path/to/minibob

STEP 2: Registering test component...
✓ Component registered
  Registered components: [ 'vessel', 'testComponent' ]

STEP 3: Creating test file...
✓ Test file created: /path/to/minibob/test-target.ts
  Content: // Test file...\nexport const VERSION = 1;...

STEP 4: Running goal to modify test file...
  Goal: "Increment VERSION to 2..."

[MiniBob activity execution logs...]

✓ Goal execution completed
  Duration: 45000 ms
  Activities executed: 2
  Total cost: $ 0.23
  Completed: YES
  Reason: File modified successfully

STEP 5: Verifying file modification...
  Modified content: // Test file...\nexport const VERSION = 2;...
  ✓ VERSION = 2: YES
  ✓ STATUS = "modified": YES

  Git diff:
    -export const VERSION = 1;
    +export const VERSION = 2;
    -export const STATUS = "original";
    +export const STATUS = "modified";

=== FINAL VERDICT ===
✓✓✓ SUCCESS: Vessel modified its own codebase!
    - File was modified
    - Modifications match intent
    - Verified objectively (no LLM assertion)
```

### Phase 3: Debug if Failed

**Failure Mode 1: Vessel doesn't initialize**
```
✗ Error: Cannot find module './src/vessel-bootstrap'
```
**Fix:** Check vessel-bootstrap.ts exists and is exported

**Failure Mode 2: Goal execution crashes**
```
✗ Goal execution FAILED
  Error: MCP endpoint not configured
```
**Fix:** Set MINIBOB_MCP_ENDPOINT environment variable

**Failure Mode 3: File not modified**
```
✗✗✗ FAILURE: File not modified as expected
    - VERSION=2: NO
    - STATUS="modified": NO
```
**Debug:** Check activity execution logs, verify edit tool was called

**Failure Mode 4: LLM hallucinates success**
```
✓ Goal execution completed
  Completed: YES
  Reason: File modified successfully

STEP 5: Verifying file modification...
  ✓ VERSION = 2: NO   ← CONTRADICTION!
  ✓ STATUS = "modified": NO
```
**This is why we verify objectively!**

---

## Debugging Instrumentation

### Add to vessel-bootstrap.ts:

```typescript
// In VesselBootstrap.runGoal()
async runGoal(goal: string, context: any = {}, options: any = {}) {
  log.info('=== GOAL EXECUTION START ===')
  log.info('Goal:', goal)
  log.info('Context:', JSON.stringify(context, null, 2))
  log.info('Options:', JSON.stringify(options, null, 2))
  
  this.state.incrementMetric('goalsExecuted')
  
  try {
    const result = await this.goalProcessor.executeGoal(goal, {
      ...context,
      vesselType: this.config.vesselType,
      vesselWorkingDirectory: this.config.workingDirectory
    }, options)
    
    log.info('=== GOAL EXECUTION END ===')
    log.info('Result:', {
      completed: result.completed,
      reason: result.completionReason,
      executionsCount: result.executions.length,
      totalCost: result.totalCost,
      totalDuration: result.totalDuration
    })
    
    // Log each activity execution
    result.executions.forEach((exec, i) => {
      log.info(`Activity ${i + 1}:`, {
        templateId: exec.templateId,
        status: exec.status,
        duration: exec.metrics?.duration,
        cost: exec.metrics?.cost,
        filesModified: exec.metrics?.filesModified
      })
    })
    
    return result
  } catch (error) {
    log.error('=== GOAL EXECUTION FAILED ===')
    log.error('Error:', error)
    throw error
  }
}
```

---

## Success Metrics (Objective)

After running test, we should be able to answer:

**Q1: Did vessel initialize?**
- ✓ YES if "Vessel initialized" printed
- ✗ NO if crashed or error

**Q2: Can we register components?**
- ✓ YES if `vessel.state.list()` includes 'testComponent'
- ✗ NO if empty or error

**Q3: Did goal execute?**
- ✓ YES if no crash and result returned
- ✗ NO if exception thrown

**Q4: Did file get modified?**
- ✓ YES if `git diff` shows changes
- ✗ NO if `git diff` empty

**Q5: Were modifications correct?**
- ✓ YES if VERSION=2 AND STATUS="modified"
- ✗ NO if either missing

**Q6: Did LLM hallucinate?**
- ✓ NO if result.completed matches actual file state
- ✗ YES if result.completed=true but file unchanged

---

## Iteration Plan

### Attempt 1: Run as-is
```bash
bun run test-vessel.ts
```
**Expected:** Probably fails, but we learn WHERE

### Attempt 2: Fix most obvious issue
Based on error, fix the blocking issue

### Attempt 3: Add more debugging
If goal executes but doesn't modify, add logging to activity executor

### Attempt 4: Simplify goal
If complex goal fails, try: "Change VERSION to 2 in test-target.ts"

### Attempt 5: Direct activity call
Skip goal processor, call `vessel.runActivity()` directly with simple-file-edit template

### Attempt 6-10: Keep iterating
Each attempt should get closer to success

---

## Human Interface: Show Progress

### Terminal Output Format:
```
┌────────────────────────────────────────────┐
│ VESSEL FIRST ATTEMPT                        │
├────────────────────────────────────────────┤
│ Step 1/6: Initialize vessel                 │
│   Status: ✓ SUCCESS                         │
│   Time: 0.5s                                │
├────────────────────────────────────────────┤
│ Step 2/6: Register component                │
│   Status: ✓ SUCCESS                         │
│   Components: vessel, testComponent         │
├────────────────────────────────────────────┤
│ Step 3/6: Create test file                  │
│   Status: ✓ SUCCESS                         │
│   Path: test-target.ts                      │
├────────────────────────────────────────────┤
│ Step 4/6: Execute goal                      │
│   Status: ⏳ EXECUTING...                   │
│   Activity 1/2: explore-codebase            │
│     Duration: 12s                           │
│     Cost: $0.12                             │
│   Activity 2/2: edit-file                   │
│     Duration: 8s                            │
│     Cost: $0.08                             │
│   Status: ✓ COMPLETED                       │
│   Total: 20s, $0.20                         │
├────────────────────────────────────────────┤
│ Step 5/6: Verify modification               │
│   VERSION = 2: ✓ YES                        │
│   STATUS = "modified": ✓ YES                │
│   Git diff: 2 lines changed                 │
│   Status: ✓ SUCCESS                         │
├────────────────────────────────────────────┤
│ Step 6/6: Final verdict                     │
│   ✓✓✓ SUCCESS                               │
│   Vessel can modify its own code!           │
└────────────────────────────────────────────┘
```

---

## Next Steps After First Success

### If test passes:
1. ✓ Celebrate! We have proof of concept
2. Try more complex goal
3. Add runtime server for external control
4. Test hot-reload
5. Try MiniBob optimizing MiniBob

### If test fails:
1. Read error messages carefully
2. Add more logging at failure point
3. Simplify goal further
4. Try direct tool calls (bash, edit) to verify tools work
5. Check MCP connection if backend-dependent

---

## The Key Insight

**We're not trying to build the perfect system.**
**We're trying to prove the concept works at all.**

**One successful file modification = Proof vessel works**

Then we iterate from there.

**Skepticism is our friend. Objective verification is our tool.**

Let's run the test and see what breaks.
