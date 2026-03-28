# Activity System Data Flow - Quick Reference

**One-Page Guide: How Data Flows From User Intent to Learning Loop**

---

## The 6 Core Questions - Answered in 30 Seconds

| Question | Answer | File:Line |
|----------|--------|-----------|
| **1. How attach task history to components?** | `metabob_annotate_component` MCP tool | `activity-complete.ts:146-150` |
| **2. How scan using activity system?** | Turn lifecycle hooks inject Metabob impulses | `turn-lifecycle-hooks.ts:332-516` |
| **3. How feed info back via impulses?** | Post-turn hook annotates loaded components | `turn-lifecycle-hooks.ts:856-923` |
| **4. What is data custody?** | OpenCode (session/impulses), Backend (annotations/outcomes) | See Custody Chain below |
| **5. How does activity system interact?** | Activity start/complete/turn triggers annotations | `activity-complete.ts:1-150` |
| **6. How collect session info?** | `SessionContext` tracks file modifications in-memory | `context.ts:128-191` |

---

## Data Custody Chain (11 Phases)

```
1. User Prompt → Intent Analysis (OpenCode memory, turn-scoped)
2. Intent → Impulse Creation (OpenCode SQLite, persistent)
3. Impulse → Loading Decision (Memory Manager, budget-aware)
4. Load → MCP Call (HTTP to metabob-rpc-api:3000)
5. MCP → Backend Query (SurrealDB: issues, annotations, CPG)
6. Backend → Impulse Content (Loaded into memory, tokenCount set)
7. Content → Agent Context (<session_memory> in system prompt)
8. Agent → Code Execution (SessionContext tracks modifications)
9. Activity Complete → Component Annotation (MCP: annotate_component)
10. Annotation → Outcome Recording (MCP: record_activity_outcome)
11. Post-Turn → Usage Annotation (MCP: annotate loaded components)
→ LOOP: Future sessions receive historical context
```

---

## 3 Custodians of Data

### OpenCode (Local)
**In-Memory** (cleared on restart):
- `SessionContext.modifiedFiles` - File modifications per session
- `SessionContext.recentFiles` - Recently accessed files
- Impulse resolution cache - Turn-scoped content

**SQLite** (`~/.local/share/opencode/{projectId}/opencode.db`):
- Impulse metadata (id, pointer, budget, priority)
- Session records (id, created, updated)
- Activity execution logs (not synced to backend)

### Metabob Backend (Distributed)
**SurrealDB** (metabob-rpc-api:3000):
- Component annotations (history of WHY/HOW components changed/used)
- Activity outcomes (learning data for Thompson Sampling)
- CPG graph (component dependencies + structure)
- Cochange embeddings (768-dim vectors for prediction)
- Issues (security, performance, bugs)

### Agent Context (Per-Turn)
**System Prompt** (`<session_memory>` section):
- Loaded impulse content (max 50K tokens budget)
- Priority issues from Metabob (max 5, MEDIUM+)
- Component annotations (historical context)
- Impact warnings (dependency analysis)

---

## Turn Lifecycle Hook Order

| Priority | Hook Name | Purpose | Duration |
|----------|-----------|---------|----------|
| 5 | activity-decision-reminder | Add "check activities" reminder | <10ms |
| 10 | session-memory-preparation | LLM intent analysis + impulse suggestions | 1-3s |
| 15 | activity-recommendation-injection | Search + inject activity templates | 100-200ms |
| **20** | **metabob-context-preparation** ⭐ | **Create 5 Metabob impulse types** | **50-100ms** |
| 25 | boredom-task-suggestion | Suggest improvement tasks when idle | 50-100ms |
| **MAIN AGENT TURN** | **Agent execution** | **Agent receives context, executes task** | **Varies** |
| 100 | post-turn-cleanup | Unload low-priority impulses if >80% | <50ms |
| **110** | **session-memory-optimization** ⭐ | **Annotate loaded components** | **100-500ms** |

**⭐ Key Phases**: Hook 20 (context injection), Hook 110 (usage annotation)

---

## 5 Impulse Types Created Every Turn

