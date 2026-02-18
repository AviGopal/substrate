# Impulse System Architecture

## Overview

The activity/impulse system has **two distinct levels** that work together:

1. **Activity Level**: `contextRequirements` - Defines what impulses to CREATE
2. **Task Level**: `impulse_refs` - Defines which impulses each task USES

## Two-Level Architecture

```
Activity Template (JSON)
│
├── contextRequirements[] ──────────┐  LEVEL 1: What to create
│   ├── key: "exampleCode"         │
│   ├── hint: "Search for examples"│
│   ├── impulseTypes: ["file"]     │
│   ├── budgetRange: [2000, 4000]  │
│   └── required: true             │
│                                   │
└── tasks[]                         │
    └── task                        │
        ├── id: "implement"         │
        └── impulse_refs[] ─────────┘  LEVEL 2: What to use
            ├── impulse_id: "exampleCode"  (references key above)
            ├── priority: "HIGH"
            └── required: true
```

## Level 1: Context Requirements (Activity-Level)

**Purpose**: Define impulses that the **Memory Agent** should create before activity starts

**Location**: Top-level in activity template JSON

**Schema**:
```typescript
interface ContextRequirement {
  key: string;                    // Unique impulse identifier
  hint: string;                   // Instructions for Memory Agent on how to load
  impulseTypes: ImpulseType[];    // Types of data to load
  required: boolean;              // Whether activity fails if impulse can't be created
  budgetRange: [number, number];  // Min and max token budget
}

type ImpulseType = 
  | "file"                 // Load file from disk
  | "bashOutput"           // Run bash command
  | "toolOutput"           // Use tool (search_activities, etc.)
  | "memo"                 // Static text content
  | "metabobAnnotation"    // Load Metabob annotations
  | "metabobResolution";   // Load past bug resolutions
```

**Example**:
```json
{
  "contextRequirements": [
    {
      "key": "existingExamples",
      "hint": "Use search_activities({ category: \"feature\", verbose: true }) to find 3 high-quality feature templates",
      "impulseTypes": ["toolOutput", "memo"],
      "required": true,
      "budgetRange": [3000, 6000]
    },
    {
      "key": "projectStructure",
      "hint": "Load README.md and package.json to understand project conventions",
      "impulseTypes": ["file"],
      "required": false,
      "budgetRange": [1000, 2000]
    }
  ]
}
```

**What Happens**:
1. Memory Agent reads `contextRequirements`
2. For each requirement, it executes the `hint` (runs tool, loads file, etc.)
3. Creates impulse with `key` as the ID
4. Stores impulse content with budget limits
5. Makes impulses available to tasks

## Level 2: Impulse Refs (Task-Level)

**Purpose**: Declare which pre-loaded impulses each task needs

**Location**: Inside each task in `tasks[]` array

**Schema**:
```typescript
interface ImpulseRef {
  impulse_id: string;     // References contextRequirements[].key
  priority: "HIGH" | "MEDIUM" | "LOW";  // Uppercase enum
  required: boolean;      // Whether task fails if impulse unavailable
}
```

**Example**:
```json
{
  "tasks": [
    {
      "id": "design-feature",
      "subagent": "general",
      "description": "Design feature architecture",
      "impulse_refs": [
        {
          "impulse_id": "existingExamples",
          "priority": "HIGH",
          "required": true
        },
        {
          "impulse_id": "projectStructure",
          "priority": "MEDIUM",
          "required": false
        }
      ],
      "prompt": {
        "template": "Design the feature. Review examples from context.",
        "maxTokens": 8000
      }
    }
  ]
}
```

**What Happens**:
1. Before task execution, Activity Manager checks `impulse_refs`
2. Loads referenced impulses from memory
3. Injects impulse content into agent's context (automatically)
4. Agent can reference impulses in its reasoning
5. Compression applied if over budget (filter/summary/sample)

## Data Flow

```
┌─────────────────┐
│ Memory Agent    │  1. Read contextRequirements
│                 │  2. Execute hints (load files, run tools)
│                 │  3. Create impulses with budget limits
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Impulse Store   │  4. Store impulses by key
│ (Session Memory)│     - key: impulse_id
└────────┬────────┘     - content: loaded data
         │              - budget: token limit
         │
         ▼
┌─────────────────┐
│ Activity Mgr    │  5. Before each task:
│                 │     - Read task.impulse_refs[]
│                 │     - Load referenced impulses
│                 │     - Apply compression if needed
│                 │     - Inject into agent context
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Task Agent      │  6. Execute with enriched context
│                 │     - Impulse content available
│                 │     - Can reference past work
│                 │     - Learns from examples
└─────────────────┘
```

## Backend API Schema (What Gets Registered)

When registering templates with Metabob backend, the schema is slightly different:

**Activity Level**: No `contextRequirements` field in backend  
**Task Level**: Uses `impulse_refs` within each `task_steps[]` entry

**Backend Task Structure**:
```json
{
  "task_steps": [
    {
      "id": "task-1",
      "subagent": "general",
      "description": "Task description",
      "dependencies": [],
      "guidance": [],
      "impulse_refs": [
        {
          "impulse_id": "someImpulse",
          "priority": "MEDIUM",
          "required": false
        }
      ],
      "prompt": {
        "template": "...",
        "max_tokens": 8000,
        "compression_strategy": "adaptive",
        "variables": ["var1", "var2"]
      },
      "validation": { ... },
      "retry": { ... }
    }
  ]
}
```

**Key Differences**:
- Backend: `task_steps` (not `tasks`)
- Backend: `max_tokens` (not `maxTokens`)
- Backend: `compression_strategy` (not `compressionStrategy`)
- Backend: Variables are string array (not typed objects)

## Common Mistakes

### ❌ Wrong: Using `impulsePreload` at task level
```json
{
  "tasks": [
    {
      "id": "task-1",
      "impulsePreload": [  // ❌ Wrong field name
        {
          "id": "example",
          "pointer": { "type": "file", "path": "x.md" },
          "budget": 2000
        }
      ]
    }
  ]
}
```

### ✅ Correct: Using `impulse_refs` to reference `contextRequirements`
```json
{
  "contextRequirements": [
    {
      "key": "example",
      "hint": "Load x.md",
      "impulseTypes": ["file"],
      "budgetRange": [1500, 3000]
    }
  ],
  "tasks": [
    {
      "id": "task-1",
      "impulse_refs": [  // ✅ Correct field name
        {
          "impulse_id": "example",  // ✅ References key above
          "priority": "HIGH",
          "required": true
        }
      ]
    }
  ]
}
```

### ❌ Wrong: Lowercase priority
```json
{
  "impulse_refs": [
    {
      "impulse_id": "example",
      "priority": "high"  // ❌ Wrong - must be uppercase
    }
  ]
}
```

### ✅ Correct: Uppercase priority enum
```json
{
  "impulse_refs": [
    {
      "impulse_id": "example",
      "priority": "HIGH"  // ✅ Correct - uppercase enum
    }
  ]
}
```

## Use Cases

### Use Case 1: Chain Task Outputs
```json
{
  "contextRequirements": [
    {
      "key": "designDoc",
      "hint": "Load output from design task: FEATURE_DESIGN.md",
      "impulseTypes": ["file"],
      "budgetRange": [3000, 5000]
    }
  ],
  "tasks": [
    {
      "id": "design",
      "impulse_refs": []
    },
    {
      "id": "implement",
      "dependencies": ["design"],
      "impulse_refs": [
        {
          "impulse_id": "designDoc",
          "priority": "HIGH",
          "required": true
        }
      ]
    }
  ]
}
```

### Use Case 2: Provide Examples
```json
{
  "contextRequirements": [
    {
      "key": "qualityExamples",
      "hint": "search_activities({ category: \"bugfix\", verbose: true })",
      "impulseTypes": ["toolOutput"],
      "budgetRange": [4000, 8000]
    }
  ],
  "tasks": [
    {
      "id": "fix-bug",
      "impulse_refs": [
        {
          "impulse_id": "qualityExamples",
          "priority": "MEDIUM",
          "required": false
        }
      ]
    }
  ]
}
```

### Use Case 3: Metabob Context
```json
{
  "contextRequirements": [
    {
      "key": "pastResolutions",
      "hint": "metabob_search_codebase_issues({ query: \"authentication bug\" })",
      "impulseTypes": ["metabobResolution"],
      "budgetRange": [2000, 4000]
    }
  ],
  "tasks": [
    {
      "id": "analyze-bug",
      "impulse_refs": [
        {
          "impulse_id": "pastResolutions",
          "priority": "HIGH",
          "required": false
        }
      ]
    }
  ]
}
```

## Summary

**Two-Level System**:
1. **contextRequirements**: What impulses to CREATE (activity-level)
2. **impulse_refs**: What impulses to USE (task-level)

**Key Rules**:
- `impulse_refs[].impulse_id` must reference a `contextRequirements[].key`
- Priority is uppercase enum: "HIGH" | "MEDIUM" | "LOW"
- Backend uses `impulse_refs` (not `impulsePreload`)
- Memory Agent handles creation, Activity Manager handles injection

**Benefits**:
- Tasks get relevant context automatically
- Reduces token usage (pre-load vs re-search)
- Enables learning from past work
- Supports complex data flows
- Compression applied intelligently

---

**Status**: Documented for template authors and enhancement workflows
