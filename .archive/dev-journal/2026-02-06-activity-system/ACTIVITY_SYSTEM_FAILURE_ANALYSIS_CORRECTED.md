# Activity System Failure Analysis: Jiggle Documentation Session (Corrected)

## Executive Summary

The metabob-opencode agent **completely bypassed its own built-in activity system** by manually creating JSON files and simulating execution. The agent should have used metabob-opencode's `activity` tool or `TemplateExecutor` to:
1. Create templates registered with Metabob backend
2. Execute activities through the proper framework
3. Enable Metabob observation and learning from real execution

---

## Understanding the Real Architecture

### metabob-opencode Activity System (Built-In)

**Location**: `repos/metabob-opencode/packages/opencode/src/session/`

**Key Components**:

1. **ActivityTemplate** (`activity-template.ts`)
   - Schema definition for templates
   - Template creation and validation
   - Integration with Metabob backend

2. **TemplateRepository** (`activity-template-repository.ts`)
   - Single source of truth: Metabob backend (SurrealDB via MCP)
   - Read-through caching (5-min TTL)
   - Functions: `list()`, `get()`, `save()`, `remove()`, `updateMetrics()`

3. **TemplateExecutor** (`template-executor.ts`)
   - Executes templates with variables
   - Tracks metrics and outcomes
   - Sends execution data to Metabob for learning

4. **TurnLifecycleHooks** (`turn-lifecycle-hooks.ts`)
   - Memory management hook runs before every turn
   - Uses `manage-session-memory` activity template
   - Negotiates context via impulse system

**Architecture Flow**:
```
Agent Request
  ↓
TemplateExecutor.execute({ templateId, variables, reason })
  ↓
TemplateRepository.get(templateId)
  ↓
Metabob Backend (SurrealDB via MCP) ← Metabob-CLI MCP Server
  ↓
Template Loaded → Execution → Metrics Tracked → Outcomes Recorded
  ↓
Metabob Observes → Learns → Improves Recommendations
```

---

## Critical Failure Points in Transcript

### Failure #1: Didn't Use Built-In Activity System

**What the agent did**:
```typescript
// Created local JSON file
await write_tool(".test-jiggle-docs/jiggle-documentation.json", JSON.stringify({
  "id": "jiggle-documentation",
  "name": "Jiggle Documentation",
  "tasks": [...]
}))
```

**What should have been done** (using metabob-opencode):
```typescript
import { ActivityTemplate } from "./session/activity-template"
import { TemplateRepository } from "./session/activity-template-repository"

// Method 1: Create template via ActivityTemplate
const template = await ActivityTemplate.create({
  name: "Jiggle Documentation",
  description: "Systematically organize documentation...",
  category: "tool",
  tasks: [
    {
      id: "scan-inventory",
      description: "Find all .md files and extract metadata",
      subagent: "general",
      prompt: {
        template: "Use glob to find all *.md files in {{doc_directory}}...",
        variables: [
          { name: "doc_directory", type: "string", required: true }
        ],
        maxTokens: 8000,
        compressionStrategy: "filter"
      },
      validation: {
        requiredFiles: [],
        requiredPatterns: [],
        commands: [
          { name: "verify", command: "ls SUMMARY.md", required: true }
        ]
      },
      retry: {
        maxAttempts: 3,
        strategy: "progressive-context"
      }
    },
    // ... more tasks
  ],
  integration: {
    postChecks: ["bun test"],
    qualityGates: [
      { name: "tests", command: "bun test", required: true }
    ]
  },
  metabob: {
    enabled: true,
    learningMode: true,
    targetContextTokens: 5000,
    annotationStrategy: "key-components"
  }
})

// Method 2: Save to Metabob backend (registers template)
await TemplateRepository.save(template)
// Now template is in SurrealDB, visible to Metabob for observation

// Method 3: Execute the template
import { TemplateExecutor } from "./session/template-executor"

const result = await TemplateExecutor.execute({
  templateId: template.id,
  variables: {
    doc_directory: "."
  },
  reason: "User wants to organize documentation by date"
})
// Execution tracked, metrics sent to Metabob, learning happens
```

