# MiniBob-TUI Testing Flow

Visual guide showing how to test MiniBob-TUI with production package.

---

## Testing Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    START HERE                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
         ┌─────────────────────────┐
         │  Run Demo Script        │
         │  ./scripts/demo-        │
         │  minibob-tui.sh         │
         └─────────┬───────────────┘
                   │
                   ↓
         ┌─────────────────────────┐
         │  ✓ Package installed    │
         │  ✓ Imports work         │
         │  ⚠  API keys needed     │
         └─────────┬───────────────┘
                   │
                   ↓
         ┌─────────────────────────┐
         │  Set ANTHROPIC_API_KEY  │
         │  export ANTHROPIC_      │
         │  API_KEY=sk-ant-...     │
         └─────────┬───────────────┘
                   │
                   ↓
         ┌─────────────────────────┐
         │  Start MiniBob-TUI      │
         │  bun run start          │
         │  --embedded --dev       │
         └─────────┬───────────────┘
                   │
                   ↓
         ┌─────────────────────────┐
         │  Bootstrap Sequence     │
         │  ✓ API key validated    │
         │  ✓ 6 TUI tools loaded   │
         │  ✓ Ready for goals      │
         └─────────┬───────────────┘
                   │
                   ↓
         ┌─────────────────────────┐
         │  Type Test Goal         │
         │  "Run ls -la"           │
         └─────────┬───────────────┘
                   │
                   ↓
         ┌─────────────────────────┐
         │  MiniBob Processes      │
         │  - Finds/creates        │
         │    activity             │
         │  - Executes tasks       │
         │  - Emits impulses       │
         └─────────┬───────────────┘
                   │
                   ↓
         ┌─────────────────────────┐
         │  TUI Renders Regions    │
         │  ┌───────────────────┐  │
         │  │ Activity: ...     │  │
         │  │ Status: Running   │  │
         │  └───────────────────┘  │
         │  ┌───────────────────┐  │
         │  │ Log Stream        │  │
         │  │ drwxr-xr-x ...    │  │
         │  └───────────────────┘  │
         └─────────┬───────────────┘
                   │
                   ↓
         ┌─────────────────────────┐
         │  Verify Output          │
         │  ✓ Regions appeared     │
         │  ✓ Content correct      │
         │  ✓ No errors            │
         └─────────┬───────────────┘
                   │
                   ↓
         ┌─────────────────────────┐
         │  Try Advanced Tests     │
         │  - TUI tools            │
         │  - Self-verification    │
         │  - Terminal vessel      │
         └─────────┬───────────────┘
                   │
                   ↓
         ┌─────────────────────────┐
         │  ✅ TESTING COMPLETE    │
         └─────────────────────────┘
```

---

## Test Scenarios

### Scenario 1: Basic Command Output

**Goal:** "Run ls -la and show me the files"

**Flow:**
```
User Input
    ↓
MiniBob Goal Processor
    ↓
Activity: improvisation
    ├─ Task 1: Execute ls -la (bash tool)
    │   └─ Impulse: log_stream (command output)
    └─ Task 2: Display result (tui_emit tool)
        └─ Impulse: notification (summary)
    ↓
TUI Region Manager
    ├─ Create activity region (priority: 700)
    ├─ Create log stream region (priority: 600)
    └─ Create notification region (priority: 650)
    ↓
Terminal Renderer
    └─ Display regions sorted by priority
```

**Expected Output:**
```
┌─ Activity: improvisation ──────────────────┐
│ Status: Running                             │
│ Task 1/2: Execute ls -la ✓                 │
│ Task 2/2: Display result ⟳                 │
└─────────────────────────────────────────────┘
┌─ Log Stream ────────────────────────────────┐
│ total 48                                    │
│ drwxr-xr-x  12 user  staff   384 Apr  9 ... │
│ -rw-r--r--   1 user  staff  1024 Apr  9 ... │
└─────────────────────────────────────────────┘
┌─ Notification ──────────────────────────────┐
│ Listed 12 files in current directory        │
└─────────────────────────────────────────────┘
```

---

### Scenario 2: TUI Tool Usage

**Goal:** "Use tui_emit to display a success message"

**Flow:**
```
User Input
    ↓
MiniBob Goal Processor
    ↓
Activity: improvisation
    └─ Task 1: Call tui_emit tool
        ├─ Tool: tui_emit
        ├─ Args: { content: "Success!", shape: "success" }
        └─ Impulse: success (created by TUI tool)
    ↓
