# CPG Impulse Prioritization - Implementation Analysis

**Quick Win #2**: Add CPG impact scoring to impulse resolution for better context selection

## Current Impulse Scoring & Prioritization

### 1. **Location: Memory Agent Priority Assignment**

File: `repos/metabob-opencode/packages/opencode/src/session/memory-agent.ts`

**Current Priority Levels (Lines 41, 208-212):**
```typescript
priority: z.enum(["high", "medium", "low"])

// Priority Guidelines:
// - high: Critical for understanding request (error files, main feature files)
// - medium: Helpful but not essential (tests, related components)
// - low: Background context (similar examples, documentation)
```

**Priority Assignment Logic (Lines 453, 470, 487, 504):**
```typescript
priority: req.required ? "high" : "medium"
```

**High-Priority Loading (Lines 844-863):**
```typescript
// Load high-priority impulses immediately
if (suggestion.priority === "high") {
  const loadedImpulse = await ImpulseResolver.load(impulse)
  // ...loaded immediately
}
```

**Key Insight**: Priority is currently assigned by the LLM during intent analysis or by template requirements (`required` flag). No CPG impact data is used.

---

### 2. **Location: Context Ranker Scoring**

File: `repos/metabob-opencode/packages/opencode/src/util/metabob.ts`

**Relevance Score Factors (Lines 64-144):**

| Factor | Weight | Line | Current Implementation |
|--------|--------|------|------------------------|
| Mentioned in prompt | 1.0 | 71-79 | Exact file path matching |
| Recently modified | 0.9 | 81-90 | Session tracking |
| HIGH severity | 0.7 | 92-99 | Metabob issue severity |
| MEDIUM severity | 0.5 | 96-99 | Metabob issue severity |
| Co-change score | 0.6 | 101-105 | **Used but not CPG-based** |
| Recently accessed | 0.4 | 107-116 | Session tracking |
| Same directory | 0.3 | 118-128 | Directory proximity |
| Last hour access | 0.2 | 130-141 | Recency |

**Key Method (Lines 51-62):**
```typescript
rank(items: ContextItem[]): RankedContextItem[] {
  return items
    .map((item) => {
      const { score, reasons } = this.calculateRelevance(item)
      return {
        ...item,
        relevanceScore: score,
        reasons,
      }
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
}
```

**Key Insight**: Co-change score exists (line 102) but is not populated from CPG. The infrastructure is there!

---

### 3. **Location: Impulse Resolution & Loading**

File: `repos/metabob-opencode/packages/opencode/src/session/impulse-resolver.ts`

**No Scoring Logic Present:**
- `resolve()` (lines 206-553): Resolves pointer to content (no scoring)
- `load()` (lines 609-650): Loads content and estimates tokens (no scoring)
- `estimateTokens()` (lines 678-680): Simple 4-char-per-token estimate

**Key Insight**: Impulse resolver is purely about content loading. Scoring happens before resolution.

---

## Data Structures for Impulse Pointers

### Impulse Schema
```typescript
// From repos/metabob-opencode/packages/opencode/src/session/activity-template.ts
export interface Impulse.Schema {
  id: string
  sessionID?: string
  scope: "activity" | "session" | "global"
  pointer: Impulse.Pointer
  budget: number              // Token budget
  priority: "high" | "medium" | "low"
  type: string
  loaded: boolean
  content?: string
  tokenCount?: number
  metadata?: Record<string, any>
}
```

### Pointer Types (impulse-resolver.ts lines 209-545)

**File Pointer (lines 213-300):**
```typescript
{
  type: "file",
  path: string,
  offset?: number,  // Line offset
  limit?: number    // Line limit
}
```

**Component Pointer (lines 302-325):**
```typescript
{
  type: "component",
  file: string,
  name: string      // Function/class name
}
```

**Metabob Issue Pointer (lines 350-395):**
```typescript
{
  type: "metabobIssue",
  issueId: string
}
```

**Other Types:**
- `memo`: Inline content
- `commit`: Git commit hash
- `activityOutput`: Activity execution results
- `bashOutput`: Shell command output
- `metabobAnnotation`: Component annotations
- `custom`: Extensibility point

