# Session Memory Loading Strategy

## The Critical Question: When to Load Session Data?

Based on code analysis, here's the complete strategy for deciding when session memory is needed:

## 🎯 Access Pattern Analysis

### 1. **ACTIVE SESSION (Always Loaded)**
**When**: User is actively chatting in a session
**What to Load**: Current session messages + recent history
**How Much**: Last 20-100 messages (configurable)
**Priority**: HIGH - immediate loading

**Code Paths**:
- `session-state.ts:449` - Recent messages (limit: 20)
- `session-state.ts:629` - All messages for prompt
- `prompt.ts:110` - Message history for LLM context

**Decision**: **ALWAYS LOAD** - This is the hot path

### 2. **BACKGROUND SESSIONS (Lazy Load on Access)**
**When**: Session list display, statistics, exports
**What to Load**: Session metadata only (not messages)
**How Much**: Session info (title, timestamps, summary)
**Priority**: LOW - defer until accessed

**Code Paths**:
- `server.ts:319` - List all sessions (UI display)
- `stats.ts:137` - Statistics calculation
- `export.ts:30` - Export operations

**Decision**: **LAZY LOAD** - Load on first access

### 3. **HISTORICAL MESSAGES (Never Load Eagerly)**
**When**: User explicitly requests old session
**What to Load**: That specific session's messages
**How Much**: Requested session only
**Priority**: MEDIUM - load on demand

**Code Paths**:
- User clicks on old session in UI
- Search/filter operations
- Session comparison

**Decision**: **ON-DEMAND LOAD** - Only when explicitly accessed

## 📊 Loading Decision Matrix

| Scenario | Load Strategy | Budget | Priority |
|----------|--------------|--------|----------|
| **Current active session** | Eager | 50K tokens | HIGH |
| **Recent sessions (last 10)** | Metadata only | 5K tokens | MEDIUM |
| **Historical sessions** | Never (until accessed) | 0 tokens | LOW |
| **Session list/UI** | Metadata only | 1K tokens | LOW |
| **Statistics/exports** | Stream/lazy load | Variable | LOW |
| **Search results** | Load on click | 10K tokens | MEDIUM |

## 🔄 Session Lifecycle States

### State 1: **NOT_LOADED** (Default for historical data)
```typescript
{
  loaded: false,
  content: undefined,
  metadata: { id, title, timestamp } // Only basic info
}
```
**Memory**: ~100 bytes per session
**Use Case**: Session list display, navigation

### State 2: **METADATA_LOADED** (For session lists)
```typescript
{
  loaded: false,  // Content not loaded
  content: undefined,
  metadata: { 
    id, title, timestamp,
    messageCount, summary, diff stats
  }
}
```
**Memory**: ~1 KB per session
**Use Case**: Session browser, statistics

### State 3: **FULLY_LOADED** (Active sessions only)
```typescript
{
  loaded: true,
  content: "full message history...",
  tokenCount: 45000
}
```
**Memory**: ~5 MB per session (with messages)
**Use Case**: Active conversation, context building

## 🎛️ Loading Triggers

### Automatic Loading (System-Initiated)

#### 1. **Session Activation**
```typescript
// When user opens/switches to a session
async function activateSession(sessionID: string) {
  // Load current session messages
  await loadActiveSessionMessages(sessionID, {
    limit: 100,        // Last 100 messages
    priority: "high",
    budget: 50000      // 50K token budget
  })
  
  // Unload previous active session
  await unloadInactiveSessions(exceptSessionID: sessionID)
}
```

#### 2. **Prompt Building**
```typescript
// When building LLM prompt
async function buildPrompt(sessionID: string) {
  // Only load messages needed for context window
  const messages = await loadMessagesForPrompt(sessionID, {
    strategy: "recent-first",  // Start with most recent
    maxTokens: 100000,         // Claude's context window
    includeSystem: true
  })
  
  // Use impulse system to track what's loaded
  return convertToLLMFormat(messages)
}
```

#### 3. **Memory Pressure Response**
```typescript
// When memory usage exceeds threshold
async function handleMemoryPressure() {
  const usage = process.memoryUsage()
  
  if (usage.rss > 2GB) {
    // Unload oldest inactive sessions
    await unloadLRUSessions({
      keepActive: true,
      keepRecent: 5,
      targetReduction: "50%" // Free 50% of session memory
    })
  }
}
```

