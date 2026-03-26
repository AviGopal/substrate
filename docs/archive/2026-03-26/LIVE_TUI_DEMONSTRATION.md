# Live TUI Demonstration - Minibob Library Integration

## Objective
Demonstrate that metabob-opencode correctly calls the minibob library from a TUI session, with visible agent behavior and real code modifications.

## Setup Steps

### 1. Prepare Demo Environment
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
mkdir -p demo-live-integration
cd demo-live-integration

# Initialize git repo (required for opencode)
git init
git config user.email "demo@example.com"
git config user.name "Demo User"

# Create a simple TypeScript file to modify
cat > calculator.ts << 'DEMO'
// Simple calculator functions
export function add(a: number, b: number): number {
  return a + b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}
DEMO

# Initial commit
git add calculator.ts
git commit -m "Initial calculator with add and multiply"

# Create opencode config
cat > .opencode.json << 'CONFIG'
{
  "model": "claude-sonnet-4-20250514",
  "provider": {
    "id": "anthropic",
    "apiKey": "${ANTHROPIC_API_KEY}"
  },
  "minibob": {
    "enabled": true,
    "fallback_to_local": false
  },
  "metabob": {
    "base_url": "http://api.minibob.local"
  }
}
CONFIG
```

### 2. Set Environment Variables
```bash
export ANTHROPIC_API_KEY="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"
```

### 3. Start OpenCode TUI
```bash
cd demo-live-integration
opencode
```

## What to Observe in TUI

### Phase 1: Search for Templates
In the opencode TUI, type:
```
search_activities({ category: "feature" })
```

**Expected TUI Output:**
```
🔍 Searching for activities...

Found 15 templates:
  - add-feature-complete (feature) - 85% success
  - refactor-with-tests (refactor) - 92% success
  - fix-bug-complete (bugfix) - 88% success
  ...

✓ Search completed in 245ms
```

**What this proves:**
- Template repository is accessible
- Backend connectivity working
- Ready to execute activities

---

### Phase 2: Execute Activity via Minibob Library
In the TUI, type:
```typescript
activity({
  templateId: 'add-feature-complete',
  variables: {
    featureName: 'subtract function',
    files: ['calculator.ts'],
    description: 'Add a subtract function to the calculator'
  },
  reason: 'Demonstrating minibob library integration with visible TUI feedback'
})
```

**Expected TUI Output - Real-time Updates:**

```
╔══════════════════════════════════════════════════════════╗
║  Activity: Add Feature (Complete)                        ║
╚══════════════════════════════════════════════════════════╝

🔧 Using minibob library integration (NO HTTP)
📍 Activity ID: act_1773969123456_abc123

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Task 1/5: Analyze existing code
⚙️  Executing via minibob library...
📄 Reading calculator.ts
✓ Analysis complete (1.2s)

Task 2/5: Generate implementation
⚙️  Executing via minibob library...
🤖 LLM generating subtract function...
✓ Code generated (2.5s)

Task 3/5: Write code to file
⚙️  Executing via minibob library...
📝 Writing to calculator.ts
✓ File updated (0.3s)

Task 4/5: Run tests
⚙️  Executing via minibob library...
🧪 Running validation...
✓ Validation passed (0.5s)

Task 5/5: Commit changes
⚙️  Executing via minibob library...
📌 Creating commit...
✓ Committed: "Add subtract function to calculator" (0.4s)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Activity Completed Successfully

Summary:
  • Duration: 4.9s
  • Cost: $0.0234
  • Tasks: 5/5 completed
  • Files modified: calculator.ts
  
📊 View in dashboard:
   http://dashboard.minibob.local/activities/act_1773969123456_abc123

Press Enter to continue...
```

**What this proves:**
1. ✅ Activity executed via library (note "Using minibob library integration")
2. ✅ Real-time progress updates visible in TUI
3. ✅ Each task shows execution status
4. ✅ File was actually modified
5. ✅ Git commit created
6. ✅ Dashboard link provided

---

### Phase 3: Verify Changes
In the TUI, type:
```
read({ filePath: 'calculator.ts' })
```

**Expected TUI Output:**
```
📄 calculator.ts
─────────────────────────────────────────────────────────

// Simple calculator functions
export function add(a: number, b: number): number {
  return a + b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}

/**
 * Subtracts two numbers
 * @param a - First number
 * @param b - Second number
 * @returns The difference of a and b
 */
export function subtract(a: number, b: number): number {
  return a - b;
}

─────────────────────────────────────────────────────────
✓ File read successfully
```

**What this proves:**
- ✅ Code was actually modified
- ✅ New subtract function added
- ✅ JSDoc comments included
- ✅ TypeScript types preserved

---

### Phase 4: Check Git History
In the TUI, type:
```
bash({ command: 'git log --oneline -3', description: 'Show recent commits' })
```

**Expected TUI Output:**
```
📋 Git commit history:

a1b2c3d Add subtract function to calculator
e4f5g6h Initial calculator with add and multiply

✓ Command completed in 45ms
```

**What this proves:**
- ✅ Git commit was created
- ✅ Activity made actual changes
- ✅ Changes are tracked in version control

---

### Phase 5: View Dashboard
Open browser to:
```
http://dashboard.minibob.local/activities/act_1773969123456_abc123
```

**Expected Dashboard View:**
```
Activity Details
────────────────────────────────────────────────────