| ID | Priority | Budget | Source | Purpose |
|----|----------|--------|--------|---------|
| `metabob-priorities-{ulid}` | high | 2000 | `getPriorityIssues()` | Critical issues in work area |
| `metabob-annotations-{ulid}` | medium | 1500 | `listFileComponents()` | Historical component context |
| `metabob-impact-{ulid}` | high | 1000 | `analyzeChangeImpact()` | Dependency blast radius |
| `metabob-related-{ulid}` | medium | 800 | `suggestRelatedChanges()` | Co-change patterns |
| `metabob-recommendations-{ulid}` | low | 1200 | (future) | Activity suggestions |

**Total Budget per Turn**: ~6,500 tokens (13% of 50K default budget)

---

## 3 Types of Component Annotations

### 1. Activity Annotations (WHY)
- **Source**: Activity complete hook (`activity-complete.ts:146-150`)
- **Content**: Design decisions, alternatives, constraints
- **Example**: "ACTIVITY: Fixed SQL injection using parameterized queries. Chose this over ORM for performance."

### 2. Session Memory Annotations (HOW)
- **Source**: Post-turn optimization hook (`turn-lifecycle-hooks.ts:856-923`)
- **Content**: Load reason, priority, task context, turn number
- **Example**: "SESSION MEMORY: Loaded 1500 tokens, Priority: high, Task: Fix SQL injection"

### 3. Manual Annotations (DOMAIN)
- **Source**: Developer via CLI (`opencode metabob annotate`)
- **Content**: Architecture notes, gotchas, requirements
- **Example**: "ARCHITECTURE: authenticate() is entry point. DO NOT modify signature."

---

## Key File References

| Component | File | Key Lines |
|-----------|------|-----------|
| **Session Context** | `repos/.../src/session/context.ts` | 128-157 (trackFileModification)<br>159-191 (getModifiedFiles) |
| **Turn Hooks** | `repos/.../src/session/turn-lifecycle-hooks.ts` | 332-516 (metabob prep)<br>856-923 (usage annotation) |
| **Memory Agent** | `repos/.../src/session/memory-agent.ts` | 97-500 (analyzeIntent) |
| **Activity Complete** | `repos/.../src/session/activity-complete.ts` | 50-100 (identifyKeyComponents)<br>146-150 (annotate) |
| **Outcome Recording** | `repos/.../src/session/activity-outcome-recorder.ts` | 43-89 (ActivityOutcome type)<br>300-400 (recordOutcome) |
| **MCP Integration** | `repos/.../src/util/metabob.ts` | 100-150 (getPriorityIssues)<br>200-250 (annotateComponent) |
| **MCP Transport** | `repos/.../src/mcp/index.ts` | 245-263 (SSE/HTTP transport) |

---

## Example: Single Component's Journey

### Turn 1: Fix SQL Injection
```
User: "Fix SQL injection in auth.ts"

1. Intent Analysis → "code_fix", high confidence
2. Impulse Creation → metabob-priorities impulse created
3. Impulse Loading → getPriorityIssues() → "1 HIGH: SQL injection auth.ts:42"
4. Agent Receives → <session_memory> shows priority issue
5. Agent Fixes → Uses parameterized queries
6. SessionContext Tracks → modifiedFiles.set("auth.ts", {type: "write"})
7. Activity Complete → Annotate: "ACTIVITY: Fixed SQL injection..."
8. Outcome Recording → Records: expectation vs reality, decisions
9. Post-Turn → Annotate: "SESSION MEMORY: Loaded auth.ts for SQL fix"

STORED: 2 annotations in Metabob backend SurrealDB
```

### Turn 2: Add Rate Limiting (Days Later)
```
User: "Add rate limiting to auth"

1. Impulse Creation → metabob-annotations impulse created
2. Impulse Loading → listFileComponents("auth.ts") 
   → Returns: 2 historical annotations
3. Agent Receives → <session_memory> shows:
   - Previous SQL injection fix
   - Design decisions, constraints
4. Agent Adds → Rate limiting WITHOUT breaking security fix
5. Activity Complete → Annotate: "ACTIVITY: Added rate limiting..."

RESULT: Agent preserves past work, builds on historical context
```

---

## Performance Characteristics