### Manual Loading (User-Initiated)

#### 1. **Session Click (UI)**
```typescript
// When user clicks on session in list
async function openSession(sessionID: string) {
  // Check if already loaded
  const impulse = await SessionMemory.getImpulse(sessionID, `session-${sessionID}`)
  
  if (!impulse.loaded) {
    // Load on-demand
    await SessionMemory.updateImpulse(sessionID, `session-${sessionID}`, {
      loaded: true,
      priority: "high"
    })
  }
  
  // Return session data
  return await getSessionData(sessionID)
}
```

#### 2. **Search/Filter**
```typescript
// When user searches sessions
async function searchSessions(query: string) {
  // Search metadata only (no loading)
  const results = await searchSessionMetadata(query)
  
  // Return impulses (not loaded)
  return results.map(session => ({
    impulse: createSessionImpulse(session.id),
    metadata: session.metadata
  }))
}
```

#### 3. **Export/Statistics**
```typescript
// When user exports or calculates stats
async function calculateStats() {
  // Stream through sessions without loading all
  let totalMessages = 0
  
  for await (const sessionImpulse of listSessionsAsImpulses()) {
    // Only load metadata
    const metadata = await getSessionMetadata(sessionImpulse.sessionID)
    totalMessages += metadata.messageCount
    
    // DON'T load actual messages
  }
  
  return { totalSessions, totalMessages }
}
```

## 🎯 Smart Loading Heuristics

### 1. **Recency-Based**
```typescript
const config = {
  // Load last N sessions automatically
  autoLoadRecentSessions: 3,
  
  // Load sessions accessed in last N hours
  autoLoadRecentlyAccessedHours: 24,
  
  // Never auto-load sessions older than N days
  neverAutoLoadOlderThanDays: 30
}
```

### 2. **Usage-Based (LRU)**
```typescript
const sessionAccessTracker = new Map<string, {
  lastAccess: number,
  accessCount: number,
  keepInMemory: boolean
}>()

function shouldLoadSession(sessionID: string): boolean {
  const stats = sessionAccessTracker.get(sessionID)
  
  // Frequently accessed = keep loaded
  if (stats.accessCount > 10) return true
  
  // Recently accessed = load
  if (Date.now() - stats.lastAccess < 1_HOUR) return true
  
  // Otherwise = lazy load
  return false
}
```

### 3. **Context-Based**
```typescript
function getLoadingPriority(context: {
  isActiveSession: boolean,
  isInPrompt: boolean,
  userRequested: boolean,
  relatedToCurrentWork: boolean
}): "high" | "medium" | "low" | "never" {
  // Active session = immediate load
  if (context.isActiveSession) return "high"
  
  // Needed for LLM prompt = high priority
  if (context.isInPrompt) return "high"
  
  // User explicitly requested = medium priority
  if (context.userRequested) return "medium"
  
  // Related to current work = medium priority
  if (context.relatedToCurrentWork) return "medium"
  
  // Everything else = lazy load
  return "never"
}
```

## 🔧 Implementation: Loading Controller