**Why this matters**:
- ❌ **Local JSON files** - Not registered with Metabob, invisible to the system
- ✅ **TemplateRepository.save()** - Registers in SurrealDB via MCP, Metabob can observe
- ✅ **TemplateExecutor.execute()** - Full tracking, metrics, learning loop

---

### Failure #2: Didn't Execute Through Framework

**What the agent did**:
```typescript
// Manually called tools to simulate execution
await bash_tool("find . -name '*.md'")
await read_tool("file.md")
await edit_tool("file.md", changes)
// Created example output files
await write_tool("SUMMARY.md", "Example summary")
```

**What should have been done**:
```typescript
// Let TemplateExecutor handle the execution flow
const result = await TemplateExecutor.execute({
  templateId: "jiggle-documentation",
  variables: {
    doc_directory: "."
  },
  reason: "User wants to jiggle documentation"
})

// TemplateExecutor does:
// 1. Load template from Metabob backend
// 2. Execute each task in sequence (respecting dependencies)
// 3. Track metrics: cost, tokens, duration, success/failure
// 4. Run validation rules
// 5. Send outcomes to Metabob for learning
// 6. Return result with summary
```

**Result**:
- Agent's manual execution: Zero tracking, zero learning
- TemplateExecutor: Full metrics, Metabob observes and learns

---

### Failure #3: No Connection to Metabob Backend

**The missing link**:

```
Agent Session (metabob-opencode)
  ↓ (should use)
TemplateRepository / TemplateExecutor
  ↓ (connects to)
Metabob Backend (SurrealDB)
  ↓ (via)
Metabob-CLI MCP Server
  ↓ (observes)
Metabob Learning System
```

**What happened in transcript**:
- Agent never called TemplateRepository
- Agent never called TemplateExecutor
- Zero connection to Metabob backend
- Metabob has no idea the "execution" occurred

---

## How metabob-opencode Activity System Works

### Component: TemplateRepository

**Source**: `repos/metabob-opencode/packages/opencode/src/session/activity-template-repository.ts`

**Key Features**:
- Single source of truth: Metabob backend (SurrealDB via MCP)
- Read-through caching with 5-min TTL
- NO local file storage (prevents stale templates)
- Proper load order: Cache → Metabob backend

**Functions**:

```typescript
// List templates from Metabob backend
const templates = await TemplateRepository.list({
  category: "tool" // optional filter
})
// Returns: Array<ActivityTemplate.Schema>

// Get specific template
const template = await TemplateRepository.get("jiggle-documentation", {
  skipCache: false // use cache by default
})
// Returns: ActivityTemplate.Schema | undefined

// Save template (registers with Metabob)
await TemplateRepository.save(template)
// Saves to Metabob TemplateService AND caches in memory

// Update metrics after execution
await TemplateRepository.updateMetrics("jiggle-documentation", {
  executions: 10,
  successRate: 0.9,
  avgDuration: 5000,
  avgCost: 0.05
})
```

**What the agent should have done**:
```typescript
// 1. Create template
const template = await ActivityTemplate.create({...})

// 2. Save to Metabob backend
await TemplateRepository.save(template)

// 3. Verify it's registered
const retrieved = await TemplateRepository.get(template.id)
console.log("Template registered:", retrieved !== undefined)
```

---

### Component: TemplateExecutor

**Source**: `repos/metabob-opencode/packages/opencode/src/session/template-executor.ts`

**Key Features**:
- Executes templates with variable interpolation
- Tracks metrics per task and overall
- Handles validation and retry logic
- Records outcomes to Metabob for learning

**Usage**:

```typescript
import { TemplateExecutor } from "./session/template-executor"

const result = await TemplateExecutor.execute({
  templateId: "jiggle-documentation",
  variables: {
    doc_directory: ".",
    // ... other template variables
  },
  reason: "User wants to organize documentation by date",
  branch: "feat/jiggle-docs" // optional, creates branch if not exists
})

// result contains:
// - success: boolean
// - activityId: string
// - tasks: Array<{status, duration, cost}>
// - totalCost: number
// - totalDuration: number
```

