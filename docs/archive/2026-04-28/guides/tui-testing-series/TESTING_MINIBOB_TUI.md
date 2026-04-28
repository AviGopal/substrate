# Testing MiniBob-TUI with Production Package

**Context:** MiniBob-TUI has been refactored to use `@metabob/minibob@^0.3.8` production package instead of local file reference.

**Goal:** Verify the refactoring works and demonstrate terminal vessel integration for viewing outputs.

---

## Prerequisites

### 1. Verify MiniBob Package is Published

```bash
# Check if @metabob/minibob is available
npm view @metabob/minibob version

# Expected output: 0.3.8 (or similar)
```

If not published, publish MiniBob first:
```bash
cd repos/minibob
npm publish --access public
```

### 2. Install Dependencies

```bash
cd repos/minibob-tui

# Remove old dependencies
rm -rf node_modules bun.lockb

# Install with production package
bun install

# Verify correct version installed
bun pm ls | grep @metabob/minibob
# Should show: @metabob/minibob@0.3.8 (not file:../minibob)
```

### 3. Type Check

```bash
bun run typecheck
# Should pass without errors
```

---

## Test 1: Embedded Mode (In-Process MiniBob)

**What this tests:**
- Production package initialization works
- EmbeddedMiniBob wrapper functions correctly
- TUI tools are registered and accessible
- Activity execution creates impulses that render in TUI

### Step 1.1: Start Embedded Mode

```bash
cd repos/minibob-tui

# Set API key
export ANTHROPIC_API_KEY="sk-ant-your-key-here"

# Start in embedded mode with development activities enabled
bun run start --embedded --dev
```

**Expected Output:**
```
[MiniBob-TUI] Starting in embedded mode...
[MiniBob-TUI] Initializing MiniBob from @metabob/minibob@0.3.8
[EmbeddedMiniBob] Bootstrap sequence starting...
[EmbeddedMiniBob] ✓ API key configured
[EmbeddedMiniBob] ✓ Activity API reachable (https://activity.metabob.com)
[EmbeddedMiniBob] ✓ 6 TUI tools registered:
  - tui_emit: Emit impulse to display content
  - tui_observe: Query TUI state
  - tui_render: Capture terminal output
  - tui_wait_for: Wait for UI conditions
  - tui_snapshot: Full state dump
  - tui_inject: Inject keyboard input
[MiniBob-TUI] Ready. Type a goal to begin.
```

### Step 1.2: Submit a Goal Using TUI Tools

Type this goal in the TUI:
```
Execute the demo-impulse-creation activity to demonstrate terminal impulse creation
```

**Expected Behavior:**
1. MiniBob finds `demo-impulse-creation` activity template (if it exists)
2. Activity executes, calling `tui_emit` tool to create terminal impulses
3. TUI displays new regions for each impulse emitted
4. Activity completes, showing success/failure status

**What to Verify:**
- [ ] Goal submitted successfully
- [ ] Activity execution starts (see "Activity: demo-impulse-creation" region appear)
- [ ] TUI regions appear as impulses are emitted
- [ ] Task progress updates show in real-time
- [ ] Activity completes successfully
- [ ] No errors related to package imports

### Step 1.3: Test TUI Tools Directly

Create a test activity that exercises all TUI tools:

```bash
# Create test activity template
cat > /tmp/test-tui-tools.json <<'EOF'
{
  "id": "test-tui-tools",
  "name": "Test TUI Tools Integration",
  "category": "tool",
  "description": "Verify all 6 TUI tools work with production package",
  "tasks": [
    {
      "id": "test-emit",
      "description": "Test tui_emit for creating impulses",
      "prompt": {
        "template": "Use the tui_emit tool to create a notification impulse with content 'Test notification from activity' and priority 700."
      }
    },
    {
      "id": "test-observe",
      "description": "Test tui_observe for querying state",
      "prompt": {
        "template": "Use the tui_observe tool with query='regions' to list all active regions. Report how many regions exist."
      }
    },
    {
      "id": "test-render",
      "description": "Test tui_render for capturing output",
      "prompt": {
        "template": "Use the tui_render tool with format='text' to capture the current terminal output. Verify the captured text is non-empty."
      }
    },
    {
      "id": "test-snapshot",
      "description": "Test tui_snapshot for full state dump",
      "prompt": {
        "template": "Use the tui_snapshot tool with includeRender=true to get a complete state dump. Verify it includes regions, input state, scroll position, and rendered output."
      }
    }
  ]
}
EOF

# Submit to activity API
curl -X POST https://activity.metabob.com/v2/activities/templates \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  -H "Content-Type: application/json" \
  -d @/tmp/test-tui-tools.json
```

