# Terminal Vessel + MiniBob-TUI Quick Start

**Goal:** Use MiniBob-TUI to view terminal command outputs through the terminal vessel integration.

---

## What You'll Learn

1. How to start the terminal vessel
2. How MiniBob-TUI displays terminal outputs as impulses
3. How to create activities that use both TUI and terminal capabilities
4. How to view MiniBob's own execution through the TUI

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   Terminal Vessel                            │
│  - Spawns terminal sessions                                  │
│  - Executes commands                                         │
│  - Streams output as impulses                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                  HTTP/MCP Protocol
                       │
┌──────────────────────┴──────────────────────────────────────┐
│                    MiniBob Core                              │
│  - Activity execution                                        │
│  - Impulse management                                        │
│  - Tool resolution                                           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                Lifecycle Hooks
                       │
┌──────────────────────┴──────────────────────────────────────┐
│                  MiniBob-TUI                                 │
│  - Renders impulses as terminal regions                     │
│  - Provides TUI tools (tui_emit, tui_observe, etc.)         │
│  - Displays terminal vessel outputs                         │
└─────────────────────────────────────────────────────────────┘
```

**Key Flow:**
1. Activity calls `terminal_spawn` → Terminal vessel creates session
2. Terminal vessel emits impulse with shape `terminal_output`
3. MiniBob-TUI receives impulse via lifecycle hook
4. TUI renders impulse as terminal region in UI

---

## Setup

### Option 1: View MiniBob's Own Output (Simplest)

The easiest way to see terminal outputs in MiniBob-TUI is to view MiniBob's own execution:

```bash
# Terminal 1: Start MiniBob-TUI in embedded mode
cd repos/minibob-tui
export ANTHROPIC_API_KEY="sk-ant-your-key"
bun run start --embedded --dev
```

Now when you submit goals, you'll see:
- **Activity regions**: Show activity execution progress
- **Task regions**: Show each task step-by-step
- **Log streams**: Show command outputs as they execute
- **Code generation**: Show files being written

**Example Goal:**
```
Create a simple test file with bash
```

**Expected TUI Regions:**
```
┌─ Activity: improvisation ──────────────────────────────────┐
│ Status: Running                                             │
│ Task 1/2: Create test file ⟳                               │
└─────────────────────────────────────────────────────────────┘

┌─ Log Stream ────────────────────────────────────────────────┐
│ [Bash] Running: echo "test content" > /tmp/test.txt        │
│ [Bash] ✓ Exit code: 0                                      │
└─────────────────────────────────────────────────────────────┘

┌─ Code Generation ───────────────────────────────────────────┐
│ File: /tmp/test.txt                                         │
│ Content:                                                    │
│   test content                                              │
└─────────────────────────────────────────────────────────────┘
```

### Option 2: Use Standalone Terminal Vessel

For more complex scenarios with dedicated terminal sessions:

```bash
# Terminal 1: Start terminal vessel
cd repos/terminal
export METABOB_API_KEY="your-api-key"
bun run src/index.ts

# Terminal 2: Start MiniBob-TUI (embedded mode)
cd repos/minibob-tui
export ANTHROPIC_API_KEY="sk-ant-your-key"
export METABOB_API_KEY="your-api-key"
bun run start --embedded --dev
```

---

## Quick Test: View Command Output in TUI

### Test 1: Simple Echo

In MiniBob-TUI, type this goal:
```
Run the command "echo 'Hello from terminal vessel'" and display the output
```

**What Happens:**
1. MiniBob creates an improvisation activity
2. Activity uses `bash` tool (built-in) to execute command
3. Output is captured and emitted as impulse
4. TUI displays the output in a log stream region

**Expected TUI:**
```
┌─ Log Stream ────────────────────────────────────────────────┐
│ Hello from terminal vessel                                  │
└─────────────────────────────────────────────────────────────┘
```

### Test 2: List Files

```
List all files in the current directory with ls -la
```

**Expected TUI:**
```
┌─ Log Stream ────────────────────────────────────────────────┐
│ total 48                                                    │
│ drwxr-xr-x  12 user  staff   384 Apr  9 10:30 .           │
│ drwxr-xr-x   8 user  staff   256 Apr  9 09:15 ..          │
│ -rw-r--r--   1 user  staff  1024 Apr  9 10:29 README.md   │
│ -rw-r--r--   1 user  staff   256 Apr  9 10:28 package.json│
│ ...                                                         │
└─────────────────────────────────────────────────────────────┘
```

### Test 3: Multi-Step Command

```
Create a directory called 'test-output', create a file inside it with some content, then list the directory
```

**Expected TUI:**
```
┌─ Activity: improvisation ──────────────────────────────────┐
│ Status: Running                                             │
│ Task 1/3: Create directory ✓                               │
│ Task 2/3: Create file ✓                                    │
│ Task 3/3: List directory ⟳                                 │
└─────────────────────────────────────────────────────────────┘