**What happens during execution**:

1. **Load Template**: Fetch from TemplateRepository (Metabob backend)
2. **Create Activity**: Initialize Activity.Info with tracking
3. **Execute Tasks**: Run each task in dependency order
   - Interpolate prompts with variables
   - Spawn subagent sessions
   - Track cost, tokens, duration
   - Run validation after each task
4. **Validation**: Run template validation rules
   - Required files exist?
   - Required patterns present?
   - Commands pass?
5. **Record Outcome**: Send execution data to Metabob
   - Success/failure
   - Metrics (cost, duration, tokens)
   - Task-level results
6. **Update Metrics**: Update template success rate, avg cost, etc.

---

### Component: TurnLifecycleHooks

**Source**: `repos/metabob-opencode/packages/opencode/src/session/turn-lifecycle-hooks.ts`

**Memory Management Hook**:
- Runs before every turn (priority: 10)
- Uses `manage-session-memory` activity template
- Prepares context via impulse system

**How it uses activities**:

```typescript
// Hook executes automatically before each turn
TurnLifecycle.registerHook({
  name: "memory-management",
  execute: async (ctx) => {
    // Use TemplateExecutor to run memory management
    const result = await TemplateExecutor.execute({
      templateId: "manage-session-memory",
      variables: {
        userMessage: ctx.promptText,
        activityContextHints: activityContextHints
      },
      reason: `Prepare context for user message...`
    })
    
    return {
      success: result.success,
      modified: true,
      metadata: {
        activityId: result.activityId
      }
    }
  }
})
```

**Key insight**: metabob-opencode uses its own activity system internally for memory management!

---

## The Correct Workflow (What Agent Should Have Done)

### Phase 1: Template Creation

**Agent's thinking**: "User wants documentation jiggling. Let me check if a template exists, then create one if not."

```typescript
// Step 1: Check for existing templates
import { TemplateRepository } from "./session/activity-template-repository"

const existing = await TemplateRepository.list({
  category: "tool"
})

// Search for similar templates
const similar = existing.filter(t => 
  t.name.toLowerCase().includes("doc") ||
  t.description.toLowerCase().includes("documentation")
)

if (similar.length > 0) {
  // Found existing template, maybe adapt it
  console.log("Found similar templates:", similar.map(t => t.name))
} else {
  // Create new template
  import { ActivityTemplate } from "./session/activity-template"
  
  const template = await ActivityTemplate.create({
    name: "Jiggle Documentation",
    description: "Systematically organize documentation by sorting by date, percolating newer details backwards into older related docs, and deleting obsolete files.",
    category: "tool",
    tasks: [
      {
        id: "scan-inventory",
        subagent: "general",
        description: "Scan and inventory all documentation files",
        dependencies: [],
        prompt: {
          template: `Use glob to find all *.md files in {{doc_directory}}.
For each file:
- Extract file path
- Get last modified date (stat command)
- Get file size
- Extract first 100 chars as header

Output JSON:
{
  "total_files": <count>,
  "file_list": [
    {"path": "...", "modified": "...", "size": ..., "header": "..."}
  ]
}`,
          maxTokens: 8000,
          compressionStrategy: "filter",
          variables: [
            {
              name: "doc_directory",
              type: "string",
              required: true,
              description: "Root directory containing documentation"
            }
          ]
        },
        validation: {
          requiredFiles: [],
          requiredPatterns: [],
          forbiddenPatterns: [],
          commands: []
        },
        retry: {
          maxAttempts: 2,
          strategy: "simple"
        }
      },
      {
        id: "analyze-relationships",
        subagent: "general",
        description: "Analyze content relationships between docs",
        dependencies: ["scan-inventory"],
        prompt: {
          template: `Read file contents from scan results.
Identify relationships:
- Cross-references (links between files)
- Topic overlap (similar content)
- Duplicate content
- Superseded relationships (older → newer)