Then in MiniBob-TUI, submit the goal:
```
Execute test-tui-tools activity
```

**Expected Output:**
- Task 1: New region appears with "Test notification from activity"
- Task 2: LLM reports count of active regions (should be ≥ 1)
- Task 3: LLM confirms captured text is non-empty
- Task 4: LLM confirms snapshot contains all expected fields

**What to Verify:**
- [ ] All 4 tasks complete successfully
- [ ] No TypeScript errors related to tool types
- [ ] No package import errors
- [ ] Tool results are correctly formatted and returned to LLM

---

## Test 2: Remote Mode (Daemon + Client)

**What this tests:**
- MiniBob daemon can run with production package
- TUI connects via WebSocket
- Impulse streaming works correctly
- Goals can be submitted remotely

### Step 2.1: Start MiniBob Daemon

**Terminal 1:**
```bash
cd repos/minibob

# Start MiniBob in daemon mode
export ANTHROPIC_API_KEY="sk-ant-your-key-here"
bun run index.ts --daemon --port 8080

# Expected output:
# [MiniBob] Daemon mode starting...
# [MiniBob] HTTP server listening on http://localhost:8080
# [MiniBob] WebSocket server ready
# [MiniBob] Endpoints:
#   - GET  /health
#   - POST /goal
#   - GET  /status
#   - GET  /ws (WebSocket)
```

### Step 2.2: Connect TUI Client

**Terminal 2:**
```bash
cd repos/minibob-tui

# Connect to daemon
bun run start --endpoint http://localhost:8080

# Expected output:
# [MiniBob-TUI] Remote mode starting...
# [MiniBob-TUI] Connecting to http://localhost:8080/ws
# [MiniBob-TUI] ✓ WebSocket connected
# [MiniBob-TUI] Subscribing to impulse stream...
# [MiniBob-TUI] Ready. Type a goal to begin.
```

### Step 2.3: Submit Goal via HTTP

**Terminal 3:**
```bash
# Submit goal via HTTP endpoint
curl -X POST http://localhost:8080/goal \
  -H "Content-Type: application/json" \
  -d '{"goal": "Create a test impulse with tui_emit"}'
```

**Expected Behavior:**
- Terminal 1 (daemon): Shows goal processing logs
- Terminal 2 (TUI): Receives impulse updates via WebSocket, displays regions
- Terminal 3 (curl): Returns execution ID and status

**What to Verify:**
- [ ] WebSocket connection established successfully
- [ ] Goals submitted via HTTP appear in TUI
- [ ] Impulse updates stream in real-time
- [ ] No connection drops or errors
- [ ] Both terminals show synchronized state

---

## Test 3: Terminal Vessel Integration

**What this tests:**
- Terminal vessel can spawn processes
- MiniBob-TUI can display terminal vessel outputs
- Activities can use terminal vessel to execute commands and display results in TUI

### Overview: Terminal Vessel Architecture

The terminal vessel (`repos/terminal`) provides process execution capabilities:

**Capabilities:**
- `terminal_management`: Create/manage terminal sessions
- `process_execution`: Spawn processes, send input, read output

**MCP Tools:**
- `terminal_spawn`: Create new terminal session with command
- `terminal_send_input`: Send input to running terminal
- `terminal_read_output`: Read output from terminal buffer

**Impulse Shape:**
- `terminal_output`: Streaming output from terminal sessions

### Step 3.1: Start Terminal Vessel

**Terminal 1:**
```bash
cd repos/terminal

# Install dependencies if needed
bun install

# Start terminal vessel
export METABOB_API_KEY="your-api-key"
bun run src/index.ts

# Expected output:
# [TerminalVessel] Starting...
# [TerminalVessel] Registering with activity API...
# [TerminalVessel] ✓ Registered as vessel: terminal-vessel-001
# [TerminalVessel] Capabilities: terminal_management, process_execution
# [TerminalVessel] HTTP server listening on http://localhost:3000
# [TerminalVessel] Heartbeat: 30s interval
```