TUI Tool Handler (in MiniBob-TUI)
    ├─ Receive tui_emit call
    ├─ Create impulse locally
    └─ Emit impulse:created event
    ↓
TUI Region Manager
    └─ Create success region (priority: 700)
    ↓
Terminal Renderer
    └─ Display green-bordered region
```

**Expected Output:**
```
┌─ Activity: improvisation ──────────────────┐
│ Status: Running                             │
│ Task 1/1: Call tui_emit tool ⟳            │
└─────────────────────────────────────────────┘
┌─ Success ───────────────────────────────────┐
│ Success!                                    │
└─────────────────────────────────────────────┘
```

---

### Scenario 3: Self-Verification

**Goal:** "Emit a message and verify it appears using tui_observe"

**Flow:**
```
User Input
    ↓
MiniBob Goal Processor
    ↓
Activity: improvisation
    ├─ Task 1: Baseline snapshot
    │   ├─ Tool: tui_snapshot
    │   └─ Store: initial region count
    ├─ Task 2: Emit message
    │   ├─ Tool: tui_emit
    │   └─ Impulse: notification created
    ├─ Task 3: Wait for region
    │   ├─ Tool: tui_wait_for
    │   └─ Condition: region_appears
    └─ Task 4: Verify
        ├─ Tool: tui_observe (query: regions)
        ├─ Tool: tui_render (format: text)
        └─ Compare: initial vs final state
    ↓
TUI provides responses to each tool call
    ├─ tui_snapshot → { regions: [...], scroll: 0, ... }
    ├─ tui_emit → { success: true, impulseId: "..." }
    ├─ tui_wait_for → { success: true, elapsed: 123 }
    ├─ tui_observe → { regions: [...] }
    └─ tui_render → { content: "..." }
    ↓
LLM verifies
    ├─ Region count increased: ✓
    ├─ Message in regions list: ✓
    ├─ Message in rendered output: ✓
    └─ Emit verification result
```

**Expected Output:**
```
┌─ Activity: improvisation ──────────────────┐
│ Status: Running                             │
│ Task 1/4: Baseline snapshot ✓              │
│ Task 2/4: Emit message ✓                   │
│ Task 3/4: Wait for region ✓                │
│ Task 4/4: Verify ⟳                         │
└─────────────────────────────────────────────┘
┌─ Notification ──────────────────────────────┐
│ Test message                                │
└─────────────────────────────────────────────┘
┌─ Success ───────────────────────────────────┐
│ Verification complete:                      │
│ ✓ Region count increased by 1              │
│ ✓ Message found in regions                 │
│ ✓ Message found in rendered output         │
└─────────────────────────────────────────────┘
```

---

## Component Interaction

### 1. Package Import

```typescript
// src/index.ts (MiniBob-TUI)
import { MiniBob } from "@metabob/minibob";
import { getLogger } from "@metabob/minibob/logger";

// ✓ Production package from npm registry
// ✗ Not local file reference
```

### 2. Embedded MiniBob Initialization

```typescript
// src/lib/embedded-minibob.ts
const minibob = new MiniBob({
  apiKey: config.apiKey,
  workdir: config.workdir,
  // Lifecycle hooks (MiniBob → TUI)
  onActivityStarted: this.handleActivityStarted.bind(this),
  onTaskCompleted: this.handleTaskCompleted.bind(this),
  onActivityCompleted: this.handleActivityCompleted.bind(this),
  // TUI tools (TUI → MiniBob)
  tools: this.toolProvider.getTools()
});
```

### 3. Lifecycle Hook

```typescript
// MiniBob emits event
this.emit('activity:started', { executionId, templateId });

// EmbeddedMiniBob receives event
handleActivityStarted(executionId, templateId) {
  // Create impulse for TUI
  this.tuiState.createImpulse({
    id: `activity:${executionId}`,
    metadata: {
      shape: 'activity',
      display: { preferred: 'expandable', priority: 700 }
    },
    content: { executionId, templateId }
  });
}

// TUI State Manager
createImpulse(impulse) {
  // Create region
  this.regionManager.createRegion(impulse);

  // Emit to renderer
  this.emit('region:created', region);
}

// Terminal Renderer
render() {
  // Sort regions by priority
  const sorted = regions.sort((a, b) => b.priority - a.priority);

  // Create components from impulses
  const components = sorted.map(r => createComponent(r.impulse));

  // Render to terminal
  OpenTUI.render(components);
}
```

### 4. TUI Tool Call

```typescript
// Activity task calls tool
const result = await tui_emit({
  content: "Success!",
  shape: "success",
  priority: 700
});

