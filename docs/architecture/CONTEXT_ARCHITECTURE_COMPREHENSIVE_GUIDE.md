# Context Architecture: Comprehensive Guide

**Date**: 2026-02-19  
**Topics**: Impulse State, Session Memory, SurrealDB, Metabob-CLI, Annotations, Documentation Ingestion

---

## Table of Contents

1. [Intent Capture in Impulse State](#1-intent-capture-in-impulse-state)
2. [Session Memory Agent Architecture](#2-session-memory-agent-architecture)
3. [SurrealDB Schema and Data Flow](#3-surrealdb-schema-and-data-flow)
4. [Metabob-CLI Interaction](#4-metabob-cli-interaction)
5. [Annotation Processing and Parsing](#5-annotation-processing-and-parsing)
6. [Documentation Ingestion Strategy](#6-documentation-ingestion-strategy)

---

## 1. Intent Capture in Impulse State

### What is an Impulse?

An **impulse** is a unit of context that carries:
- **Pointer**: Reference to actual data (file, memo, bash output, metabob issue)
- **Budget**: Token allocation for loading this context
- **Priority**: high/medium/low
- **Type**: Categorization for resolution strategy
- **Intent**: WHY this context is needed (captured via session memory agent)

### How Intent is Captured

#### A. User Intent Analysis (Pre-Prompt)

**Location**: `repos/metabob-opencode/packages/opencode/src/session/memory-agent.ts`

```typescript
export const Intent = z.object({
  type: z.enum(["code_fix", "feature_request", "question", "refactor", "exploration", "other"]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  suggestedImpulses: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["file", "metabobIssue", "history", "memo", "bashOutput"]),
      description: z.string(), // ← INTENT DESCRIPTION
      priority: z.enum(["high", "medium", "low"]),
      budget: z.number(),
      pointer: /* ... */
    })
  )
})
```

**Process**:
1. **User sends message** → "Fix the authentication bug in auth.ts"
2. **Memory agent analyzes** (background, <3s with Haiku):
   ```
   Intent: code_fix (95% confidence)
   Reasoning: "User mentions fixing a bug in specific file"
   Suggested Impulses:
     - file: auth.ts (HIGH priority, budget 2000)
     - metabobIssue: search for auth issues (MEDIUM priority, budget 1000)
   ```
3. **Impulses created automatically** with intent embedded in description

#### B. Activity Intent Capture

**Location**: Activity template `reason` parameter

```typescript
await activity({
  templateId: "fix-bug-complete",
  variables: { bugDescription: "auth fails on password reset" },
  reason: "User reported auth bug - password reset not working for SSO users"
  //      ↑ THIS IS THE INTENT - preserved in activity record
})
```

The `reason` field captures:
- **Why** this activity is being run
- **Context** about the problem
- **Business justification** for the work

#### C. Impulse Metadata Storage

**Schema** (from SurrealDB migration `005-impulse-tables.surql`):

```sql
DEFINE FIELD created_for ON impulse_registry TYPE string DEFAULT "";
DEFINE FIELD tags ON impulse_registry TYPE array DEFAULT [];
```

**Usage**:
```typescript
impulse_create({
  id: "imp_auth_fix_context",
  type: "file",
  pointer: { type: "file", path: "src/auth.ts" },
  budget: 2000,
  metadata: {
    created_for: "Fix password reset bug for SSO users", // ← INTENT
    tags: ["bug-fix", "auth", "sso"],
  }
})
```

### Intent Flow Diagram

```
User Message
    ↓
Session Memory Agent (analyzes intent)
    ↓
Intent Classification
    ├─ type: code_fix / feature_request / refactor / etc.
    ├─ confidence: 0-1
    ├─ reasoning: "Why we classified it this way"
    └─ suggestedImpulses: [...]
        ↓
Impulse Creation (automatic)
    ├─ id: generated
    ├─ type: file / metabobIssue / etc.
    ├─ pointer: reference to data
    ├─ budget: token allocation
    ├─ priority: high / medium / low
    └─ description: ← INTENT embedded here
        ↓
SurrealDB impulse_registry
    ├─ impulse_id
    ├─ created_for: intent description
    ├─ tags: categorization
    └─ usage tracking (success rate)
        ↓
Context Injection (prompt time)
    └─ Impulse resolved → content injected with intent context
```

---

## 2. Session Memory Agent Architecture

### Overview

The **Session Memory Agent** is a background agent that:
- Runs **before** the main agent executes (pre-prompt hook)
- Analyzes user intent and prepares context (impulses) automatically
- Uses **Claude Haiku** (fast, cheap) for <3s analysis
- **Transparent** to user (no memory tools exposed)

### Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Turn Lifecycle Hook                                │
│   - Registered at priority 10 (runs early)                  │
│   - Triggered on every user message                          │
│   - Calls Session Memory Agent                              │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: Intent Analysis (SessionMemoryAgent.analyzeIntent) │
│   - Input: user message + recent messages                   │
│   - Model: Claude Haiku (fast, cheap)                       │
│   - Output: Intent classification + suggested impulses      │
│   - Timeout: 3 seconds (configurable)                       │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Impulse Creation (SessionMemory.createImpulses)    │
│   - Takes suggested impulses from intent analysis           │
│   - Creates impulse records in session                      │
│   - Allocates token budgets                                 │
│   - Prioritizes by relevance                                │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 4: Context Injection (ImpulseFormatter)               │
│   - Resolves impulse pointers → actual content              │
│   - Applies token budgets (lazy loading)                    │
│   - Injects into system prompt as structured context        │
│   - Uses compression strategies (truncate, filter, etc.)    │
└─────────────────────────────────────────────────────────────┘
```

### Configuration

**Location**: `opencode.json` (project root)

```jsonc
{
  "sessionMemory": {
    "enabled": true,           // Enable automatic context management
    "timeout": 3000,           // Max time for intent analysis (ms)
    "model": {
      "providerID": "anthropic",
      "modelID": "claude-3-5-haiku-20241022"  // Fast, cheap model
    },
    "defaultBudget": 2000,     // Default tokens per impulse
    "maxImpulses": 5,          // Max impulses per turn
    "inject_annotations": true // Include Metabob annotations
  }
}
```

### Workflow Example

**User Input**: "The login function is slow, can you optimize it?"

**Step 1: Intent Analysis** (background, 1-2s)
```typescript
{
  type: "refactor",
  confidence: 0.85,
  reasoning: "User mentions performance issue and requests optimization",
  suggestedImpulses: [
    {
      id: "imp_login_code",
      type: "file",
      description: "Load login function code to analyze performance",
      priority: "high",
      budget: 2000,
      pointer: { type: "file", path: "src/auth/login.ts" }
    },
    {
      id: "imp_metabob_perf",
      type: "metabobIssue",
      description: "Check for known performance issues in login area",
      priority: "medium",
      budget: 1000,
      pointer: { type: "metabobIssue", issueId: "search:performance+login" }
    }
  ]
}
```

**Step 2: Impulse Creation** (automatic)
- 2 impulses created in session memory
- Budgets allocated: 3000 tokens total
- Priority: high → medium

**Step 3: Context Injection** (prompt time)
```
<session_memory>
  <impulse id="imp_login_code" type="file" priority="high">
    [CONTENT: src/auth/login.ts - 400 lines loaded]
  </impulse>
  
  <impulse id="imp_metabob_perf" type="metabobIssue" priority="medium">
    [CONTENT: 3 performance issues found in login area]
  </impulse>
</session_memory>
```

**Step 4: Main Agent Response**
Main agent receives context automatically, responds with optimization suggestions.

### Key Advantages

1. **Zero User Burden**: No manual context selection
2. **Fast Analysis**: <3s with Haiku (vs manual context gathering)
3. **Smart Prioritization**: High-relevance context loaded first
4. **Budget Aware**: Token limits enforced automatically
5. **Intent Preservation**: Why context was loaded is tracked

---

## 3. SurrealDB Schema and Data Flow

### Schema Overview

**Location**: `sql/migrations/005-impulse-tables.surql`

Two main tables:
1. **impulse_registry**: Central registry of all impulses (metadata)
2. **impulse_usage**: Junction table (which impulses used in which steps)

### impulse_registry Schema

```sql
DEFINE TABLE impulse_registry SCHEMAFULL;

-- Identity
DEFINE FIELD impulse_id ON impulse_registry TYPE string;
DEFINE FIELD session_id ON impulse_registry TYPE option<string>;
DEFINE FIELD org_id ON impulse_registry TYPE string DEFAULT "anonymous";
DEFINE FIELD project_id ON impulse_registry TYPE string DEFAULT "default";

-- Type & Content
DEFINE FIELD impulse_type ON impulse_registry TYPE string;  -- file, memo, bashOutput, activity, etc.
DEFINE FIELD pointer ON impulse_registry TYPE object DEFAULT {};
DEFINE FIELD scope ON impulse_registry TYPE string DEFAULT "session";

-- Budget Management
DEFINE FIELD budget ON impulse_registry TYPE int DEFAULT 0;
DEFINE FIELD actual_tokens ON impulse_registry TYPE option<int>;

-- Usage Statistics (Learning Loop)
DEFINE FIELD usage_count ON impulse_registry TYPE int DEFAULT 0;
DEFINE FIELD success_when_used ON impulse_registry TYPE int DEFAULT 0;
DEFINE FIELD success_rate ON impulse_registry TYPE float DEFAULT 0.0;

-- Intent Capture
DEFINE FIELD created_by ON impulse_registry TYPE string DEFAULT "unknown";
DEFINE FIELD created_for ON impulse_registry TYPE string DEFAULT "";  -- ← INTENT
DEFINE FIELD tags ON impulse_registry TYPE array DEFAULT [];
DEFINE FIELD related_impulses ON impulse_registry TYPE array DEFAULT [];

-- Lifecycle
DEFINE FIELD status ON impulse_registry TYPE string DEFAULT "active";
DEFINE FIELD created_at ON impulse_registry TYPE datetime DEFAULT time::now();
DEFINE FIELD last_used_at ON impulse_registry TYPE option<datetime>;
DEFINE FIELD archived_at ON impulse_registry TYPE option<datetime>;
```

### impulse_usage Schema

```sql
DEFINE TABLE impulse_usage SCHEMAFULL;

-- Links
DEFINE FIELD execution_id ON impulse_usage TYPE string;
DEFINE FIELD step_id ON impulse_usage TYPE string;
DEFINE FIELD impulse_id ON impulse_usage TYPE string;

-- Usage Details
DEFINE FIELD usage_type ON impulse_usage TYPE string;  -- loaded, created, referenced
DEFINE FIELD resolution_time_ms ON impulse_usage TYPE option<int>;
DEFINE FIELD tokens_used ON impulse_usage TYPE option<int>;

-- Success Correlation
DEFINE FIELD step_succeeded ON impulse_usage TYPE bool;
DEFINE FIELD contributed_to_success ON impulse_usage TYPE option<bool>;  -- Causal analysis
```

### Data Flow

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Impulse Creation (OpenCode)                               │
│    - User message → Memory agent → Intent analysis           │
│    - Impulses created in-memory (session state)              │
│    - NOT immediately persisted to DB                         │
└──────────────────────────────────────────────────────────────┘
           ↓
┌──────────────────────────────────────────────────────────────┐
│ 2. Activity Execution (OpenCode)                             │
│    - Activity tasks execute                                  │
│    - Impulses loaded/created during execution                │
│    - Step results recorded (success/failure)                 │
│    - Execution data sent to backend API                      │
└──────────────────────────────────────────────────────────────┘
           ↓
┌──────────────────────────────────────────────────────────────┐
│ 3. Backend API (metabob-rpc-api)                             │
│    - Receives activity execution data                        │
│    - Extracts impulse information from steps                 │
│    - Writes to SurrealDB:                                    │
│      • impulse_registry (if new impulse)                     │
│      • impulse_usage (for each step using impulse)           │
└──────────────────────────────────────────────────────────────┘
           ↓
┌──────────────────────────────────────────────────────────────┐
│ 4. SurrealDB Storage                                         │
│    - impulse_registry: Persistent impulse metadata           │
│    - impulse_usage: Step-level usage tracking                │
│    - Indexes for fast queries                                │
└──────────────────────────────────────────────────────────────┘
           ↓
┌──────────────────────────────────────────────────────────────┐
│ 5. Learning Loop (Periodic)                                  │
│    - Query: Which impulses correlate with success?           │
│    - Update: usage_count, success_rate in impulse_registry   │
│    - Archive: Unused impulses older than 30 days             │
│    - Recommend: High success-rate impulses for similar work  │
└──────────────────────────────────────────────────────────────┘
```

### Example Queries

**Query 1: Most Effective Impulses**
```sql
SELECT impulse_id, impulse_type, usage_count, success_rate 
FROM impulse_registry 
WHERE usage_count > 5 AND status = 'active'
ORDER BY success_rate DESC, usage_count DESC
LIMIT 20;
```

**Query 2: Which Impulses Correlate with Success?**
```sql
SELECT 
    iu.impulse_id,
    ir.impulse_type,
    count() as usage_count,
    math::sum(CASE WHEN iu.step_succeeded THEN 1 ELSE 0 END) as success_count,
    math::sum(CASE WHEN iu.step_succeeded THEN 1.0 ELSE 0.0 END) / count() as success_rate
FROM impulse_usage iu
JOIN impulse_registry ir ON iu.impulse_id = ir.impulse_id
GROUP BY iu.impulse_id, ir.impulse_type
HAVING usage_count > 5
ORDER BY success_rate DESC;
```

**Query 3: Co-occurring Impulses (Often Used Together)**
```sql
SELECT 
    iu1.impulse_id as impulse_a,
    iu2.impulse_id as impulse_b,
    count(DISTINCT iu1.execution_id) as co_occurrence_count
FROM impulse_usage iu1
JOIN impulse_usage iu2 ON iu1.execution_id = iu2.execution_id
WHERE iu1.impulse_id < iu2.impulse_id
GROUP BY iu1.impulse_id, iu2.impulse_id
HAVING co_occurrence_count > 5
ORDER BY co_occurrence_count DESC
LIMIT 50;
```

### Learning Loop Implementation

**Goal**: Which context helps activities succeed?

**Metrics Tracked**:
- `usage_count`: How many times this impulse was loaded
- `success_when_used`: How many times step succeeded when this impulse present
- `success_rate`: success_when_used / usage_count

**Automated Updates** (periodic job):
```sql
UPDATE impulse_registry SET
    usage_count = (SELECT count() FROM impulse_usage WHERE impulse_id = $impulse_id),
    success_when_used = (SELECT count() FROM impulse_usage WHERE impulse_id = $impulse_id AND step_succeeded = true),
    success_rate = (SELECT math::sum(CASE WHEN step_succeeded THEN 1.0 ELSE 0.0 END) / count() FROM impulse_usage WHERE impulse_id = $impulse_id),
    last_used_at = (SELECT max(created_at) FROM impulse_usage WHERE impulse_id = $impulse_id)
WHERE impulse_id = $impulse_id;
```

**Recommendation Engine** (future):
```
User starts activity similar to previous successful activity
  ↓
Query impulse_registry for impulses used in similar activities
  ↓
Filter by high success_rate (>0.7)
  ↓
Suggest these impulses to session memory agent
  ↓
Automatic context loading
```

---

## 4. Metabob-CLI Interaction

### What is Metabob?

**Metabob** provides:
- **Code quality analysis** (issues, security, performance)
- **Component annotations** (WHY code exists, design decisions)
- **Co-change patterns** (which files change together)
- **Code Property Graph (CPG)** for dependency analysis

### Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ OpenCode (Client)                                            │
│   ├─ MCP Client                                              │
│   ├─ Metabob MCP Tools (via MCP protocol)                   │
│   └─ Context Ranker (prioritizes Metabob issues)            │
└─────────────────────────────────────────────────────────────┘
           ↓ (JSON-RPC over HTTP/SSE)
┌─────────────────────────────────────────────────────────────┐
│ Metabob MCP Server                                           │
│   ├─ metabob_search_codebase_issues                         │
│   ├─ metabob_mark_problem_complete                          │
│   ├─ metabob_annotate_component                             │
│   ├─ metabob_analyze_change_impact                          │
│   ├─ metabob_list_file_components                           │
│   ├─ metabob_assess_deletion_safety                         │
│   └─ metabob_suggest_related_changes                        │
└─────────────────────────────────────────────────────────────┘
           ↓ (REST API)
┌─────────────────────────────────────────────────────────────┐
│ Metabob Backend (metabob-cli)                               │
│   ├─ Issue Detection Engine                                 │
│   ├─ CPG (Code Property Graph)                              │
│   ├─ Annotation Storage                                     │
│   └─ Co-change Analysis                                     │
└─────────────────────────────────────────────────────────────┘
```

### MCP Tools Exposed

**1. metabob_search_codebase_issues**
```typescript
// Search for code quality issues
metabob_search_codebase_issues({
  query: "authentication",
  limit: 10
})
// Returns: Issues with relevance scores, annotations, resolutions
```

**2. metabob_annotate_component**
```typescript
// Document WHY code exists
metabob_annotate_component({
  file_path: "src/auth/login.ts",
  component_name: "LoginHandler",
  component_type: "class",
  reason: "Handles user authentication with SSO integration. Uses JWT tokens for session management. Chose this over session cookies for stateless API design."
})
```

**3. metabob_analyze_change_impact**
```typescript
// Understand blast radius before changes
metabob_analyze_change_impact({
  file_path: "src/auth/login.ts",
  component_name: "LoginHandler.authenticate"
})
// Returns: Dependencies, dependents, issues in related code
```

### Context Ranking

**Location**: `repos/metabob-opencode/packages/opencode/src/util/metabob.ts`

```typescript
class ContextRanker {
  rank(items: ContextItem[]): RankedContextItem[] {
    // Ranking factors (cumulative scores):
    // 1.0 - Mentioned in user prompt
    // 0.9 - Recently modified
    // 0.7 - HIGH severity issue
    // 0.6 - High co-change score (files often changed together)
    // 0.5 - MEDIUM severity issue
    // 0.4 - Directory match
    // 0.3 - Recently accessed
    
    return items.sort((a, b) => b.relevanceScore - a.relevanceScore)
  }
}
```

**Usage in Session Memory**:
```typescript
// Memory agent suggests impulses
const metabobIssues = await metabob_search_codebase_issues({
  query: userPrompt,
  limit: 20
})

// Rank issues by relevance
const ranker = new ContextRanker({
  mentionedFiles: ["auth.ts"],
  modifiedFiles: gitStatus.modified
})
const ranked = ranker.rank(metabobIssues)

// Create impulses for top 5
const impulses = ranked.slice(0, 5).map(issue => ({
  id: `imp_metabob_${issue.id}`,
  type: "metabobIssue",
  pointer: { type: "metabobIssue", issueId: issue.id },
  budget: 1000,
  priority: issue.severity === "HIGH" ? "high" : "medium",
  description: `${issue.title} - ${issue.description}`
}))
```

### Annotation Processing

**Annotations** capture:
- **WHY** code exists (design decisions)
- **Alternatives considered** (trade-offs)
- **Constraints** (business rules, technical limits)
- **Related patterns** (consistency across codebase)

**Storage**:
- Stored in Metabob backend (not in git)
- Indexed by file path + component name
- Retrieved via MCP tools

**Injection into Context**:
```typescript
// When session memory enabled with inject_annotations: true
const annotations = await metabob_list_file_components({
  file_path: "src/auth/login.ts"
})

// Injected as impulse:
{
  id: "imp_annotation_login",
  type: "annotation",
  pointer: { type: "annotation", file: "src/auth/login.ts" },
  budget: 500,
  content: `
    LoginHandler.authenticate:
      Design: JWT-based stateless authentication
      Why: API design requires stateless sessions
      Alternatives: Session cookies (rejected - stateful)
      Constraints: Must support SSO providers
  `
}
```

---

## 5. Annotation Processing and Parsing

### Annotation Lifecycle

```
┌────────────────────────────────────────────────────────────┐
│ 1. Code Change (Developer)                                 │
│    - Developer implements feature                          │
│    - Activity tool executes                                │
│    - Agent makes code changes                              │
└────────────────────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────────────────────┐
│ 2. Annotation Creation (Automatic)                         │
│    - Activity template includes annotation task            │
│    - metabob_annotate_component called                     │
│    - Stores: file, component, reason, timestamp            │
└────────────────────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────────────────────┐
│ 3. Annotation Storage (Metabob Backend)                    │
│    - Indexed by file path + component name                 │
│    - Searchable by pattern                                 │
│    - Versioned (timestamp tracking)                        │
└────────────────────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────────────────────┐
│ 4. Retrieval (Future Work on Same Code)                    │
│    - Session memory agent detects file access              │
│    - metabob_list_file_components(file) called             │
│    - Annotations retrieved for relevant components         │
│    - Injected as impulse into session                      │
└────────────────────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────────────────────┐
│ 5. Context Injection (Prompt Time)                         │
│    <annotation component="LoginHandler">                   │
│      Design: JWT stateless auth                            │
│      Why: API requires statelessness                       │
│      Alternatives: Session cookies (rejected)              │
│    </annotation>                                           │
└────────────────────────────────────────────────────────────┘
```

### Annotation Schema

```typescript
interface Annotation {
  file_path: string              // "src/auth/login.ts"
  component_name: string         // "LoginHandler.authenticate"
  component_type: string         // "class" | "function" | "method"
  reason: string                 // WHY + alternatives + constraints
  created_at: number             // Timestamp
  created_by: string             // Agent/user ID
  tags: string[]                 // ["auth", "security", "sso"]
}
```

### Parsing Annotations for Context

**Format in System Prompt**:
```xml
<session_memory>
  <annotations>
    <file path="src/auth/login.ts">
      <component name="LoginHandler" type="class">
        <reason>
          Handles user authentication with SSO integration.
          
          Design: JWT-based stateless authentication for API
          Why: Microservice architecture requires stateless sessions
          Alternatives: Session cookies (rejected - stateful)
          Constraints: Must support multiple SSO providers
          Related: UserManager class uses similar pattern
        </reason>
        <created_at>2026-02-15T10:30:00Z</created_at>
      </component>
      
      <component name="LoginHandler.authenticate" type="method">
        <reason>
          Authenticates user credentials against SSO provider.
          
          Design: Async method with error handling
          Why: Network calls require async, errors must be caught
          Performance: Added caching to reduce SSO calls (90% hit rate)
          Security: Input validation before SSO call
        </reason>
      </component>
    </file>
  </annotations>
</session_memory>
```

### Smart Annotation Filtering

**Problem**: Too many annotations → context bloat

**Solution**: Priority filtering
```typescript
// Only load annotations for:
1. Files mentioned in user prompt (score: 1.0)
2. Files recently modified (score: 0.9)
3. Files with HIGH severity issues (score: 0.7)
4. Top 5 most relevant annotations

// Skip annotations for:
- Files not touched in 90+ days
- Low relevance scores (<0.3)
- Components with no recent changes
```

---

## 6. Documentation Ingestion Strategy

### The Problem

Generated documentation files:
- **Fall out of sync** with implementation
- **Bloat git history** with large markdown files
- **Difficult to maintain** (who updates docs after code change?)
- **Clutter repository** (docs vs code separation)

### The Solution: Annotation-Based Documentation

**Key Insight**: Documentation should live WHERE it's needed (in context), not in files.

#### Architecture

```
Code Changes
    ↓
Automatic Annotations (metabob_annotate_component)
    ↓
Metabob Backend Storage (NOT in git)
    ↓
Context Injection (when relevant)
    ↓
Agent sees documentation ONLY when needed
```

### Strategy Components

#### 1. Annotation Storage (Primary Documentation)

**What to Store as Annotations**:
- **Design Decisions**: Why this approach over alternatives
- **Business Context**: Requirements that drove implementation
- **Technical Constraints**: Performance, security, compatibility
- **Patterns**: Relationships to similar code
- **Warnings**: Known issues, edge cases, gotchas

**Example**:
```typescript
metabob_annotate_component({
  file_path: "src/payment/stripe.ts",
  component_name: "StripePaymentProcessor",
  component_type: "class",
  reason: `
    Handles Stripe payment processing for subscriptions.
    
    Design: Uses Stripe SDK v12 (latest stable)
    Why: Stripe v11 has webhook security vulnerability (CVE-2024-1234)
    Alternatives: PayPal (rejected - poor subscription support)
    Constraints: Must handle webhook retries (Stripe retries 3x with backoff)
    Performance: Idempotency keys prevent duplicate charges
    Security: Webhook signature verification required
    Related: BillingManager uses similar idempotency pattern
    
    Known Issues:
    - Stripe webhooks can be delayed up to 5 minutes
    - Test mode webhooks don't match prod behavior perfectly
    
    Migration Notes:
    - Migrated from Stripe v10 on 2026-01-15
    - Old webhook endpoints kept for 90 days (delete after 2026-04-15)
  `
})
```

#### 2. Structured Documentation (Git-Clean)

**What to Keep in Git** (minimal):
- **README.md**: Project overview, setup instructions
- **ARCHITECTURE.md**: High-level system design (stable)
- **API.md**: Public API contracts (versioned)
- **CONTRIBUTING.md**: Development workflow

**What to EXCLUDE from Git** (generated/verbose):
- Detailed implementation docs (use annotations instead)
- Auto-generated API docs (generated from code)
- Session summaries (stored in SurrealDB)
- Activity execution logs (stored in SurrealDB)

#### 3. Documentation Generation (On-Demand)

**Approach**: Generate documentation from annotations when needed

```typescript
// Generate documentation for a module
async function generateModuleDocs(modulePath: string) {
  // 1. Get all components in module
  const components = await metabob_list_file_components({
    file_path: modulePath
  })
  
  // 2. Fetch annotations for each component
  const annotations = await Promise.all(
    components.map(c => getAnnotation(modulePath, c.name))
  )
  
  // 3. Generate markdown
  const markdown = `
# ${modulePath} Documentation

Generated: ${new Date().toISOString()}

${annotations.map(a => `
## ${a.component_name}

${a.reason}

Last Updated: ${a.created_at}
`).join('\n')}
  `
  
  // 4. Write to docs/ directory (gitignored)
  fs.writeFileSync(`docs/generated/${modulePath}.md`, markdown)
}
```

**Build Step**:
```bash
# In CI/CD or local build
npm run docs:generate

# Generates docs/ directory (gitignored)
# Serves docs via static site (e.g., Docsify, MkDocs)
# Docs always up-to-date with latest annotations
```

#### 4. Supplementary Documentation Ingestion

**For External Documentation** (e.g., architecture diagrams, design docs):

**Option A: Impulse-Based Ingestion**
```typescript
// Create impulse pointing to external doc
impulse_create({
  id: "imp_architecture_diagram",
  type: "doc",
  pointer: {
    type: "file",
    path: "docs/architecture.png",  // In gitignored docs/ dir
    description: "System architecture diagram showing microservice boundaries"
  },
  budget: 1000,
  metadata: {
    doc_type: "diagram",
    last_updated: "2026-02-10"
  }
})
```

**Option B: URL-Based Ingestion**
```typescript
// Reference external documentation
impulse_create({
  id: "imp_stripe_docs",
  type: "doc",
  pointer: {
    type: "url",
    url: "https://stripe.com/docs/webhooks",
    description: "Stripe webhook documentation (official)"
  },
  budget: 500
})
```

**Option C: Memo-Based Summary**
```typescript
// Summarize external doc as memo
impulse_create({
  id: "imp_pci_compliance",
  type: "memo",
  pointer: {
    type: "memo",
    content: `
      PCI DSS Compliance Requirements:
      1. Never store CVV codes (even encrypted)
      2. Use Stripe tokens for card data
      3. Webhook endpoints must use HTTPS
      4. Log all payment events for audit
      
      Source: PCI DSS v4.0 documentation
      Reviewed: 2026-01-10
    `
  },
  budget: 300
})
```

#### 5. Documentation Lifecycle

```
Code Implementation
    ↓
Annotation (IMMEDIATE - as part of development)
    ↓
Stored in Metabob (NOT in git)
    ↓
[Optional] Generate static docs for review (gitignored)
    ↓
Context injection when relevant (automatic)
    ↓
Code changes → annotations automatically updated
    ↓
Generated docs regenerated (always in sync)
```

### Git Strategy

**`.gitignore`**:
```
# Generated documentation (build from annotations)
docs/generated/
docs/api/
docs/modules/

# Session summaries (stored in DB)
SESSION_SUMMARY_*.md

# Activity execution logs (stored in DB)
activity-execution-*.json

# Impulse data (stored in DB)
impulse-data/

# Keep only:
# - README.md
# - ARCHITECTURE.md (high-level only)
# - API.md (contracts only)
# - CONTRIBUTING.md
```

### Benefits

1. **Always Up-to-Date**: Docs generated from code annotations
2. **Clean Git History**: No large markdown file churn
3. **Contextual**: Documentation injected ONLY when relevant
4. **Maintainable**: Update annotation → docs auto-regenerate
5. **Searchable**: Annotations indexed by Metabob
6. **Lightweight**: No bloat in repository

---

## Summary: Putting It All Together

### Data Flow Overview

```
User Intent
    ↓
Session Memory Agent (analyzes, suggests impulses)
    ↓
Impulse Creation (with intent metadata)
    ↓
[Storage Path 1] Session State (in-memory)
    ↓
[Storage Path 2] Activity Execution → Backend API → SurrealDB
    ↓
Metabob Integration (annotations, issues, CPG)
    ↓
Context Injection (ImpulseFormatter resolves pointers)
    ↓
Main Agent (receives context with intent)
    ↓
Code Changes + Annotations
    ↓
Learning Loop (SurrealDB queries: which context helped?)
    ↓
Future Sessions (recommendations based on success rate)
```

### Key Design Principles

1. **Intent is First-Class**: Captured at every level (user message, activity reason, impulse description, annotation)
2. **Storage is Distributed**: Session state (ephemeral), SurrealDB (persistent), Metabob (semantic)
3. **Documentation is Code-Adjacent**: Annotations, not files (stays in sync)
4. **Learning Loop is Automated**: Success rates tracked, recommendations generated
5. **Context is Lazy**: Loaded only when relevant, within budget constraints

### Configuration Example

**`opencode.json`** (complete context management):
```jsonc
{
  "sessionMemory": {
    "enabled": true,
    "timeout": 3000,
    "model": {
      "providerID": "anthropic",
      "modelID": "claude-3-5-haiku-20241022"
    },
    "defaultBudget": 2000,
    "maxImpulses": 5,
    "inject_annotations": true  // Include Metabob annotations
  },
  
  "mcp": {
    "metabob": {
      "enabled": true,
      "url": "http://localhost:3000",  // Metabob MCP server
      "maxIssues": 10,
      "minSeverity": "MEDIUM"
    }
  },
  
  "backend": {
    "url": "https://api.metabob.com",  // Production backend
    "impulseTracking": true            // Send impulse usage data
  }
}
```

---

## Next Steps

1. **Implement Intent Persistence**: Ensure activity `reason` flows to SurrealDB
2. **Build Learning Loop**: Query impulse success rates, generate recommendations
3. **Enhance Annotation Filtering**: Smart selection based on relevance
4. **Documentation Generation**: Build CI/CD step for generating docs from annotations
5. **Metrics Dashboard**: Visualize impulse effectiveness, context utilization

---

**End of Guide**

This comprehensive guide covers the complete context architecture from intent capture to documentation ingestion, showing how all pieces work together to create an intelligent, self-learning context management system.