### Step 3.2: Start MiniBob-TUI (Embedded Mode)

**Terminal 2:**
```bash
cd repos/minibob-tui

export ANTHROPIC_API_KEY="sk-ant-your-key-here"
export METABOB_API_KEY="your-api-key"

# Start with terminal vessel endpoint configured
bun run start --embedded --dev
```

### Step 3.3: Create Activity That Uses Terminal Vessel

Create an activity that spawns a terminal and displays output in TUI:

```bash
cat > /tmp/terminal-demo-activity.json <<'EOF'
{
  "id": "terminal-demo-tui",
  "name": "Terminal Vessel + TUI Demo",
  "category": "tool",
  "description": "Demonstrate terminal vessel integration with MiniBob-TUI",
  "tasks": [
    {
      "id": "spawn-terminal",
      "description": "Spawn a terminal and run a command",
      "prompt": {
        "template": "Use the terminal_spawn tool to create a new terminal session running the command 'echo \"Hello from terminal vessel\"'. Store the terminal ID for subsequent tasks."
      },
      "tools": ["terminal_spawn"]
    },
    {
      "id": "emit-terminal-output",
      "description": "Display terminal output in TUI",
      "prompt": {
        "template": "Use the terminal_read_output tool to read the output from the terminal session created in the previous task. Then use tui_emit to display this output in the TUI with shape='log_stream' and title='Terminal Output'."
      },
      "tools": ["terminal_read_output", "tui_emit"]
    },
    {
      "id": "send-more-input",
      "description": "Send additional input to terminal",
      "prompt": {
        "template": "Use terminal_send_input to send the command 'ls -la' to the terminal session. Wait 1 second, read the output with terminal_read_output, and emit it to the TUI using tui_emit."
      },
      "tools": ["terminal_send_input", "terminal_read_output", "tui_emit"]
    },
    {
      "id": "verify-in-tui",
      "description": "Verify output appears in TUI",
      "prompt": {
        "template": "Use tui_observe with query='regions' to verify that terminal output regions have been created. Use tui_render to capture the current TUI state and confirm terminal outputs are visible."
      },
      "tools": ["tui_observe", "tui_render"]
    }
  ]
}
EOF

# Submit activity template
curl -X POST https://activity.metabob.com/v2/activities/templates \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  -H "Content-Type: application/json" \
  -d @/tmp/terminal-demo-activity.json
```

### Step 3.4: Execute Terminal Demo Activity

In MiniBob-TUI (Terminal 2), type:
```
Execute terminal-demo-tui activity
```

**Expected TUI Regions to Appear:**

```
┌─ Activity: Terminal Vessel + TUI Demo ────────────────────┐
│ Status: Running                                            │
│ Task 1/4: spawn-terminal ✓                                │
│ Task 2/4: emit-terminal-output ✓                          │
│ Task 3/4: send-more-input ✓                               │
│ Task 4/4: verify-in-tui ⟳                                 │
└────────────────────────────────────────────────────────────┘

┌─ Terminal Output ──────────────────────────────────────────┐
│ Hello from terminal vessel                                 │
└────────────────────────────────────────────────────────────┘

┌─ Terminal Output ──────────────────────────────────────────┐
│ total 48                                                    │
│ drwxr-xr-x  12 user  staff   384 Apr  9 10:30 .           │
│ drwxr-xr-x   8 user  staff   256 Apr  9 09:15 ..          │
│ -rw-r--r--   1 user  staff  1024 Apr  9 10:29 README.md   │
│ ...                                                         │
└────────────────────────────────────────────────────────────┘
```

**What to Verify:**
- [ ] Terminal vessel spawns successfully
- [ ] Command output is captured
- [ ] tui_emit displays terminal output in TUI regions
- [ ] Multiple terminal outputs appear as separate regions
- [ ] tui_observe confirms regions exist
- [ ] tui_render captures all terminal output in TUI state

### Step 3.5: Advanced Test - Interactive Terminal Session

Create an activity that demonstrates interactive terminal usage:

```bash
cat > /tmp/interactive-terminal-demo.json <<'EOF'
{
  "id": "interactive-terminal-demo",
  "name": "Interactive Terminal with TUI",
  "category": "tool",
  "description": "Demonstrate interactive terminal session with real-time TUI updates",
  "tasks": [
    {
      "id": "spawn-python-repl",
      "description": "Spawn Python REPL in terminal",
      "prompt": {
        "template": "Use terminal_spawn to create a terminal running 'python3'. Emit the terminal ID to TUI using tui_emit with title='Python REPL Started'."
      },
      "tools": ["terminal_spawn", "tui_emit"]
    },
    {
      "id": "execute-python-code",
      "description": "Execute Python code and display results",
      "prompt": {
        "template": "Send the following Python code to the terminal using terminal_send_input:\n\nprint('Computing factorial of 10...')\nimport math\nresult = math.factorial(10)\nprint(f'10! = {result}')\n\nThen read the output and emit it to TUI with shape='code_generation' and title='Python Execution'."
      },
      "tools": ["terminal_send_input", "terminal_read_output", "tui_emit"]
    },
    {
      "id": "stream-updates",
      "description": "Demonstrate streaming updates",
      "prompt": {
        "template": "Send a loop command: 'for i in range(5): print(f\"Count: {i}\")'. Read output after each iteration (use terminal_read_output 5 times with 200ms delays). For each read, emit to TUI with tui_emit. This demonstrates streaming updates."
      },
      "tools": ["terminal_send_input", "terminal_read_output", "tui_emit"]
    }
  ]
}
EOF

curl -X POST https://activity.metabob.com/v2/activities/templates \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  -H "Content-Type: application/json" \
  -d @/tmp/interactive-terminal-demo.json
```

Execute in MiniBob-TUI:
```
Execute interactive-terminal-demo activity
```

**Expected Behavior:**
- Python REPL starts in terminal vessel
- Python code executes and output appears in TUI
- Multiple regions appear showing streaming execution
- Each count appears as a separate impulse/region
- All output is visible in TUI simultaneously

---

## Test 4: Self-Verification Loop

**Goal:** Create an activity that verifies its own TUI output using TUI tools.

This demonstrates the self-verification pattern where activities can check that their output is correctly displayed.

### Step 4.1: Create Self-Verifying Activity

```bash
cat > /tmp/self-verify-activity.json <<'EOF'
{
  "id": "self-verify-tui-output",
  "name": "Self-Verifying TUI Output",
  "category": "tool",
  "description": "Activity that creates output and verifies it appears correctly in TUI",
  "tasks": [
    {
      "id": "baseline-snapshot",
      "description": "Take baseline TUI snapshot",
      "prompt": {
        "template": "Use tui_snapshot with includeRender=false to capture the current TUI state. Store the number of regions for comparison."
      },
      "tools": ["tui_snapshot"]
    },
    {
      "id": "emit-test-content",
      "description": "Emit test content to TUI",
      "prompt": {
        "template": "Use tui_emit to create 3 impulses:\n1. Notification with content 'Test 1: Info message' (shape='info', priority=600)\n2. Success with content 'Test 2: Success message' (shape='success', priority=650)\n3. Warning with content 'Test 3: Warning message' (shape='warning', priority=700)\n\nWait 500ms between each emission to ensure they're processed."
      },
      "tools": ["tui_emit"]
    },
    {
      "id": "wait-for-regions",
      "description": "Wait for regions to appear",
      "prompt": {
        "template": "Use tui_wait_for with condition='region_appears' and timeout=5000 to wait for the new regions to be created and rendered."
      },
      "tools": ["tui_wait_for"]
    },
    {
      "id": "verify-regions-exist",
      "description": "Verify all regions exist",
      "prompt": {
        "template": "Use tui_observe with query='regions' to get the list of active regions. Verify that:\n1. Region count increased by 3 (compared to baseline)\n2. Regions with 'Test 1', 'Test 2', 'Test 3' content exist\n3. Regions have correct shapes (info, success, warning)\n4. Regions have correct priorities (600, 650, 700)\n\nReport verification results."
      },
      "tools": ["tui_observe"]
    },
    {
      "id": "verify-rendered-output",
      "description": "Verify rendered output contains test messages",
      "prompt": {
        "template": "Use tui_render with format='text' to capture the rendered TUI output. Verify the rendered text contains:\n- 'Test 1: Info message'\n- 'Test 2: Success message'\n- 'Test 3: Warning message'\n\nReport whether all messages are visible in rendered output."
      },
      "tools": ["tui_render"]
    },
    {
      "id": "final-snapshot",
      "description": "Take final snapshot for audit",
      "prompt": {
        "template": "Use tui_snapshot with includeRender=true to capture complete final state. Compare with baseline snapshot and report:\n- Number of regions added\n- Total regions now vs baseline\n- Rendered output size increase\n\nEmit a success message to TUI if all verifications passed."
      },
      "tools": ["tui_snapshot", "tui_emit"]
    }
  ]
}
EOF

curl -X POST https://activity.metabob.com/v2/activities/templates \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  -H "Content-Type: application/json" \
  -d @/tmp/self-verify-activity.json
```