// TUI Tool Handler (in MiniBob-TUI)
async handleTuiEmit(args) {
  // Create impulse
  const impulse = {
    id: generateId(),
    metadata: {
      shape: args.shape || 'notification',
      display: { priority: args.priority || 600 }
    },
    content: args.content
  };

  // Add to TUI state
  this.tuiState.createImpulse(impulse);

  // Return success
  return { success: true, impulseId: impulse.id };
}
```

---

## Debugging Flow

If something doesn't work:

```
Issue: No regions appearing
    ↓
Check: Bootstrap logs
    ├─ ✓ TUI tools registered?
    ├─ ✓ Lifecycle hooks connected?
    └─ ✓ MiniBob initialized?
    ↓
Check: Activity execution
    ├─ Is activity running?
    ├─ Are tasks completing?
    └─ Are impulses being created?
    ↓
Check: Region creation
    ├─ Are impulses arriving at TUI state?
    ├─ Are regions being created?
    └─ Is renderer being called?
    ↓
Check: Rendering
    ├─ Are components being created?
    ├─ Is OpenTUI rendering?
    └─ Is terminal display updating?
    ↓
Solution: Add debug logging
    ├─ enableDebugLogging()
    ├─ Check console output
    └─ Verify impulse flow
```

---

## Success Indicators

### ✅ Package Installation

```bash
$ ls -la node_modules/@metabob/minibob
# Should be a directory (not symlink)

$ cat node_modules/@metabob/minibob/package.json | grep version
# Should show: "version": "0.3.7" (or newer)
```

### ✅ Bootstrap Sequence

```
[EmbeddedMiniBob] Bootstrap sequence starting...
[EmbeddedMiniBob] ✓ API key configured
[EmbeddedMiniBob] ✓ Activity API reachable
[EmbeddedMiniBob] ✓ 6 TUI tools registered:
  - tui_emit
  - tui_observe
  - tui_render
  - tui_wait_for
  - tui_snapshot
  - tui_inject
[MiniBob-TUI] Ready. Type a goal to begin.
```

### ✅ Region Display

```
┌─ Activity: improvisation ──────────────────┐
│ (Region exists and is visible)             │
└─────────────────────────────────────────────┘
```

### ✅ TUI Tool Responses

```typescript
// Tool call succeeds
const result = await tui_emit({ content: "Test" });
// result: { success: true, impulseId: "impulse-123" }
```

---

## Complete Testing Checklist

- [x] **Package installed from npm** (not symlink)
- [x] **Imports resolve correctly** (no errors)
- [ ] **Type checking passes** (pending MiniBob 0.4.0)
- [ ] **Bootstrap sequence completes** (needs API key)
- [ ] **TUI tools registered** (needs API key)
- [ ] **Activity execution works** (needs API key)
- [ ] **Regions appear in TUI** (needs API key)
- [ ] **TUI tools respond** (needs API key)
- [ ] **Self-verification works** (needs API key)
- [ ] **Remote mode connects** (needs daemon + client)

**Current Status:** 2/10 complete

**Next Step:** Set `ANTHROPIC_API_KEY` and run embedded mode to complete remaining tests.

---

## Quick Commands Reference

```bash
# Demo script (no API key needed)
./scripts/demo-minibob-tui.sh

# Start embedded mode (needs API key)
cd repos/minibob-tui
export ANTHROPIC_API_KEY="sk-ant-..."
bun run start --embedded --dev

# Start remote mode (needs API key)
# Terminal 1:
cd repos/minibob
bun run index.ts --daemon

# Terminal 2:
cd repos/minibob-tui
bun run start --endpoint http://localhost:8080

# Test imports (no API key needed)
cd repos/minibob-tui
cat > /tmp/test.ts <<EOF
import { MiniBob } from "@metabob/minibob";
import { getLogger } from "@metabob/minibob/logger";
console.log("✓ Imports work");
EOF
bun run /tmp/test.ts
```

---

## Documentation References

- Full testing guide: `docs/guides/TESTING_MINIBOB_TUI.md`
- Quick start: `docs/guides/TERMINAL_VESSEL_QUICK_START.md`
- Summary: `docs/guides/MINIBOB_TUI_TESTING_SUMMARY.md`
- Sequence diagrams: `docs/architecture/MINIBOB_TUI_SEQUENCE_DIAGRAMS.md`
- Demo script: `scripts/demo-minibob-tui.sh`