Build relationship graph as JSON.`,
          maxTokens: 12000,
          compressionStrategy: "filter",
          variables: []
        }
      },
      {
        id: "percolate-updates",
        subagent: "general",
        description: "Percolate details from newer to older docs",
        dependencies: ["analyze-relationships"],
        prompt: {
          template: `For each pair of related docs where newer has more detail:
- Use StrReplace to add newer content to older doc
- Include attribution: "Updated from [newer-file] on [date]"
- Preserve original structure

Only update if:
- Clear relationship exists
- Newer doc adds meaningful detail
- Won't create confusion`,
          maxTokens: 15000,
          compressionStrategy: "adaptive",
          variables: []
        }
      },
      {
        id: "delete-obsolete",
        subagent: "general",
        description: "Delete obsolete documents",
        dependencies: ["percolate-updates"],
        prompt: {
          template: `For docs marked as obsolete (content fully merged):
- Use bash rm to delete them
- Log each deletion with reason

Only delete if:
- Content is fully preserved elsewhere
- No unique information lost
- User confirmed (via message)`,
          maxTokens: 8000,
          compressionStrategy: "filter",
          variables: []
        }
      },
      {
        id: "generate-summary",
        subagent: "general",
        description: "Generate summary report",
        dependencies: ["delete-obsolete"],
        prompt: {
          template: `Write SUMMARY.md with:
- Files updated (count and list)
- Files deleted (count and list)
- Relationships found (count)
- Time saved (estimate)

Format: Markdown, clear sections, concise.`,
          maxTokens: 5000,
          compressionStrategy: "filter",
          variables: []
        },
        validation: {
          requiredFiles: ["SUMMARY.md"],
          requiredPatterns: ["Files updated:", "Files deleted:"],
          forbiddenPatterns: [],
          commands: [
            {
              name: "verify-summary",
              command: "test -f SUMMARY.md",
              required: true
            }
          ]
        }
      }
    ],
    integration: {
      preChecks: [],
      postChecks: ["test -f SUMMARY.md"],
      qualityGates: [
        {
          name: "summary-exists",
          command: "test -f SUMMARY.md",
          required: true
        }
      ]
    },
    metabob: {
      enabled: true,
      learningMode: true,
      targetContextTokens: 5000,
      annotationStrategy: "key-components"
    }
  })
  
  // Save to Metabob backend
  await TemplateRepository.save(template)
  
  console.log("Template created and registered:", template.id)
}
```

### Phase 2: Template Execution

**Agent executes the template** (not manual tool calling!):

```typescript
import { TemplateExecutor } from "./session/template-executor"

// Execute the template
const result = await TemplateExecutor.execute({
  templateId: "jiggle-documentation",
  variables: {
    doc_directory: "."
  },
  reason: "User wants to organize documentation by date, percolate details, and remove obsolete docs",
  branch: "feat/jiggle-docs" // optional
})

// TemplateExecutor handles:
// 1. Loading template from Metabob backend
// 2. Creating activity tracking
// 3. Executing each task in sequence
// 4. Running validation after completion
// 5. Recording outcomes to Metabob
// 6. Updating template metrics

if (result.success) {
  console.log("Activity completed successfully!")
  console.log("Activity ID:", result.activityId)
  console.log("Total cost:", result.totalCost)
  console.log("Total duration:", result.totalDuration)
  console.log("Tasks completed:", result.tasks.length)
} else {
  console.log("Activity failed:", result.error)
}
```

### Phase 3: Metabob Observation & Learning

**What happens automatically**:

```
1. TemplateExecutor.execute()
   → Creates ActivityExecution
   → Tracks metrics per task
   
2. After each task:
   → Record cost, tokens, duration
   → Record success/failure
   → Store in Activity.Info
   
3. After validation:
   → Record overall outcome
   → Calculate success rate
   → Update template metrics
   
4. Send to Metabob backend:
   → POST /activity-executions
   → Includes: success, cost, duration, task results
   → Metabob analyzes patterns
   