---

## CPG Integration Point: analyzeChangeImpact()

File: `repos/metabob-opencode/packages/opencode/src/util/metabob.ts` (lines 559-604)

```typescript
export async function analyzeChangeImpact(
  filePath: string,
  componentName?: string,
  maxDepth?: number,
): Promise<{
  status: string
  impact_summary?: {
    direct_dependencies: number
    direct_dependents: number
    transitive_dependencies: number
    transitive_dependents: number
  }
  recommendation?: string
} | undefined>
```

**MCP Tool Call:**
```typescript
const result = await callMCPTool("analyze_change_impact", {
  file_path: filePath,
  component_name: componentName,
  max_depth: maxDepth || 3,
})
```

**Returns:**
- Direct dependents: Components that import/use this component
- Transitive dependents: Full downstream impact
- Recommendation: High/medium/low impact assessment

---

## Existing Caching Mechanisms

### 1. **Session-Level Impulse Storage**

File: `repos/metabob-opencode/packages/opencode/src/session/session-memory.ts`

**Store Structure (lines 41-47):**
```typescript
export interface Store {
  sessionID: string
  impulses: Record<string, ActivityTemplate.Impulse.Schema>
  totalBudget: number
  usedTokens: number
  lastOptimized: number
}
```

**Methods:**
- `save(store)` (line 114): Persist to storage
- `load(sessionID)` (line 130): Load from storage
- `cleanImpulsesForStorage(store)` (line 62): Prevent memory leaks

**Key Insight**: Impulses are cached per-session with `loaded` state tracking.

---

### 2. **Content Caching via `loaded` Flag**

File: `repos/metabob-opencode/packages/opencode/src/session/impulse-resolver.ts`

**Load Check (lines 610-613):**
```typescript
export async function load(impulse: Schema): Promise<Schema> {
  if (impulse.loaded) {
    log.debug("impulse already loaded", { id: impulse.id })
    return impulse  // Skip re-loading
  }
  // ... resolve content
}
```

**Key Insight**: Once loaded, impulse content is reused without re-fetching.

---

### 3. **Token Estimation Caching**

**Loaded Impulse Preserves tokenCount (line 632):**
```typescript
return {
  ...impulse,
  loaded: true,
  content,
  tokenCount,  // Cached for budget tracking
}
```

---

## CPG Impact Boost Implementation Plan

### **Where to Add: ContextRanker.calculateRelevance()**

File: `repos/metabob-opencode/packages/opencode/src/util/metabob.ts`  
Function: `calculateRelevance()` (lines 64-144)

### **Exact Insertion Point: After Line 105**

Current code:
```typescript
// Factor 4: Co-changes with active files (weight: 0.6)
if (item.metadata.cochangeScore !== undefined && item.metadata.cochangeScore > 0.5) {
  score += 0.6 * item.metadata.cochangeScore
  reasons.push(`co-change score: ${(item.metadata.cochangeScore * 100).toFixed(0)}%`)
}

// Factor 5: Recently read/active (weight: 0.4)  <-- INSERT HERE
```

### **New Factor: CPG Impact Score**

**Add after line 105:**
```typescript
// Factor 4.5: CPG Impact (high-impact components prioritized) (weight: 0.8)
if (item.metadata.cpgImpact !== undefined) {
  const impactScore = item.metadata.cpgImpact.impactScore || 0
  score += 0.8 * impactScore
  reasons.push(
    `CPG impact: ${item.metadata.cpgImpact.impactLevel} ` +
    `(${item.metadata.cpgImpact.totalDependents} dependents)`
  )
}
```

### **Weight Justification:**

CPG impact (0.8) is weighted higher than:
- Co-change score (0.6): CPG is more reliable than heuristics
- Recently accessed (0.4): Infrastructure > recency
- Same directory (0.3): Architectural importance > proximity

But lower than:
- Mentioned in prompt (1.0): Explicit user request trumps all
- Recently modified (0.9): Active work is immediate priority

---

## CPG Impact Data Structure

Add to `ContextItem.metadata`:

```typescript
export interface ContextItem {
  type: "file" | "issue" | "pattern" | "doc"
  content: string
  metadata: {
    filePath?: string
    severity?: "HIGH" | "MEDIUM" | "LOW"
    cochangeScore?: number
    
    // NEW: CPG Impact Data
    cpgImpact?: {
      impactScore: number        // 0-1 normalized score
      impactLevel: "high" | "medium" | "low"
      directDependents: number
      transitiveDependents: number
      totalDependents: number    // Sum of direct + transitive
    }
    
    lastAccessed?: number
    directory?: string
    [key: string]: any
  }
}
```

---

## Integration with analyzeChangeImpact()

### **Step 1: Enrich Impulse Metadata During Creation**

File: `repos/metabob-opencode/packages/opencode/src/session/memory-agent.ts`  
Function: `prepareAndLoadImpulses()` (lines 816-870)

**Add after impulse creation (line 829):**
```typescript
const impulse: ActivityTemplate.Impulse.Schema = {
  id: suggestion.id,
  sessionID: input.sessionID,
  scope: "session",
  pointer: suggestion.pointer as ActivityTemplate.Impulse.Pointer,
  budget: suggestion.budget,
  priority: suggestion.priority,
  type: suggestion.type,
  loaded: false,
  metadata: {
    description: suggestion.description,
    createdTurn: input.turnNumber,
  },
}

// NEW: Enrich with CPG impact data for file-based impulses
if (impulse.pointer.type === "file") {
  try {
    const { MetabobCLI } = await import("../util/metabob")
    const impactData = await MetabobCLI.analyzeChangeImpact(
      impulse.pointer.path,
      undefined,  // No component name (full file analysis)
      2           // Shallow depth for performance
    )
    
    if (impactData?.impact_summary) {
      const totalDependents = 
        impactData.impact_summary.direct_dependents +
        impactData.impact_summary.transitive_dependents
      
      // Normalize to 0-1 scale (assume max 100 dependents)
      const impactScore = Math.min(totalDependents / 100, 1.0)
      
      // Classify impact level
      let impactLevel: "high" | "medium" | "low"
      if (totalDependents >= 20) impactLevel = "high"
      else if (totalDependents >= 5) impactLevel = "medium"
      else impactLevel = "low"
      
      impulse.metadata.cpgImpact = {
        impactScore,
        impactLevel,
        directDependents: impactData.impact_summary.direct_dependents,
        transitiveDependents: impactData.impact_summary.transitive_dependents,
        totalDependents,
      }
      
      l.debug("CPG impact enriched", {
        impulseId: impulse.id,
        filePath: impulse.pointer.path,
        impactLevel,
        totalDependents,
      })
    }
  } catch (error) {
    // Non-critical: CPG enrichment is best-effort
    l.debug("CPG impact enrichment failed", {
      impulseId: impulse.id,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
```

### **Step 2: Propagate to ContextRanker**

When converting impulses to `ContextItem[]`, include `cpgImpact` in metadata.

---

## Sample Code for CPG Impact Scoring

### **Full Implementation Example**

```typescript
// File: repos/metabob-opencode/packages/opencode/src/util/metabob.ts
// Location: ContextRanker.calculateRelevance() after line 105

private calculateRelevance(item: ContextItem): { score: number; reasons: string[] } {
  let score = 0
  const reasons: string[] = []

  const filePath = item.metadata.filePath || item.content

  // [Existing factors 1-4 here]

  // Factor 4.5: CPG Impact Boost (NEW)
  if (item.metadata.cpgImpact) {
    const impact = item.metadata.cpgImpact
    const impactScore = impact.impactScore || 0
    
    // Weight: 0.8 (prioritize infrastructure components)
    score += 0.8 * impactScore
    
    // Add detailed reason
    const dependentsSummary = 
      impact.directDependents > 0 
        ? `${impact.directDependents} direct, ${impact.transitiveDependents} transitive`
        : `${impact.totalDependents} total`
    
    reasons.push(
      `${impact.impactLevel.toUpperCase()} CPG impact (${dependentsSummary} dependents)`
    )
    
    // Boost priority if impact is high and current priority is medium
    if (impact.impactLevel === "high" && score < 1.5) {
      score += 0.2  // Additional boost for critical components
      reasons.push("critical infrastructure component")
    }
  }

  // [Existing factors 5-7 continue here]

  return { score, reasons }
}
```