Activity ID: act_1773969123456_abc123
Template: Add Feature (Complete)
Status: ✅ Completed
Duration: 4.9s
Cost: $0.0234

Tasks (5/5 completed):
  ✓ Task 1: Analyze existing code (1.2s)
  ✓ Task 2: Generate implementation (2.5s)
  ✓ Task 3: Write code to file (0.3s)
  ✓ Task 4: Run tests (0.5s)
  ✓ Task 5: Commit changes (0.4s)

Files Modified:
  • calculator.ts (+12 lines)

Commits:
  • a1b2c3d - Add subtract function to calculator

Metrics:
  • Token usage: 1,234 tokens
  • Cache hits: 85%
  • Backend: api.minibob.local
```

**What this proves:**
- ✅ Backend API tracked the activity
- ✅ All metrics collected
- ✅ Dashboard shows real-time data
- ✅ Full integration working

---

## Key Observations to Make

### 1. Library Integration Evidence
Look for these indicators in the TUI:
- ✅ Message: "Using minibob library integration (NO HTTP)"
- ✅ No "Starting minibob server" messages
- ✅ No "Polling for status" messages
- ✅ Direct execution logs from minibob library

### 2. Real-time Feedback
The TUI should show:
- ✅ Task-by-task progress updates
- ✅ Duration for each task
- ✅ Status indicators (⚙️ → ✓)
- ✅ File modifications as they happen
- ✅ Immediate feedback (no delays from polling)

### 3. Agent Behavior Visibility
You should see:
- ✅ What the agent is reading (files, context)
- ✅ What the agent is thinking (analysis steps)
- ✅ What the agent is writing (code changes)
- ✅ What tools the agent is using
- ✅ Real-time LLM responses

### 4. Performance Indicators
Compare to HTTP-based execution:
- ✅ Faster execution (no HTTP overhead)
- ✅ No polling delays
- ✅ Immediate task transitions
- ✅ Real-time progress (not batched updates)

---

## Comparison: HTTP vs Library in TUI

### HTTP-Based (Old):
```
🔧 Starting minibob server... (2s)
⏳ Waiting for server... (1s)
📤 Sending activity to minibob... (0.5s)
⏳ Polling for status... (checking every 500ms)
⏳ Still running... (poll 1)
⏳ Still running... (poll 2)
⏳ Still running... (poll 3)
✓ Activity completed (0.8s)
📥 Fetching results... (0.5s)

Total overhead: ~5.3s
Updates: Delayed, batched
```

### Library-Based (New):
```
🔧 Using minibob library integration
⚙️  Task 1: Analyzing... → ✓ Done (1.2s)
⚙️  Task 2: Generating... → ✓ Done (2.5s)
⚙️  Task 3: Writing... → ✓ Done (0.3s)
⚙️  Task 4: Testing... → ✓ Done (0.5s)
⚙️  Task 5: Committing... → ✓ Done (0.4s)

Total overhead: ~0s
Updates: Real-time, immediate
```

---

## Advanced Demo: Show Multiple Activities

### Run Multiple Activities in Sequence
```typescript
// Activity 1: Add division function
activity({
  templateId: 'add-feature-complete',
  variables: {
    featureName: 'divide function',
    files: ['calculator.ts']
  },
  reason: 'Adding division'
})

// Activity 2: Add tests
activity({
  templateId: 'add-comprehensive-tests',
  variables: {
    targetFile: 'calculator.ts',
    testFile: 'calculator.test.ts'
  },
  reason: 'Adding test coverage'
})

// Activity 3: Refactor
activity({
  templateId: 'refactor-with-tests',
  variables: {
    files: ['calculator.ts'],
    goal: 'Extract validation logic'
  },
  reason: 'Code quality improvement'
})
```

**TUI should show:**
- ✅ Activities execute one after another
- ✅ Each shows real-time progress
- ✅ Dashboard links for each activity
- ✅ Cumulative file changes visible
- ✅ Git commits for each activity

---

## Troubleshooting

### If you see "minibob not enabled"
Check `.opencode.json`:
```json
{
  "minibob": {
    "enabled": true
  }
}
```

### If you see "ConfigInvalidError"
Verify API key is set:
```bash
echo $ANTHROPIC_API_KEY
```

### If you see HTTP messages
Check that minibob library is properly linked:
```bash
cd repos/minibob && bun run build && bun link
cd repos/metabob-opencode && bun link @metabob/minibob
```

### If dashboard doesn't show activity
Verify backend connectivity:
```bash
curl http://api.minibob.local/health
```

---

## Success Criteria

The demo is successful if you observe:

1. ✅ **No HTTP server startup** - Library executes directly
2. ✅ **Real-time progress** - Updates appear immediately
3. ✅ **Actual file modifications** - Code changes are made
4. ✅ **Git commits created** - Changes are tracked
5. ✅ **Dashboard tracking** - Activity appears in dashboard
6. ✅ **Cost metrics** - Token usage and costs displayed
7. ✅ **Fast execution** - Completes in < 5s for simple tasks
8. ✅ **Visible agent behavior** - You can see what the agent is doing

---

## Expected Outcome

After running this demo, you will have proven:
- ✅ Minibob library integration works in real TUI
- ✅ Users can observe agent behavior in real-time
- ✅ Activities make actual code changes
- ✅ Backend tracking is functional
- ✅ Dashboard integration works
- ✅ Performance is superior to HTTP
- ✅ The integration is production-ready

🚀 **Ready for real development work!**
