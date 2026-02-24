# TUI Testing and Snapshot Capture

## Current State

### TUI Framework
**OpenTUI + Solid.js**
- Framework: `@opentui/core` + `@opentui/solid`
- Component framework: Solid.js (reactive)
- Rendering: Terminal-based (ANSI escape codes)

### Existing Tests

#### 1. Unit Tests (`test/cli/tui-sidebar.test.ts` - 850 lines)
**What's tested:**
- Helper functions (formatProgressBar, formatElapsedTime)
- Data structure validation (SessionState mocks)
- Section visibility logic
- Priority color mapping
- Token formatting

**Example tests:**
```typescript
describe("formatProgressBar", () => {
  it("should render half-filled bar for 50%", () => {
    const result = formatProgressBar(50, 20)
    expect(result).toBe("█".repeat(10) + "░".repeat(10))
    expect(result.length).toBe(20)
  })
})

describe("formatElapsedTime", () => {
  it("should format minutes and seconds", () => {
    expect(formatElapsedTime(90000)).toBe("1m 30s")
  })
})
```

#### 2. Integration Tests
**Files:**
- `test/cli/tui-sidebar-phase2.test.ts` - Phase 2 enhancements
- `test/integration/event-driven-sidebar.test.ts` - SSE event handling

#### 3. Activity Template (`templates/opencode-dev/test-tui-sidebar-rendering.json`)
**End-to-end test template:**
- Creates test session with diverse state
- Verifies impulse display
- Verifies context window calculations
- Verifies metadata accuracy
- Stress tests polling (10 calls, 500ms interval)
- Generates test report

## Current Limitations

### ❌ No Visual Snapshot Testing
**What's missing:**
- Terminal output capture
- Visual regression testing
- ANSI rendering snapshots
- Screenshot comparison

**Why:**
- OpenTUI doesn't have built-in snapshot support
- Terminal rendering is ephemeral (no DOM)
- Complex to capture ANSI escape sequences
- No standard snapshot format for TUI

### ✅ What Works
- Logic testing (helper functions)
- Data structure validation
- API endpoint testing (SessionState)
- Event handling tests (SSE)
- Stress/performance testing

## How TUI is Rendered

### Architecture

```
User Terminal
    ↓
OpenCode CLI (bun run dev)
    ↓
TUI App (app.tsx)
    ↓
OpenTUI Renderer
    ↓
Solid.js Components (sidebar.tsx, etc.)
    ↓
ANSI Escape Sequences
    ↓
Terminal Display (cursor positioning, colors, text)
```

### Rendering Process

**1. Component Tree:**
```tsx
<Sidebar sessionID={...}>
  <box>
    <text>▼ Memory [Budget: 80%]</text>
    <For each={impulses}>
      {(impulse) => (
        <text>✓ [file] {impulse.path} {impulse.budget} tokens</text>
      )}
    </For>
  </box>
</Sidebar>
```

**2. OpenTUI Renderer:**
- Converts JSX → Virtual DOM
- Calculates layout (flexbox-like)
- Generates ANSI codes for positioning
- Applies colors/styles (theme)
- Updates only changed regions (diffing)

**3. Terminal Output:**
```
ESC[1;1H           # Move cursor to row 1, col 1
ESC[32m▼ Memory    # Green color + text
ESC[37m[Budget...  # White color + text
ESC[2;3H           # Move cursor to row 2, col 3
✓ [file] auth.ts   # Checkmark + text
```

### Update Cycle

**Real-time updates:**
1. Server sends SSE event (impulse added)
2. Solid.js reactive signal updates (`impulses()`)
3. Component re-renders (only changed parts)
4. OpenTUI diffs virtual DOM
5. Terminal updates (minimal ANSI codes)

**Polling updates:**
1. Every 2.5s: fetch SessionState
2. Signal updates trigger re-render
3. Sidebar sections refresh

## Snapshot Capture Options

### Option 1: Terminal Recording (Recommended)
**Use `asciinema` or `terminalizer`**

```bash
# Install
npm install -g asciinema

# Record TUI session
asciinema rec tui-snapshot-$(date +%s).cast

# In TUI:
# - Create impulses
# - Run activities
# - Expand sections
# - Wait for state to populate

# Stop: Ctrl+D

# Play back
asciinema play tui-snapshot-*.cast

# Convert to GIF for documentation
agg tui-snapshot-*.cast tui-snapshot.gif
```