| Operation | Latency | Notes |
|-----------|---------|-------|
| SessionContext.trackFileModification | <1ms | In-memory Map operation |
| SessionContext.getModifiedFiles | <5ms | Filter + sort Map entries |
| Impulse creation (metadata) | 5-10ms | SQLite insert |
| Impulse loading (MCP call) | 100-200ms | Network + backend query |
| Component annotation | 50-150ms | Async, non-blocking |
| Outcome recording | 200-500ms | Background submission |
| **Total per turn (hooks)** | **1-4s** | Mostly LLM intent analysis |

---

## Configuration

### OpenCode Config (`~/.config/opencode/config.json`)
```json
{
  "sessionMemory": {
    "enabled": true,
    "defaultBudget": 50000,
    "utilizationThreshold": 0.85
  },
  "metabob": {
    "enabled": true,
    "auto_inject": true,
    "inject_annotations": true,
    "auto_impact_analysis": true,
    "max_issues": 5,
    "min_severity": "MEDIUM"
  }
}
```

### MCP Config (`~/.config/opencode/mcp.json`)
```json
{
  "clients": {
    "metabob": {
      "type": "remote",
      "url": "http://metabob-rpc-api:3000/mcp",
      "enabled": true,
      "transport": "sse"
    }
  }
}
```

---

## Monitoring Commands

```bash
# Check session memory stats
opencode session state <sessionID>

# List component annotations
opencode metabob list-annotations --file src/auth.ts

# Check impulse state
opencode impulse list <sessionID>

# View MCP connection status
opencode mcp status

# Check session context (modified files)
# (API only - no CLI command yet)
```

---

## Troubleshooting

| Symptom | Check | Fix |
|---------|-------|-----|
| No Metabob context in agent | MCP connected? | `opencode mcp enable metabob` |
| Impulses not loading | Budget available? | Increase budget or unload stale |
| Annotations not persisting | Backend reachable? | Check backend health, restart |
| Session context empty | File ops tracked? | Ensure write tool calls `trackFileModification` |

---

## The Learning Loop (Automatic)

```
Every Session Contributes to Institutional Knowledge:

1. Component modified → Annotation created (WHY changed)
2. Impulse loaded → Usage annotation created (HOW used)
3. Activity completes → Outcome recorded (expectations vs reality)
4. Backend stores → Annotations + outcomes + CPG updated
5. Future sessions → Historical context automatically available

RESULT: System learns from every interaction, no manual effort required.
```

---

## Key Innovation

**Automatic Component Usage Tracking** (lines 856-923 in `turn-lifecycle-hooks.ts`)

Every time an impulse is loaded:
- Post-turn hook annotates the component with context
- Captures: turn number, task, priority, load reason
- Stores in backend for future retrieval
- **Zero human effort** - fully automatic

This creates a living history of how components are used across sessions, enabling:
- Better priority scoring (frequently used = higher priority)
- Relevance ranking (used for similar tasks = more relevant)
- Usage pattern analysis (when/why components accessed)

---

## Summary: 3-2-1

**3 Custodians**:
1. OpenCode (session/impulse lifecycle)
2. Metabob Backend (annotations/outcomes/CPG)
3. Agent Context (loaded content per turn)

**2 Key Hooks**:
1. metabob-context-preparation (priority 20) - Inject context
2. session-memory-optimization (priority 110) - Annotate usage

**1 Learning Loop**:
- Every interaction → annotations → outcomes → historical context → better decisions

**Result**: Closed-loop system that gets smarter over time, automatically.

---

## Related Documentation

- **Detailed Flow**: `ACTIVITY_SYSTEM_DATA_CUSTODY_CHAIN.md` (complete 11-phase breakdown)
- **Visual Architecture**: `ACTIVITY_DATA_FLOW_VISUAL.md` (diagrams + maps)
- **Cochange Integration**: `COCHANGE_INTEGRATION_VERIFIED.md` (6 layers verified)
- **Session Summary**: Previous session notes (context for this analysis)

---

**Last Updated**: 2025-02-14  
**Session**: Data custody chain analysis  
**Status**: ✅ Complete - All 6 questions answered with file:line references
