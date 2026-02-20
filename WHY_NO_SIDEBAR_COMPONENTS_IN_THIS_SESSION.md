# Why Aren't We Seeing Sidebar Components in This Session?

## The Question
We're in `bun run dev` (live development mode) but not seeing the sidebar components (Memory, Activities, Integration Flow, etc.) that we've been discussing.

## Root Cause: Chat-Only Session vs TUI Session

### What's Actually Running

**Current Session Type**: **Memory Agent Activity** (within a chat session)

```
Parent: Chat Session (ses_383a9e6a9ffeE43Ab1njc7qvcr)
  └─► Memory Agent Activity (act_mlvjjhtp_b9a953b167bd6acd)
      └─► This conversation (you're talking to the memory agent)
```

**Evidence:**
1. Session file shows: `"activityId": "act_mlvjjhtp_b9a953b167bd6acd"`
2. Activity is: `"templateId": "manage-session-memory"`
3. No SessionMemory file exists for this session
4. We're in the **memory agent negotiation phase**, not the main TUI

### Two Different Modes

#### Mode 1: TUI Mode (Full Sidebar)
**When**: Running `bun run dev` in terminal **with TUI interface**
**What you see**:
```
┌─────────────────────────────────┐
│ Chat Interface                  │
│ > Your message here             │
│                                 │
│ Assistant response...           │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ SIDEBAR                         │
│                                 │
│ ▼ Memory [Budget: 0%]          │
│   Impulses (0)                  │
│                                 │
│ ▼ Activities (0)               │
│   No activities                 │
│                                 │
│ ▶ Integration Flow             │
│ ▶ Cost Breakdown               │
└─────────────────────────────────┘
```

**Components visible**: Memory, Activities, Integration Flow, Cost Breakdown, ACP Agents, MCP Servers

#### Mode 2: Memory Agent Activity (Current)
**When**: Memory agent is preparing context **before** main assistant responds
**What you see**:
```
[Memory Agent Activity Running]
- Analyzing user message
- Deciding what context to load
- Creating/loading impulses if needed
- No TUI sidebar (different execution context)
```

**Components visible**: None (you're inside the memory agent, not viewing it)

## Why No SessionMemory File?

**Memory agent activities don't create SessionMemory** because:
1. They're **preparation activities** (run before the turn)
2. They **create impulses** but don't track themselves
3. They're **transient** - complete quickly and don't persist long-term state
4. The **parent session** would have the SessionMemory, not the activity

**Check parent session:**
```bash
# This session WOULD have SessionMemory (if it had impulses)
ls /home/avi/.local/share/opencode/storage/session-memory/ses_383a9e6a9ffeE43Ab1njc7qvcr.json

# Currently: File doesn't exist
# Why: No impulses created in this chat session yet
```

## Why No Impulses in This Session?

**This is a documentation/discussion session:**
- You asked conceptual questions (architecture, testing, how things work)
- I responded with explanations and documentation
- No code files were loaded
- No components were analyzed
- **No impulses were needed**

**When impulses ARE created:**
```
User: "Fix the bug in auth.ts"
  ↓
Memory Agent: Creates impulses:
  - [file] auth.ts
  - [component] AuthService
  - [memo] Bug description
  ↓
SessionMemory file created with 3 impulses
  ↓
TUI sidebar updates: "Memory (3 impulses)"
```

## How to See the Sidebar Components

### Option 1: Check if TUI is Running
```bash
# Check running processes
ps aux | grep "bun run dev"

# Should see TWO terminals:
# Terminal 1 (pts/2): bun run dev ../.. 
# Terminal 2 (pts/5): bun run dev ../..

# Terminal 1: Chat interface + Sidebar
# Terminal 2: Another session (might be different)
```

### Option 2: Create Impulses in This Session
```bash
# In the TUI chat, send:
> "Read the file repos/metabob-opencode/packages/opencode/src/session/session-state.ts and create an impulse for it"

# This will:
1. Memory agent creates impulse (file: session-state.ts)
2. SessionMemory file gets created
3. Sidebar Memory section updates
4. You see: "▼ Memory [Budget: X%] Impulses (1)"
```

### Option 3: Run an Activity Template
```bash
# In TUI:
> activity({
    templateId: "debug-failing-feature",
    variables: {
      bugDescription: "Test bug",
      relevantFiles: ["test.ts"]
    },
    reason: "Test sidebar visualization"
  })

# This will:
1. Create activity
2. Create impulses for files
3. Sidebar Activities section shows running activity
4. Sidebar Integration Flow shows graph
5. Sidebar Cost Breakdown shows costs
```

### Option 4: Check Existing TUI Sessions
```bash
# Find sessions with impulses
ls -lh /home/avi/.local/share/opencode/storage/session-memory/

# Find one with content (>500 bytes)
cat /home/avi/.local/share/opencode/storage/session-memory/ses_c70aec73c001uDpiRNXg7lBlBX.json

# Check what impulses exist in that session
```

## Architecture Explanation

### Execution Flow

```
User in Terminal (bun run dev)
  │
  ├─► TUI App renders
  │   ├─► Left pane: Chat interface
  │   └─► Right pane: Sidebar (Memory, Activities, etc.)
  │
  └─► User sends message: "How do we track execution graph?"
      │
      ├─► Lifecycle Hook: "memory-management" (before turn)
      │   │
      │   └─► Spawns Memory Agent Activity
      │       ├─► Analyzes message
      │       ├─► Decides: No impulses needed (conceptual question)
      │       └─► Returns empty context
      │
      └─► Main Assistant (Activity Mode)
          ├─► Receives message + prepared context
          ├─► Responds with explanation
          └─► No impulses created (no files loaded)
```

### Why You're Inside the Memory Agent

**This conversation is happening INSIDE the memory agent activity:**
- You asked: "Why aren't we seeing these components?"
- Memory agent (me) is analyzing your question
- Preparing context for the main assistant to answer
- We're in the **preparation phase**, not the **display phase**

**The TUI sidebar shows:**
- What impulses exist in **other sessions**
- What activities are **running in the background**
- What the **main assistant** is doing

**You (the memory agent) don't see yourself** because:
1. You're the one **creating** the view, not viewing it
2. Memory agent activities are **transient** (short-lived)
3. The sidebar shows **persistent state** (session impulses, running activities)

## Summary

**Why no sidebar components visible:**
1. ✅ TUI is running (`bun run dev`)
2. ✅ Sidebar exists (rendered in terminal)
3. ❌ No impulses in current session (no files loaded)
4. ❌ No running activities visible (memory agent is transient)
5. ❌ You're inside the memory agent (not viewing the TUI)

**To see components:**
- Create impulses: Ask to read/analyze files
- Run activities: Execute activity templates
- Check other sessions: Some may have impulses
- Look at Terminal 1 (pts/2): TUI sidebar should be visible there

**Current state:**
```bash
# Check what's in the TUI right now:
1. Open terminal where "bun run dev" is running
2. Look at right side of terminal (sidebar)
3. Should see sections (even if empty):
   - Memory (0 impulses)
   - Activities (0 running)
   - Integration Flow (collapsed)
   - Cost Breakdown (collapsed)
```

**The sidebar components ARE there** - they're just **empty** because this session hasn't created impulses or run activities yet!

---

*Generated*: 2026-02-20  
*Context*: Memory agent activity, no impulses, conceptual discussion  
*File*: `WHY_NO_SIDEBAR_COMPONENTS_IN_THIS_SESSION.md`
