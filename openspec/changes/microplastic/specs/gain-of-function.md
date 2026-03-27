# Gain-of-Function Specification

## Overview

The defining characteristic of microplastic is that it **gains capabilities through use**. Unlike traditional tools that ship with fixed features, microplastic starts minimal and evolves as it succeeds at tasks.

This spec defines the four pathways through which capabilities emerge.

## The Gain-of-Function Cycle

```
┌─────────────────────────────────────────────────────────────────┐
│                     GAIN-OF-FUNCTION CYCLE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [1. GOAL]                                                       │
│      │                                                          │
│      ▼                                                          │
│  [2. SEARCH] ─────────────────────────────────────────┐         │
│      │                                                 │         │
│      │ (template found)                    (no match)  │         │
│      ▼                                                 ▼         │
│  [3. EXECUTE]                              [3a. IMPROVISE]       │
│      │                                                 │         │
│      ▼                                                 ▼         │
│  [4. TRACE]                                [4. TRACE]           │
│      │                                                 │         │
│      │ (success)                           (success)   │         │
│      ▼                                                 ▼         │
│  [5. LEARN]                               [5a. EXTRACT]         │
│      │                                                 │         │
│      └─────────────────────────────────────────────────┤         │
│                                                        │         │
│                                                        ▼         │
│                                               [6. REGISTER]      │
│                                                        │         │
│                                                        ▼         │
│                                               [LOOP BACK TO 2]   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Pathway 1: Ribosome Extraction

### What It Is

When microplastic improvises (executes a goal without a template) and succeeds, the **ribosome** analyzes the execution trace and extracts a reusable activity template.

### Trigger

- Improvisation execution completes
- All validation passes
- Goal verification succeeds (LLM confirms goal achieved)

### Process

1. **Trace Analysis**
   ```typescript
   // Ribosome receives the improvisation trace
   const trace: ImprovisationTrace = {
     goal: "Implement GraphQL subscriptions",
     steps: [
       { tool: "read_file", params: { path: "src/schema.ts" }, result: "..." },
       { tool: "llm_generate", prompt: "...", result: "..." },
       { tool: "write_file", params: { path: "src/subscriptions.ts" }, result: "..." },
       { tool: "bash", params: { command: "bun test" }, result: "PASS" }
     ],
     reasoning: [
       "Analyzed existing schema structure",
       "Generated subscription resolvers",
       "Created subscription type definitions",
       "Validated with tests"
     ],
     outcome: { success: true, validation: "tests pass" }
   }
   ```

2. **Pattern Detection**
   ```typescript
   // Ribosome identifies the pattern
   const pattern = {
     inputShape: ["source_code:schema", "goal:feature_request"],
     outputShape: ["file:new_module", "test_result:passing"],
     toolSequence: ["read_file", "llm_generate", "write_file", "bash:test"],
     variablePoints: [
       { location: "read_file.path", abstract: "schema_file" },
       { location: "write_file.path", abstract: "output_file" }
     ]
   }
   ```

3. **Template Generation**
   ```typescript
   // Ribosome creates a new template
   const template: ActivityTemplate = {
     id: "implement-graphql-subscriptions-v1",
     name: "Implement GraphQL Subscriptions",
     description: "Add subscription support to GraphQL schema",
     category: "feature",

     // Input schema inferred from trace
     inputSchema: {
       required: [
         { shape: "source_code", description: "GraphQL schema file" },
         { shape: "goal", description: "Feature request" }
       ]
     },

     // Tasks extracted from step sequence
     tasks: [
       {
         id: "analyze-schema",
         description: "Analyze existing GraphQL schema",
         prompt: {
           template: "Analyze the GraphQL schema at {{schema_file}} to understand the data model for subscriptions.",
           variables: [{ name: "schema_file", type: "string", required: true }]
         }
       },
       {
         id: "generate-subscriptions",
         description: "Generate subscription resolvers",
         prompt: {
           template: "Based on the schema analysis, generate subscription resolvers for {{subscription_types}}.",
           variables: [{ name: "subscription_types", type: "array", required: true }]
         }
       },
       {
         id: "create-module",
         description: "Create subscription module",
         prompt: {
           template: "Write the subscription module to {{output_file}}.",
           variables: [{ name: "output_file", type: "string", required: true }]
         }
       },
       {
         id: "validate",
         description: "Run tests to validate",
         validation: {
           commands: [{ command: "bun test", expectedOutput: "PASS" }]
         }
       }
     ],

     // Metadata for tracking
     metadata: {
       generatedFrom: "execution",
       sourceExecutionId: "imp-abc123",
       createdAt: Date.now(),
       firstExecutionMetrics: {
         duration: 45000,
         cost: 0.12,
         tokens: { input: 8000, output: 2000 },
         status: "success"
       }
     }
   }
   ```

4. **Registration**
   - Template registered with alpha=1, beta=0 (initial Thompson state)
   - Available for future goal matching
   - If backend available: synced for cross-session learning

### Configuration

```typescript
interface RibosomeConfig {
  /** Minimum confidence to extract (0.0 - 1.0) */
  minConfidence: number  // default: 0.7