┌─ Log Stream (Task 1) ───────────────────────────────────────┐
│ [Bash] mkdir -p test-output                                │
│ [Bash] ✓ Exit code: 0                                      │
└─────────────────────────────────────────────────────────────┘

┌─ Log Stream (Task 2) ───────────────────────────────────────┐
│ [Bash] echo "test content" > test-output/file.txt          │
│ [Bash] ✓ Exit code: 0                                      │
└─────────────────────────────────────────────────────────────┘

┌─ Log Stream (Task 3) ───────────────────────────────────────┐
│ test-output/                                                │
│   file.txt                                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## TUI Tools for Self-Observation

MiniBob-TUI provides 6 tools that activities can use to observe and interact with the TUI itself:

### 1. `tui_emit` - Display Content

Activities can emit content directly to TUI:

```
Use tui_emit to display a success message: "Operation completed successfully!"
```

**TUI Output:**
```
┌─ Notification ──────────────────────────────────────────────┐
│ Operation completed successfully!                           │
└─────────────────────────────────────────────────────────────┘
```

### 2. `tui_observe` - Query TUI State

Activities can inspect the current TUI state:

```
Use tui_observe to list all active regions in the TUI
```

**LLM will report something like:**
```
Current TUI state:
- 3 active regions
- Region IDs: activity-001, log-stream-002, notification-003
- Scroll position: 0
- Input state: idle
```

### 3. `tui_render` - Capture Display

Activities can capture what's currently rendered:

```
Use tui_render to capture the current TUI output as text
```

**LLM will receive the full rendered text** and can analyze it.

### 4. `tui_wait_for` - Wait for Conditions

Activities can wait for UI changes:

```
Emit a notification, then wait for it to appear using tui_wait_for
```

### 5. `tui_snapshot` - Full State Dump

Get complete TUI state including regions, input, scroll, and rendered output:

```
Take a complete TUI snapshot using tui_snapshot
```

### 6. `tui_inject` - Inject Input (Testing)

Simulate keyboard input for testing:

```
Use tui_inject to type "test input" into the TUI
```

---

## Advanced: Self-Verifying Activities

Create activities that verify their own output appears correctly in the TUI.

### Example: Verify Success Message

**Goal:**
```
Create an activity that emits a success message and verifies it appears in the TUI
```

**What MiniBob Will Do:**
1. Create improvisation activity with 3 tasks
2. **Task 1:** Take baseline snapshot with `tui_snapshot`
3. **Task 2:** Emit success message with `tui_emit`
4. **Task 3:** Verify with `tui_observe` and `tui_render`