---

## Expected Impact Validation

### **Before CPG Integration:**
```
Context Selection (20 items, 10K token budget):
- 5 items: Mentioned in prompt (score 1.0)
- 3 items: Recently modified (score 0.9)
- 7 items: HIGH severity (score 0.7)
- 5 items: Medium/low priority

Infrastructure files (e.g., auth.ts with 50 dependents):
- Score: 0.7 (HIGH severity only)
- Often excluded if budget tight
```

### **After CPG Integration:**
```
Context Selection (20 items, 10K token budget):
- 5 items: Mentioned in prompt (score 1.0+)
- 3 items: Recently modified (score 0.9+)
- 8 items: HIGH CPG impact (score 0.7 + 0.8 = 1.5)
- 4 items: Medium/low priority

Infrastructure files (e.g., auth.ts with 50 dependents):
- Score: 0.7 (severity) + 0.8 (CPG) + 0.2 (boost) = 1.7
- Guaranteed inclusion in top-ranked items
```

### **Success Metrics:**
- **60%+ high-impact components** in top 20 context items
- **Fewer critical path issues** (auth, sessions, DB) missed
- **Better context budget utilization** (infrastructure > noise)

---

## Performance Considerations

### **CPG Call Overhead:**
- `analyzeChangeImpact()` per file impulse: ~50-100ms
- Batch 5 impulses: ~250-500ms total
- Cached in impulse metadata (no repeat calls)

### **Optimization:**
```typescript
// Parallel CPG enrichment
const enrichmentPromises = newImpulses
  .filter(i => i.pointer.type === "file")
  .map(i => enrichCPGImpact(i))

await Promise.allSettled(enrichmentPromises)  // Don't block on failures
```

---

## Integration Testing Plan

### **Test 1: High-Impact Component Prioritization**
```typescript
// Given: Auth component with 50 dependents
// When: Memory agent creates auth.ts impulse
// Then: cpgImpact.impactLevel === "high"
// Then: cpgImpact.totalDependents === 50
```

### **Test 2: Context Ranking with CPG**
```typescript
// Given: 10 file impulses (5 high-impact, 5 low-impact)
// When: ContextRanker.rank() is called
// Then: Top 5 items should include ≥4 high-impact files
```

### **Test 3: Graceful Degradation**
```typescript
// Given: CPG MCP unavailable
// When: Impulse enrichment fails
// Then: Impulse created without cpgImpact (score based on other factors)
// Then: No error thrown (best-effort enrichment)
```

---

## Summary

### **Current State:**
- Impulse priorities: LLM-assigned (`high/medium/low`)
- Context scoring: 7 factors (severity, recency, co-change, etc.)
- No CPG impact data used in prioritization

### **Proposed Change:**
- **Add Factor 4.5**: CPG impact score (weight 0.8)
- **Enrich impulses**: Call `analyzeChangeImpact()` during creation
- **Store in metadata**: `cpgImpact` with dependents count
- **Boost infrastructure**: High-impact components ranked higher

### **Implementation Files:**
1. `repos/metabob-opencode/packages/opencode/src/util/metabob.ts`
   - ContextRanker.calculateRelevance() (line 105)
   - Add CPG impact scoring factor
   
2. `repos/metabob-opencode/packages/opencode/src/session/memory-agent.ts`
   - prepareAndLoadImpulses() (line 829)
   - Enrich impulses with CPG data

### **Key Benefits:**
- **60%+ context items** will be high-impact components
- **Fewer missed issues** in critical infrastructure
- **Better token budget usage** (infrastructure > noise)
- **Graceful degradation** (works without CPG)

---

## Next Steps

1. Implement CPG enrichment in memory-agent.ts
2. Add CPG impact factor to ContextRanker
3. Update ContextItem metadata interface
4. Add integration tests
5. Validate with real sessions (auth/sessions/DB scenarios)