  /** Maximum template complexity (task count) */
  maxTemplateComplexity: number  // default: 10

  /** Whether to auto-register extracted templates */
  autoRegister: boolean  // default: true

  /** Whether to prompt user before registration */
  promptBeforeRegister: boolean  // default: false
}
```

### Acceptance Criteria

- Extraction happens automatically on successful improvisation
- Generated templates are valid (pass template validation)
- Templates include all necessary variables
- Source execution is tracked in metadata

---

## Pathway 2: Improvisation (Exploration)

### What It Is

When no template matches a goal, microplastic uses the LLM to figure out how to accomplish it. This is the "exploration" phase that generates data for learning.

### Trigger

- Goal submitted
- Thompson Sampling returns no templates with confidence > threshold (default: 0.3)

### Process

1. **LLM-Guided Exploration**
   ```typescript
   // Goal processor enters improvisation mode
   const improvisation = await goalProcessor.improvise({
     goal: enrichedGoal,
     context: {
       workspaceStructure: await explorer.analyze(workdir),
       availableTools: tools.getDefinitions(),
       previousAttempts: history.getFailures(enrichedGoal.intent)
     }
   })
   ```

2. **Constrained Tool Use**
   - LLM has access to all tools (read, write, edit, bash, etc.)
   - Each tool call is recorded
   - Tool calls are validated before execution
   - Dangerous operations require confirmation

3. **Reasoning Recording**
   ```typescript
   // Every decision point is recorded
   improvisation.recordReasoning(
     "No existing template for GraphQL subscriptions. "
     + "I'll analyze the schema first to understand the data model."
   )
   ```

4. **Validation Before Completion**
   - Even improvisation must pass validation
   - If validation fails, improvisation is marked failed
   - Failed improvisations are NOT extracted by ribosome

### Configuration

```typescript
interface ImprovisationConfig {
  /** Maximum tool calls before forcing completion */
  maxToolCalls: number  // default: 50

  /** Maximum cost before forcing completion */
  maxCost: number  // default: 1.0 (USD)

  /** Whether to require user confirmation for dangerous operations */
  confirmDangerous: boolean  // default: true