**Pros:**
- ✅ Captures actual terminal output
- ✅ Includes colors, animations, interactions
- ✅ Playback for validation
- ✅ Convert to GIF/video for docs

**Cons:**
- ❌ Manual process (not automated)
- ❌ No programmatic comparison
- ❌ Large file sizes

### Option 2: ANSI String Capture (Automated)
**Capture OpenTUI output programmatically**

```typescript
// test/cli/tui-snapshot.test.ts
import { render } from "@opentui/solid"
import { Sidebar } from "../../src/cli/cmd/tui/routes/session/sidebar"

describe("TUI Snapshot Tests", () => {
  it("should render sidebar with impulses", async () => {
    // Mock data
    const mockSessionState = {
      impulses: {
        impulses: [
          { id: "imp1", type: "file", path: "auth.ts", budget: 1000 }
        ],
        totalBudget: 10000,
        usedTokens: 1000,
        utilization: 10
      }
    }

    // Render to string (ANSI)
    const output = render(<Sidebar sessionID="test-session" />)
    
    // Snapshot comparison
    expect(output).toMatchSnapshot()
    
    // OR: Strip ANSI for text-only comparison
    const text = stripAnsi(output)
    expect(text).toContain("▼ Memory")
    expect(text).toContain("auth.ts")
    expect(text).toContain("1000 tokens")
  })
})
```

**Pros:**
- ✅ Automated testing
- ✅ CI/CD integration
- ✅ Regression detection
- ✅ Fast execution

**Cons:**
- ❌ Requires OpenTUI render-to-string support
- ❌ May not capture all visual aspects
- ❌ Complex ANSI snapshot diffs

### Option 3: Text-Based Validation (Current Approach)
**Test rendering logic without visual comparison**

```typescript
describe("TUI Rendering Logic", () => {
  it("should format impulse display correctly", () => {
    const impulse = {
      id: "test",
      type: "file",
      path: "auth.ts",
      budget: 1000,
      loaded: true
    }
    
    const display = formatImpulseDisplay(impulse)
    expect(display).toBe("✓ [file] auth.ts 1.0K tokens")
  })

  it("should render progress bar correctly", () => {
    const bar = formatProgressBar(60, 20)
    expect(bar).toBe("█".repeat(12) + "░".repeat(8))
  })
})
```

**Pros:**
- ✅ Already implemented
- ✅ Fast and reliable
- ✅ Easy to debug
- ✅ No dependencies

**Cons:**
- ❌ Doesn't test full rendering
- ❌ Misses layout issues
- ❌ Misses color/styling bugs

### Option 4: Screenshot via Puppeteer + xterm.js (Complex)
**Render TUI in browser terminal emulator**

```typescript
// test/e2e/tui-screenshot.test.ts
import puppeteer from "puppeteer"

describe("TUI Visual Tests", () => {
  it("should render sidebar correctly", async () => {
    const browser = await puppeteer.launch()
    const page = await browser.newPage()
    
    // Load xterm.js + OpenTUI output
    await page.goto("http://localhost:test-tui")
    
    // Wait for render
    await page.waitForSelector(".xterm-screen")
    
    // Screenshot
    await page.screenshot({ path: "tui-sidebar.png" })
    
    // Compare with baseline (visual regression)
    await expect(page).toMatchImageSnapshot()
  })
})
```

**Pros:**
- ✅ True visual testing
- ✅ Screenshot comparison
- ✅ CI/CD friendly
- ✅ Regression detection

**Cons:**
- ❌ Very complex setup
- ❌ Requires xterm.js integration
- ❌ Slow execution
- ❌ Not native terminal rendering

## Recommendation for Dual-Write Verification

### Quick Validation (5 min)
**Manual TUI inspection:**
```bash
cd repos/metabob-opencode && bun run dev

# Check sidebar sections:
1. Memory - Should show impulse count
2. Activities - Should show running activities
3. Integration Flow - Expand to see graph
4. Cost Breakdown - Expand to see costs

# Create test impulses:
> "Create 3 impulses for testing: auth.ts (file), UserValidator (component), API Design (memo)"

# Verify:
- Memory section updates
- Impulse count increases
- Budget utilization shown
- Load/unload status visible
```