### Core Component
```typescript
// session/loading-controller.ts

export class SessionLoadingController {
  private activeSessionID: string | null = null
  private loadedSessions = new Set<string>()
  private accessStats = new Map<string, AccessStats>()
  
  /**
   * Decide if session should be loaded based on context
   */
  async shouldLoad(sessionID: string, context: LoadContext): Promise<boolean> {
    // 1. Active session = always load
    if (sessionID === this.activeSessionID) return true
    
    // 2. In LLM prompt = always load
    if (context.isInPrompt) return true
    
    // 3. User clicked = load on demand
    if (context.userRequested) return true
    
    // 4. Recently accessed = keep loaded
    const stats = this.accessStats.get(sessionID)
    if (stats && Date.now() - stats.lastAccess < 3600000) return true
    
    // 5. Everything else = don't load
    return false
  }
  
  /**
   * Load session with appropriate strategy
   */
  async loadSession(sessionID: string, strategy: LoadStrategy) {
    switch (strategy) {
      case "full":
        // Load all messages
        await this.loadFullSession(sessionID)
        break
        
      case "recent":
        // Load last N messages
        await this.loadRecentMessages(sessionID, 20)
        break
        
      case "metadata":
        // Load metadata only
        await this.loadMetadata(sessionID)
        break
        
      case "lazy":
        // Don't load, just create impulse
        await this.createImpulseReference(sessionID)
        break
    }
    
    this.loadedSessions.add(sessionID)
    this.trackAccess(sessionID)
  }
  
  /**
   * Activate session (switch to it)
   */
  async activateSession(sessionID: string) {
    // Unload previous active session
    if (this.activeSessionID && this.activeSessionID !== sessionID) {
      await this.deactivateSession(this.activeSessionID)
    }
    
    // Load new active session
    await this.loadSession(sessionID, "full")
    this.activeSessionID = sessionID
  }
  
  /**
   * Deactivate session (keep in memory but mark inactive)
   */
  async deactivateSession(sessionID: string) {
    // Unload old messages (keep recent for cache)
    await this.unloadOldMessages(sessionID, {
      keepRecent: 10
    })
    
    this.activeSessionID = null
  }
  
  /**
   * Handle memory pressure
   */
  async evictSessions(targetFreeMB: number) {
    const sessions = Array.from(this.loadedSessions.values())
      .map(id => ({
        id,
        stats: this.accessStats.get(id)!,
        size: this.estimateSessionSize(id)
      }))
      .sort((a, b) => a.stats.lastAccess - b.stats.lastAccess) // LRU first
    
    let freedMB = 0
    
    for (const session of sessions) {
      if (session.id === this.activeSessionID) continue // Don't evict active
      if (freedMB >= targetFreeMB) break
      
      await this.unloadSession(session.id)
      freedMB += session.size
    }
    
    log.info("evicted sessions due to memory pressure", {
      freedMB,
      remaining: this.loadedSessions.size
    })
  }
}
```

## 📋 Configuration

### Default Loading Policy
```typescript
export const DEFAULT_LOADING_POLICY = {
  // Active session
  activeSession: {
    strategy: "full",
    messageLimit: 100,
    budget: 50000
  },
  
  // Recent sessions (last N)
  recentSessions: {
    count: 10,
    strategy: "metadata", // Only metadata
    autoLoad: false
  },
  
  // Historical sessions
  historicalSessions: {
    strategy: "lazy",     // Never load until accessed
    budget: 0
  },
  
  // Memory management
  memory: {
    maxLoadedSessions: 5,
    maxTotalBudget: 100000,
    evictionThreshold: 0.8 // 80% of budget
  }
}
```

## 🎬 Usage Examples

### Example 1: User Opens OpenCode
```typescript
// On startup
await SessionLoadingController.initialize({
  // Only load active session metadata
  loadActiveSession: false,
  
  // List recent sessions (metadata only)
  loadRecentCount: 10,
  loadRecentStrategy: "metadata"
})

// Result: ~100 KB memory (instead of 70 GB)
```

### Example 2: User Starts Chatting
```typescript
// User sends first message
await SessionLoadingController.activateSession(currentSessionID)

// Loads:
// - Current session: full (last 100 messages)
// - Related impulses: as needed
// - Historical sessions: nothing

// Memory: ~5-10 MB for active session
```

### Example 3: User Browses Old Sessions
```typescript
// User clicks "Show all sessions"
const sessions = await listSessions({
  strategy: "metadata"  // Only load metadata
})

// User clicks on specific old session
await SessionLoadingController.loadSession(oldSessionID, "full")

// Memory: +5 MB for that session (lazy loaded)
```

## ✅ Summary: When to Load

**ALWAYS LOAD** (Eager):
- ✅ Current active session messages
- ✅ Messages needed for LLM prompt
- ✅ User-requested session (explicit click)

**LOAD METADATA ONLY** (Lazy metadata):
- ✅ Recent 10 sessions (for UI list)
- ✅ Search results
- ✅ Statistics/exports

**NEVER LOAD** (Until accessed):
- ✅ Historical sessions (>30 days old)
- ✅ Inactive sessions
- ✅ Background sessions

**UNLOAD WHEN** (Memory management):
- ✅ User switches to different session
- ✅ Memory usage > 2 GB
- ✅ Session inactive > 1 hour
- ✅ Total loaded sessions > 5

This strategy reduces memory from **70 GB to < 100 MB** while keeping the hot path (active session) performant!