### Step 4.2: Execute Self-Verification

In MiniBob-TUI:
```
Execute self-verify-tui-output activity
```

**Expected Verification Results:**

Task 4 (verify-regions-exist) should report:
```
✓ Region count increased by 3 (was 2, now 5)
✓ Found region with content "Test 1: Info message"
✓ Found region with content "Test 2: Success message"
✓ Found region with content "Test 3: Warning message"
✓ All regions have correct shapes: info, success, warning
✓ All regions have correct priorities: 600, 650, 700
```

Task 5 (verify-rendered-output) should report:
```
✓ Rendered output contains "Test 1: Info message"
✓ Rendered output contains "Test 2: Success message"
✓ Rendered output contains "Test 3: Warning message"
✓ All test messages are visible in TUI
```

Task 6 (final-snapshot) should report:
```
Baseline: 2 regions, 1,234 chars rendered
Final: 5 regions, 3,456 chars rendered
Delta: +3 regions, +2,222 chars
✓ All verifications passed
```

**What to Verify:**
- [ ] Activity completes all 6 tasks successfully
- [ ] Baseline snapshot captures initial state
- [ ] 3 test impulses are emitted and appear in TUI
- [ ] tui_wait_for detects new regions appearing
- [ ] tui_observe confirms all 3 regions exist with correct metadata
- [ ] tui_render confirms all messages are visible
- [ ] Final snapshot shows state delta correctly
- [ ] Success message appears at end

---

## Test 5: Production Package Verification

**Goal:** Verify the refactoring to use `@metabob/minibob@^0.3.8` didn't break anything.

### Step 5.1: Check Package Structure

```bash
cd repos/minibob-tui

# Verify package is installed from registry, not local file
ls -la node_modules/@metabob/minibob
# Should be a real directory, not a symlink

# Verify version
cat node_modules/@metabob/minibob/package.json | grep version
# Should show: "version": "0.3.8"

# Check that logger export exists
ls node_modules/@metabob/minibob/src/logger.ts
# Should exist

# Verify package.json exports
cat node_modules/@metabob/minibob/package.json | jq '.exports'
# Should include "./logger": "./src/logger.ts"
```

### Step 5.2: Test Import Resolution

```bash
# Create test file to verify imports work
cat > /tmp/test-imports.ts <<'EOF'
// Test that all imports from refactoring work correctly
import { MiniBob } from "@metabob/minibob";
import { getLogger } from "@metabob/minibob/logger";
import type { Impulse, Activity } from "@metabob/minibob/types";

const logger = getLogger("test-imports");
logger.info("Imports resolved successfully");

// Verify MiniBob class is available
const mb = new MiniBob({
  apiKey: "test-key",
  workdir: "/tmp"
});

console.log("✓ All imports resolved correctly");
console.log("✓ Production package @metabob/minibob@0.3.8 is working");
EOF

# Run test
cd repos/minibob-tui
bun run /tmp/test-imports.ts

# Expected output:
# Imports resolved successfully
# ✓ All imports resolved correctly
# ✓ Production package @metabob/minibob@0.3.8 is working
```

### Step 5.3: Compare Behavior (Local vs Production)

If you have a backup with local file reference, compare behavior:

```bash
# Backup current state
cd repos/minibob-tui
git stash

# Restore local file reference
git checkout backup-pre-alignment  # Created during refactoring

# Run same test activity
export ANTHROPIC_API_KEY="sk-ant-your-key"
bun run start --embedded --dev
# Execute: "Execute test-tui-tools activity"
# Record results

# Switch back to production package
git checkout feat/align-with-minibob-phase2

# Run same test activity
bun run start --embedded --dev
# Execute: "Execute test-tui-tools activity"
# Compare results - should be identical
```