  /** Dangerous operation patterns */
  dangerousPatterns: string[]  // default: ["rm -rf", "DROP TABLE", etc.]
}
```

### Acceptance Criteria

- Improvisation has clear bounds (cost, time, tool calls)
- All steps are recorded for potential extraction
- Failed improvisations contribute to negative learning
- User can abort at any time

---

## Pathway 3: Composition (Activity Chaining)

### What It Is

When activities are executed in sequence toward a larger goal, the system learns **composition patterns**. These patterns suggest what activity to run next based on what just completed.

### Trigger

- Activity completes successfully
- User immediately submits another goal that matches a pattern

### Process

1. **Pattern Detection**
   ```typescript
   // After "fix-bug" succeeds
   // User immediately asks to "add tests for the fix"

   compositionObserver.record({
     predecessor: "fix-bug",
     successor: "add-test-coverage",
     context: {
       filesModified: ["src/auth.ts"],
       goalRelation: "follow-up"
     }
   })
   ```

2. **Pattern Learning**
   ```typescript
   // Over time, patterns emerge
   const patterns = compositionObserver.getPatterns()
   // [
   //   { predecessor: "fix-bug", successor: "add-test-coverage", frequency: 78%, confidence: 0.85 },
   //   { predecessor: "implement-feature", successor: "write-docs", frequency: 45%, confidence: 0.62 },
   //   { predecessor: "implement-feature", successor: "add-tests", frequency: 35%, confidence: 0.58 }
   // ]
   ```

3. **Proactive Suggestion**
   ```
   ┌─────────────────────────────────────────────────────────┐
   │ [Complete] ✓ Bug fixed                                  │
   │                                                         │
   │ Based on common patterns, you might want to:            │
   │   1. Add tests for this fix (78% do this next)          │
   │   2. Update documentation                               │
   │                                                         │
   │ > _                                                     │
   └─────────────────────────────────────────────────────────┘
   ```

### Data Model

```typescript
interface CompositionPattern {
  /** Activity that completed */
  predecessorId: string

  /** Activity that typically follows */
  successorId: string

  /** How often this sequence occurs */
  frequency: number

  /** Confidence in the pattern (based on sample size) */
  confidence: number

  /** Context signals that strengthen the pattern */
  contextSignals: {
    fileTypes?: string[]  // e.g., pattern stronger for .ts files
    goalCategories?: string[]  // e.g., pattern stronger for bugfixes
    timeOfDay?: string[]  // e.g., pattern stronger in morning
  }
}
```

### Acceptance Criteria

- Patterns emerge after sufficient executions (min: 5)
- Suggestions are non-intrusive (shown but not forced)
- User can dismiss suggestions
- Patterns decay if not reinforced

---

## Pathway 4: Manual Template Creation

### What It Is

Power users can create templates directly using the `/template create` command or by editing template files.

### Trigger

- User runs `/template create`
- User edits `.microplastic/templates/*.json`

### Process

1. **Interactive Creation**
   ```
   /template create

   ┌─────────────────────────────────────────────────────────┐
   │ [Creating new template]                                 │
   │                                                         │
   │ Template ID: _                                          │
   │ (e.g., "deploy-to-staging")                             │
   └─────────────────────────────────────────────────────────┘
   ```

2. **Validation**
   - All manually created templates must pass validation
   - Template validator checks:
     - Required fields present
     - Task prompts have valid variable references
     - Validation rules are well-formed

3. **Testing**
   - User can test template before registration
   - `/template test <id>` runs template in dry-run mode

### Template File Format

```json
{
  "id": "deploy-to-staging",
  "name": "Deploy to Staging",
  "description": "Deploy the current branch to staging environment",
  "category": "infrastructure",
  "inputSchema": {
    "required": [
      { "shape": "git_branch", "description": "Branch to deploy" }
    ]
  },
  "tasks": [
    {
      "id": "verify-tests",
      "description": "Ensure all tests pass before deploy",
      "prompt": {
        "template": "Run the test suite and verify all tests pass.",
        "variables": []
      },
      "validation": {
        "commands": [{ "command": "bun test" }]
      }
    },
    {
      "id": "deploy",
      "description": "Deploy to staging",
      "prompt": {
        "template": "Deploy branch {{branch}} to staging using the deploy script.",
        "variables": [{ "name": "branch", "type": "string", "required": true }]
      }
    }
  ]
}
```

### Acceptance Criteria

- Manual templates are validated before registration
- Templates can be tested before use
- Templates are stored in user-accessible location
- Manual templates have same capabilities as extracted ones

---

## Thompson Sampling Integration

### How Templates Are Ranked

Each template has a Thompson Sampling state:

```typescript
interface ThompsonState {
  /** Successes + 1 (prior) */
  alpha: number

  /** Failures + 1 (prior) */
  beta: number
}
```

### Selection Algorithm

1. **Sample from Beta Distribution**
   ```typescript
   function thompsonSample(state: ThompsonState): number {
     // Sample from Beta(alpha, beta) distribution
     return betaDistribution.sample(state.alpha, state.beta)
   }
   ```

2. **Rank by Sample**
   ```typescript
   function selectTemplate(candidates: TemplateCandidate[]): ActivityTemplate {
     const scored = candidates.map(c => ({
       template: c.template,
       score: thompsonSample(c.thompsonState)
     }))

     // Sort by score descending
     scored.sort((a, b) => b.score - a.score)

     // Return top template
     return scored[0].template
   }
   ```

3. **Update on Outcome**
   ```typescript
   function updateThompson(templateId: string, success: boolean): void {
     const state = getThompsonState(templateId)

     if (success) {
       state.alpha += 1
     } else {
       state.beta += 1
     }

     saveThompsonState(templateId, state)
   }
   ```

### Why Thompson Sampling?

- **Balances exploration vs exploitation**: New templates get tried, proven ones get used
- **Natural uncertainty**: Templates with few runs have high variance = exploration
- **Converges to best**: Over time, best template dominates
- **No manual tuning**: No "exploration rate" parameter to configure

### Configuration

```typescript
interface ThompsonConfig {
  /** Minimum confidence to use template (0.0 - 1.0) */
  minConfidence: number  // default: 0.3

