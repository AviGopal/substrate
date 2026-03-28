# TUI Improvements

## Overview

The microplastic TUI has been enhanced to provide a full-screen, responsive, stateful interface that directly maps to the impulse state space.

## Key Improvements

### 1. Full Terminal Window Rendering

**Before:** TUI rendered content line-by-line with no awareness of terminal height
**After:** Uses full terminal dimensions with `process.stdout.rows` and `process.stdout.columns`

```typescript
// Initialize terminal dimensions
this.termWidth = this.stdout.columns || 80;
this.termHeight = this.stdout.rows || 24;
```

**Benefits:**
- No wasted screen space
- Content fills available area
- Professional full-screen appearance

### 2. Responsive to Terminal Resizes

**Before:** Fixed dimensions, no resize handling
**After:** Listens to resize events and re-renders automatically

```typescript
// Listen for terminal resize events
this.stdout.on("resize", () => {
  this.termWidth = this.stdout.columns || 80;
  this.termHeight = this.stdout.rows || 24;
  if (this.running) {
    this.render();
  }
});
```

**Benefits:**
- Works correctly when terminal is resized
- Adapts to different terminal sizes
- No broken layouts on resize

### 3. Viewport Scrolling for Long Content

**Before:** Content could overflow terminal height
**After:** Auto-scrolls to show latest content with scroll indicator

```typescript
// Apply viewport scrolling if content exceeds screen height
if (allLines.length > availableHeight) {
  const startLine = Math.max(0, allLines.length - availableHeight);
  visibleLines = allLines.slice(startLine, startLine + availableHeight);
  this.scrollOffset = startLine;
}

// Add scroll indicator
if (this.scrollOffset > 0) {
  const scrollInfo = ` ↑ ${this.scrollOffset} lines above`;
  this.stdout.write(`\n${scrollInfo}`);
}
```

**Benefits:**
- Never lose content
- Always see latest execution state
- Clear indication when content is scrolled

### 4. Stateful Impulse-to-Region Mapping

**Before:** Potential for duplicate regions for the same impulse
**After:** 1:1 mapping between impulses and regions

```typescript
// Map impulse IDs to region IDs for stateful updates
private impulseToRegion = new Map<string, string>();

// Get or create region ensures same impulse updates same region
getOrCreateRegionForImpulse(impulseId, shape, content, summary)
```

**Benefits:**
- No duplicate information
- Updates modify regions in place
- Clear state progression (loading → streaming → complete)

### 5. Full-Screen Clear Strategy

**Before:** Line-by-line clearing with ANSI escape codes
**After:** Full-screen clear with cursor positioning

```typescript
// Clear screen and move to top
this.stdout.write("\x1b[2J"); // Clear entire screen
this.stdout.write("\x1b[H");  // Move cursor to home
```

**Benefits:**
- No flicker or artifacts
- Cleaner rendering
- Better performance

## Architecture

### Region-Based Display

The TUI uses a region-based architecture where each impulse maps to a displayable region:

```
Impulse (data) → Region (display) → Render (terminal)
```

**Region States:**
- `loading` - Initial state when region is created
- `streaming` - Actively receiving updates
- `complete` - Finished, can be collapsed
- `collapsed` - Minimized to save space

**Region Shapes:**
- `input` - User goal input (priority 1000)
- `activity` - Activity execution progress (priority 700)
- `tool_call` - Tool execution (priority 600)
- `summary` - Completion summary (priority 500)
- `error` - Error display (priority 750)
- `impulse` - Output impulse (priority 500)

### Priority-Based Layout

Regions are sorted by priority for display:

```typescript
export const REGION_PRIORITY = {
  USER_INPUT: 1000,      // Top: always visible
  SYSTEM_REQUEST: 900,
  ERROR: 750,            // Errors prominently displayed
  ACTIVE_OUTPUT: 700,    // Running activities
  TOOL_CALL: 600,        // Tool execution details
  COMPLETED_OUTPUT: 500, // Completed work
  COLLAPSED: 100,        // Minimized regions
  BACKGROUND: 0,
};
```

## Usage

### Basic Usage

```typescript
import { RegionRenderer, RegionManager } from "./tui/index.ts";
import { ImpulseStore } from "./impulse/index.ts";

// Create shared state
const impulseStore = new ImpulseStore();
const regionManager = new RegionManager();

// Create renderer
const renderer = new RegionRenderer(regionManager, {
  mode: process.stdout.isTTY ? "ansi" : "text",
});

// Start rendering
renderer.start();

// Create regions as impulses arrive
impulseStore.subscribe((event) => {
  if (event.type === "create") {
    regionManager.add({
      id: event.impulse.id,
      shape: mapImpulseShapeToRegionShape(event.impulse.shape),
      content: { /* shape-specific data */ },
    });
  }
});
```

### Responsive Rendering

The renderer automatically:
1. Detects terminal dimensions on start
2. Listens for resize events
3. Re-renders when dimensions change
4. Scrolls viewport for long content
5. Shows scroll indicators

No additional configuration needed!

## Testing

### Manual Testing

```bash
# Run microplastic with full TUI
bun run src/index.ts "your goal here"

# Try resizing terminal - TUI adapts
# Try long-running tasks - viewport scrolls

# Test in non-TTY mode (append-only)
bun run src/index.ts "test" > output.txt
```

### Automated Testing

```bash
# Test region state management
bun test src/tui/state.test.ts

# Test narrative rendering
bun test tests/tui/narrative.test.ts
```

## Implementation Files

### Modified Files

- `src/tui/renderer.ts` - Full-screen rendering, resize handling, viewport scrolling
- `src/tui/execution-bridge.ts` - Impulse-to-region mapping, stateful updates
- `src/index.ts` - ImpulseStore integration

### Architecture Files

- `src/tui/regions.ts` - RegionManager (stateful region lifecycle)
- `src/tui/components.ts` - Region rendering components
- `src/tui/state.ts` - TUI state management
- `src/impulse/store.ts` - ImpulseStateSpace with subscriptions

## Benefits Summary

1. **Full Terminal Usage** - No wasted space, professional appearance
2. **Responsive** - Adapts to terminal resizes automatically
3. **Stateful** - No duplicate information, regions update in place
4. **Scrollable** - Long content handled gracefully with indicators
5. **Impulse-Driven** - Direct mapping to impulse state space
6. **Priority-Based** - Important information always visible
7. **No Flicker** - Clean full-screen rendering

## Future Enhancements

- [ ] Mouse support for region interaction
- [ ] Keyboard shortcuts for scrolling
- [ ] Region collapsing/expanding with hotkeys
- [ ] Search/filter regions
- [ ] Split-pane views for multiple activities
- [ ] Export region history to file