5. Metabob learning:
   → Aggregate metrics across executions
   → Identify common failure modes
   → Optimize prompts and budgets
   → Improve recommendations
```

**Result**: Metabob learns from real execution, improves future template selections and optimizations.

---

## Why This Architecture Matters

### Separation of Concerns

**metabob-opencode** (Agent execution environment):
- Activity templates (structure, prompts, validation)
- Template execution (spawning agents, tracking metrics)
- Template repository (caching, loading from backend)

**metabob-cli MCP** (Backend interface):
- Activity management CRUD (create, read, update, delete)
- Template storage (SurrealDB)
- Execution tracking (outcomes, metrics)

**metabob-rpc-api** (Learning system):
- Activity recommendations (Thompson Sampling)
- Execution analysis (patterns, failures)
- Template optimization (prompt tuning, budget optimization)

### Learning Loop

```
Developer creates template
  ↓
Template registered in Metabob backend
  ↓
Agent executes template
  ↓
Metrics tracked (cost, duration, success)
  ↓
Outcomes sent to Metabob
  ↓
Metabob analyzes patterns
  ↓
Recommendations improved
  ↓
Future executions benefit
```

**Without proper execution**: Loop broken, zero learning occurs.

---

## Correct Agent Instructions

### For metabob-opencode Agent

**When user requests multi-step workflow**:

1. **Check for existing templates**:
   ```typescript
   const templates = await TemplateRepository.list()
   ```

2. **If template exists, execute it**:
   ```typescript
   const result = await TemplateExecutor.execute({
     templateId: "template-name",
     variables: {...},
     reason: "User's request"
   })
   ```

3. **If no template, create one**:
   ```typescript
   const template = await ActivityTemplate.create({...})
   await TemplateRepository.save(template)
   ```

4. **Then execute the new template**:
   ```typescript
   const result = await TemplateExecutor.execute({...})
   ```

**NEVER**:
- ❌ Create JSON files manually
- ❌ Execute tools manually to "simulate" activity
- ❌ Bypass TemplateExecutor
- ❌ Skip TemplateRepository.save()

**ALWAYS**:
- ✅ Use TemplateRepository for template management
- ✅ Use TemplateExecutor for execution
- ✅ Let Metabob observe and learn
- ✅ Trust the built-in activity system

---

## Metabob's Role: The Coach

**Metabob observes**:
- Which templates are executed
- Which tasks succeed/fail
- What the costs and durations are
- What patterns emerge

**Metabob identifies weak points**:
- Tasks with low success rates
- Tasks that exceed budget frequently
- Validation rules that fail often
- Prompts that need improvement

**Metabob improves**:
- Recommends better templates
- Suggests prompt optimizations
- Adjusts token budgets
- Evolves templates based on real data

**The goal**: Limit agent activities to tested, optimized patterns that Metabob has learned work well.

---

## Summary of Failures

### What Went Wrong

1. **Agent didn't know about metabob-opencode's activity system**
   - Thought it needed to create JSON files
   - Didn't use TemplateRepository or TemplateExecutor

2. **Agent bypassed the learning loop**
   - Manual tool execution = zero tracking
   - Metabob has no data to learn from

3. **Agent simulated instead of executed**
   - Created example files
   - No real validation
   - No metrics recorded

### What Should Have Happened

1. **Agent uses built-in activity system**:
   ```typescript
   // Create template
   const template = await ActivityTemplate.create({...})
   await TemplateRepository.save(template)
   
   // Execute template
   const result = await TemplateExecutor.execute({...})
   ```

2. **Metabob observes execution**:
   - Metrics tracked automatically
   - Outcomes sent to backend
   - Learning happens

3. **Real validation and outcomes**:
   - Validation rules run
   - Success/failure recorded
   - Template metrics updated

### The Fix

**Update agent instructions** to emphasize:
- metabob-opencode HAS a built-in activity system
- ALWAYS use TemplateRepository and TemplateExecutor
- NEVER create JSON files manually
- Let Metabob observe and learn from real executions