### Automated Testing (15 min)
**Run existing test suite:**
```bash
cd repos/metabob-opencode

# Run TUI tests
bun test test/cli/tui-sidebar.test.ts

# Run integration tests
bun test test/integration/event-driven-sidebar.test.ts

# Run end-to-end template (creates test report)
bun run activity({
  templateId: "test-tui-sidebar-rendering",
  variables: {},
  reason: "Validate TUI rendering for dual-write implementation"
})
```

### Terminal Recording (10 min)
**Capture visual proof:**
```bash
# Install asciinema
npm install -g asciinema

# Start recording
asciinema rec validation-dual-write-tui.cast

# In TUI:
1. Start OpenCode: bun run dev
2. Create impulses
3. Check Memory section
4. Expand Integration Flow
5. Expand Cost Breakdown
6. Run an activity
7. Watch real-time updates

# Stop: Ctrl+D

# Play back to verify
asciinema play validation-dual-write-tui.cast

# Upload to asciinema.org for sharing (optional)
asciinema upload validation-dual-write-tui.cast
```

## Existing Test Coverage

### ✅ Covered
- Helper function logic (progress bars, time formatting)
- SessionState schema validation
- API endpoint responses
- Event-driven updates (SSE)
- Polling performance
- Data structure correctness

### ⚠️ Partially Covered
- Component rendering (logic tested, not visuals)
- Section expand/collapse (logic tested, not interaction)
- Color theming (schema defined, not visually tested)

### ❌ Not Covered
- Visual regression (no baseline screenshots)
- Layout correctness (positioning, alignment)
- Color rendering (ANSI codes applied correctly)
- Interactive behavior (mouse clicks, key presses)
- Terminal resize behavior

## Proposed: TUI Snapshot Testing

### Implementation Plan (2-3 hours)

**1. Add ANSI Capture Utility:**
```typescript
// test/util/tui-capture.ts
export function captureOutput(component: JSX.Element): string {
  // Render component to ANSI string
  const output = render(component)
  return output
}

export function stripAnsi(ansiString: string): string {
  // Remove ANSI codes for text-only comparison
  return ansiString.replace(/\x1b\[[0-9;]*m/g, "")
}
```

**2. Create Snapshot Tests:**
```typescript
// test/cli/tui-sidebar-snapshot.test.ts
describe("TUI Sidebar Visual Regression", () => {
  it("should render Memory section with impulses", () => {
    const output = captureOutput(<MemorySection ... />)
    expect(stripAnsi(output)).toMatchSnapshot()
  })

  it("should render Integration Flow graph", () => {
    const output = captureOutput(<IntegrationFlow ... />)
    expect(stripAnsi(output)).toMatchSnapshot()
  })
})
```

**3. Add to CI/CD:**
```yaml
# .github/workflows/test.yml
- name: TUI Snapshot Tests
  run: bun test test/cli/tui-sidebar-snapshot.test.ts
  
- name: Upload Snapshots
  if: failure()
  uses: actions/upload-artifact@v3
  with:
    name: tui-snapshots
    path: test/cli/__snapshots__/
```

## Summary

**Question**: How can we capture TUI snapshots for validation?

**Answer**:

### Current Capabilities ✅
1. **Unit tests** - Helper functions, data structures (850 lines)
2. **Integration tests** - API endpoints, SSE events
3. **E2E template** - Full sidebar validation activity

### Snapshot Options:

**For dual-write verification (NOW):**
- ✅ **Option 1: Manual inspection** (5 min) - Look at TUI sidebar
- ✅ **Option 3: Run existing tests** (15 min) - Logic validation

**For visual proof (OPTIONAL):**
- ✅ **Option 1: asciinema recording** (10 min) - Terminal recording

**For future (LATER):**
- ⚠️ **Option 2: ANSI capture** (2-3 hours) - Automated snapshots
- ❌ **Option 4: Browser screenshots** (1-2 days) - Complex, not worth it

### Recommended Action:
**Run the existing test template** + **Manual TUI inspection**:
```bash
# 1. Run tests
bun test test/cli/tui-sidebar.test.ts

# 2. Start TUI
bun run dev

# 3. Verify sections show impulses
- Check Memory section
- Expand Integration Flow
- Confirm dual-write worked
```

**Already have comprehensive testing** - just not visual snapshots. For dual-write verification, existing tests + manual check is sufficient!

---

*Generated*: 2026-02-20  
*File*: `TUI_TESTING_AND_SNAPSHOT_CAPTURE.md`  
*Complete guide to TUI testing, rendering, and validation*