  /** Prior for new templates (alpha=1, beta=1 = uniform) */
  prior: { alpha: number; beta: number }  // default: { alpha: 1, beta: 1 }

  /** Decay factor for old data (optional) */
  decayFactor?: number  // default: none (no decay)
}
```

---

## Pattern Extraction

### Tool Sequence Patterns

```typescript
interface ToolSequencePattern {
  /** Sequence of tools used */
  sequence: string[]

  /** How often this sequence appears */
  frequency: number

  /** Success rate when this sequence is used */
  successRate: number

  /** Context where pattern is most effective */
  effectiveContext: {
    goalCategories: string[]
    fileTypes: string[]
  }
}
```

### Impulse Relevance Patterns

```typescript
interface ImpulseRelevancePattern {
  /** Activity variant */
  activityVariantId: string

  /** Impulse shape */
  impulseShape: string

  /** Relevance metrics */
  metrics: {
    timesLoaded: number
    successWhenLoaded: number
    failureWhenLoaded: number
    successWhenNotLoaded: number
    failureWhenNotLoaded: number
  }

  /** Computed relevance score */
  relevanceScore: number
}
```

### Learning from Patterns

Patterns are used to:

1. **Optimize impulse loading**: Load high-relevance impulses first
2. **Suggest tool sequences**: If pattern "read → analyze → edit → test" has 90% success, suggest it
3. **Prune templates**: Templates with consistently low success get demoted
4. **Guide improvisation**: Successful patterns inform LLM exploration

---

## Metrics and Observability

### Gain-of-Function Metrics

| Metric | Description |
|--------|-------------|
| `templates_total` | Total templates (bootstrap + extracted + manual) |
| `templates_extracted` | Templates extracted via ribosome |
| `improvisation_rate` | % of goals that required improvisation |
| `extraction_success_rate` | % of improvisations that produced valid templates |
| `thompson_selections` | Which templates are being selected |
| `pattern_frequency` | How often composition patterns fire |

### Dashboard Integration

If activity-dashboard is available, metrics are pushed for visualization:

```typescript
interface GainOfFunctionDashboard {
  /** Template creation over time */
  templateGrowth: TimeseriesData

  /** Improvisation rate over time (should decrease) */
  improvisationRate: TimeseriesData

  /** Top templates by selection count */
  topTemplates: RankedList

  /** Recent extractions */
  recentExtractions: ExtractionLog[]
}
```

---

## Success Criteria

1. **Capability Growth**: After 50 goals, at least 10 templates extracted
2. **Improvisation Reduction**: Improvisation rate decreases over time
3. **Template Quality**: Extracted templates have >70% success rate
4. **Learning Visible**: User can see what capabilities emerged
5. **Graceful Degradation**: Works offline, just slower learning