**Expected TUI:**
```
┌─ Activity: improvisation ──────────────────────────────────┐
│ Status: Running                                             │
│ Task 1/3: Baseline snapshot ✓                              │
│ Task 2/3: Emit message ✓                                   │
│ Task 3/3: Verify ⟳                                         │
└─────────────────────────────────────────────────────────────┘

┌─ Success ───────────────────────────────────────────────────┐
│ Test message appeared successfully!                         │
└─────────────────────────────────────────────────────────────┘

┌─ Log Stream ────────────────────────────────────────────────┐
│ Verification Results:                                       │
│ ✓ Message found in TUI regions                             │
│ ✓ Rendered output contains expected text                   │
│ ✓ Region count increased by 1                              │
│ All checks passed!                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Common Use Cases

### 1. View Build Output

```
Run 'bun run build' and show the output in the TUI
```

**TUI will show:**
- Command execution log
- Build progress
- Success/error messages
- File artifacts created

### 2. View Test Results

```
Run the tests with 'bun test' and display the results
```

**TUI will show:**
- Test suite execution
- Pass/fail status for each test
- Error messages for failures
- Summary statistics

### 3. View Git Status

```
Show the git status and recent commits
```

**TUI will show:**
- Current branch
- Modified files
- Staged changes
- Recent commits with messages

### 4. Interactive Command Monitoring

```
Run a long-running command and show its output in real-time
```

Example: `npm install` or `docker build`

**TUI will stream output** as it becomes available, creating a live view of execution.

---

## Comparing TUI Regions to Terminal Output

### Traditional Terminal

```bash
$ echo "Hello World"
Hello World
$ ls -la
total 48
drwxr-xr-x  12 user  staff   384 Apr  9 10:30 .
...
$
```

**Issues:**
- Output scrolls away
- Can't revisit past commands easily
- No structure or categorization
- Hard to track multiple operations

### MiniBob-TUI

```
┌─ Log Stream (echo) ─────────────────────────────────────────┐
│ Hello World                                                 │
└─────────────────────────────────────────────────────────────┘

┌─ Log Stream (ls -la) ───────────────────────────────────────┐
│ total 48                                                    │
│ drwxr-xr-x  12 user  staff   384 Apr  9 10:30 .           │
│ ...                                                         │
└─────────────────────────────────────────────────────────────┘

┌─ Activity: improvisation ──────────────────────────────────┐
│ Status: Completed                                           │
│ Duration: 2.3s                                              │
└─────────────────────────────────────────────────────────────┘
```

**Benefits:**
- Each output is a persistent region
- Can scroll through all regions
- Structured by activity and task
- Clear visual separation
- Prioritized display (important stuff at top)

---

## Troubleshooting

### Issue: No Regions Appearing

**Symptom:** Commands execute but no output shows in TUI

**Cause:** TUI hooks not registered

**Solution:** Verify embedded mode initialization:
```bash
# Should see this in startup logs:
[EmbeddedMiniBob] ✓ 6 TUI tools registered
```

### Issue: Truncated Output

**Symptom:** Only seeing partial command output

**Cause:** Token budget exceeded for impulse

**Solution:** Increase impulse budget or use `tui_render` with pagination

### Issue: Output Not Streaming

**Symptom:** Output appears all at once after command completes

**Cause:** Buffering in command execution

**Solution:** Terminal vessel streams output - if using built-in bash tool, output is collected first

---

## Next Steps

1. **Test with Production Package:**
   - Once MiniBob 0.3.8 is published, update MiniBob-TUI
   - Run `bun install` to get latest version
   - Test all flows from this guide

2. **Create Custom Activities:**
   - Design activities that use both terminal and TUI capabilities
   - Submit to activity API for reuse
   - Share templates with team

3. **Integrate with CI/CD:**
   - Use MiniBob-TUI to monitor build pipelines
   - Display test results in structured format
   - Track deployment progress visually

4. **Extend TUI Tools:**
   - Add custom visualization components
   - Create domain-specific shapes
   - Build activity-specific renderers

---

## Summary

**MiniBob-TUI is an impulse renderer** - it displays whatever MiniBob executes:

- **Bash commands** → Log stream regions
- **File operations** → Code generation regions
- **Activity progress** → Activity regions
- **Errors** → Error regions
- **Custom content** → Via `tui_emit` tool

**Terminal vessel** extends this with dedicated terminal sessions, but **built-in bash tool works great for most cases**.

**Key Insight:** You don't need the terminal vessel to see command outputs in MiniBob-TUI - MiniBob's built-in bash tool already emits impulses that the TUI renders!

**To get started right now:**

```bash
cd repos/minibob-tui
export ANTHROPIC_API_KEY="sk-ant-your-key"
bun run start --embedded --dev

# Then type any goal that involves commands:
> Run ls -la and show me the files
> Create a test directory and put 3 files in it
> Show me the git status
```

Everything MiniBob does will appear as structured regions in the TUI!