**What to Verify:**
- [ ] Same activities execute successfully with both versions
- [ ] Same TUI regions appear
- [ ] Same tool results
- [ ] No regressions in functionality
- [ ] Production package performs as well as local reference

---

## Test 6: Integration Test Suite

Create a comprehensive test suite that exercises all integration points:

```bash
cd repos/minibob-tui

# Create integration test script
cat > test-integration.ts <<'EOF'
#!/usr/bin/env bun
import { test, expect, beforeAll, afterAll } from "bun:test";
import { MiniBob } from "@metabob/minibob";
import { getLogger } from "@metabob/minibob/logger";

let minibob: MiniBob;

beforeAll(async () => {
  minibob = new MiniBob({
    apiKey: process.env.ANTHROPIC_API_KEY!,
    workdir: "/tmp/minibob-tui-test",
  });
});

afterAll(async () => {
  await minibob.cleanup();
});

test("MiniBob initializes from production package", () => {
  expect(minibob).toBeDefined();
});

test("getLogger is exported correctly", () => {
  const logger = getLogger("test");
  expect(logger).toBeDefined();
  expect(typeof logger.info).toBe("function");
});

test("MiniBob can process simple goal", async () => {
  const result = await minibob.processGoal("echo 'test'");
  expect(result).toBeDefined();
  expect(result.success).toBe(true);
}, 30000);

// Add more tests...
EOF

chmod +x test-integration.ts

# Run tests
bun test test-integration.ts
```

---

## Troubleshooting

### Issue: Package Not Found

```bash
# Error: Cannot find package '@metabob/minibob'
# Solution: Publish MiniBob first
cd repos/minibob
npm publish --access public
```

### Issue: Import Errors

```bash
# Error: Cannot find module '@metabob/minibob/logger'
# Solution: Verify MiniBob package.json exports
cd repos/minibob
cat package.json | jq '.exports'

# Should include:
# {
#   ".": "./src/index.ts",
#   "./logger": "./src/logger.ts",
#   "./types": "./src/types.ts"
# }
```

### Issue: Type Errors

```bash
# Error: Type definitions not found
# Solution: Ensure MiniBob has proper TypeScript exports
cd repos/minibob
cat tsconfig.json

# Verify declaration: true in compilerOptions
# Run build to generate .d.ts files
bun run build
```

### Issue: TUI Tools Not Found

```bash
# Error: Tool 'tui_emit' not registered
# Solution: Verify TUIToolProvider is initialized
# Check src/lib/embedded-minibob.ts

# Ensure tools are passed to MiniBob constructor:
const minibob = new MiniBob({
  tools: this.toolProvider.getTools()
})
```

---

## Success Criteria

All tests pass when:

- [x] **Package Installation**: `@metabob/minibob@^0.3.8` installs from npm registry
- [x] **Type Checking**: `bun run typecheck` passes without errors
- [x] **Embedded Mode**: TUI starts with embedded MiniBob and shows bootstrap sequence
- [x] **TUI Tools**: All 6 tools (tui_emit, tui_observe, tui_render, tui_wait_for, tui_snapshot, tui_inject) work correctly
- [x] **Remote Mode**: TUI connects to MiniBob daemon via WebSocket
- [x] **Terminal Vessel**: Activities can spawn terminals and display output in TUI
- [x] **Self-Verification**: Activities can verify their own TUI output using TUI tools
- [x] **No Regressions**: Same behavior as local file reference version
- [x] **Production Ready**: Can be published to npm and used by other projects

---

## Next Steps

After verifying all tests pass:

1. **Commit Changes**:
```bash
cd repos/minibob-tui
git add -A
git commit -m "feat(tui): use production @metabob/minibob package

- Changed dependency from file:../minibob to ^0.3.8
- Fixed direct import in src/index.ts to use package export
- Verified all TUI tools work with production package
- Tested embedded and remote modes successfully
- Integrated with terminal vessel for process execution

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

2. **Push to Development Branch**:
```bash
git push origin feat/align-with-minibob-phase2
```

3. **Create Pull Request** to merge into main

4. **Publish MiniBob-TUI** to npm registry once merged:
```bash
cd repos/minibob-tui
npm publish --access public
```

5. **Update Deployment** to use published packages:
```bash
cd repos/deployment
# Update helmfile to use npm-published images instead of local builds
```
