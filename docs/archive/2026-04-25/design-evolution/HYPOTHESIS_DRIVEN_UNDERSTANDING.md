# Hypothesis-Driven Codebase Understanding

## Core Insight
**Activities ARE the hypotheses.** When MiniBob explores a codebase, it creates activities that represent testable hypotheses about how the code works. Executing these activities tests the hypotheses. The traces and validators determine if the hypothesis was correct.

## The Hypothesis-Instrumentation Duality

```
Activity = Hypothesis + Instrumentation

Hypothesis: "Rate limiter uses Redis for state storage"
    ↓
Activity with validators:
    - requiredPatterns: ["import.*redis", "RedisClient"]
    - forbiddenPatterns: ["Map<", "in-memory"]
    ↓
Execute activity (run instrumentation)
    ↓
Trace captures observations
    ↓
Validators compare expectations vs observations
    ↓
Success = Hypothesis confirmed
Failure = Hypothesis refuted or code needs alignment
```

## Goals (Restated)

1. **Quick Codebase Understanding**
   - Generate hypothesis activities that explore wiring, data flow, intent
   - Execute activities to validate hypotheses
   - Build knowledge graph from confirmed hypotheses

2. **Instrumentation**
   - Activities themselves are the instrumentation
   - Validators define expectations
   - Traces capture observations
   - Comparison determines alignment

3. **Differential Alignment**
   - If validator fails + code is correct → Update validator (align expectations to reality)
   - If validator fails + code is wrong → Fix code (align reality to expectations)
   - Decision based on: assigned goals, past goals, user intent, success patterns

4. **Use Existing Infrastructure**
   - No new database tables
   - No new impulse types (use existing ones)
   - No new storage patterns
   - Activities, traces, validators, Thompson Sampling

## Architecture Using New Paradigm Tables

### Current Infrastructure (Schema-Paradigm-Alignment)

```
┌─────────────────────────────────────────────────────────────┐
│  New Paradigm Schema (020-paradigm-core-tables.surql)        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. impulse table                                             │
│     - All data with pointers and shapes                      │
│     - Shapes: 'goal', 'source_code', 'error', 'trace'       │
│     - Pointer types: file, memo, trace, activity            │
│     - Resolvers live where data lives                        │
│                                                               │
│  2. activity table                                            │
│     - All state transitions (templates, tools, compositions) │
│     - input_shapes[] → output_shapes[] for matching         │
│     - execution_type: 'template', 'tool', 'composition'     │
│     - Tasks with validators (expectations)                   │
│                                                               │
│  3. execution table                                           │
│     - All traces linking inputs to outputs                   │
│     - input_impulses[] → activity → output_impulses[]       │
│     - Captures observations (state transitions)              │
│     - Validator results (pass/fail)                          │
│                                                               │
│  4. vessel table                                              │
│     - Execution environments (MiniBob instances)             │
│     - Resolver capabilities (what impulse types it handles)  │
│     - MiniBob is the hypothesis-testing vessel               │
│                                                               │
│  5. Learning Loop (Already Implemented)                       │
│     - Thompson Sampling for activity selection               │
│     - Ribosome pattern for extraction                        │
│     - Trailblazing for variants                              │
│                                                               │
│  6. metabob-analysis-api (Code Understanding)                 │
│     - CPG indexing and graph traversal                       │
│     - Semantic search                                         │
│     - Co-change prediction                                    │
│     - Impact analysis                                         │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### What We Add (MiniBob as Hypothesis Vessel)

```
┌─────────────────────────────────────────────────────────────┐
│  MiniBob Hypothesis Capabilities (Seed Activities)           │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. Meta-Activity: create_hypothesis_activity                │
│     - Input: impulse(shape='goal') describing what to learn │
│     - Output: impulse(shape='activity') with test validators│
│     - Stored in: activity table (execution_type='template') │
│     - MiniBob executes this to generate hypothesis activities│
│                                                               │
│  2. Meta-Activity: test_hypothesis                           │
│     - Input: impulse(pointer.type='activity')                │
│     - Output: impulse(shape='trace') with observations      │
│     - Stored in: execution table with validator results     │
│     - MiniBob executes hypothesis and captures trace         │
│                                                               │
│  3. Meta-Activity: interpret_test_results                    │
│     - Input: impulse(shape='trace') from hypothesis test    │
│     - Output: impulse(shape='recommendation') for alignment │
│     - Decides: Align code to validator OR validator to code  │
│     - Uses: Goal history from impulse table                  │
│                                                               │
│  4. MiniBob as Vessel                                         │
│     - Registers in vessel table                              │
│     - Resolves: file, memo (local types)                     │
│     - Delegates: trace, activity (backend types via MCP)     │
│     - Executes all three meta-activities above               │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Workflow: Understanding a New Codebase

### Phase 1: Generate Hypotheses (Activities)

MiniBob enters a codebase with a goal: **"Add rate limiting to API endpoints"**

**Step 1.1: Initial Exploration**
```bash
# Use existing MCP tools
search_codebase("rate limiting")
search_codebase("middleware")
analyze_change_impact(changed_files=["src/index.ts"])
```

**Step 1.2: Generate Hypothesis Activities**

Based on CPG analysis, generate testable hypotheses:

```typescript
// Hypothesis 1: "Rate limiting already exists"
{
  "id": "hypothesis_existing_rate_limiter",
  "name": "Check: Existing rate limiter implementation",
  "category": "exploration",
  "tasks": [
    {
      "id": "search_rate_limiter",
      "description": "Search for existing rate limiter code",
      "validation": {
        "requiredFiles": ["src/middleware/rate-limit.ts"],
        "requiredPatterns": ["rateLimit", "limitRequests"]
      }
    }
  ]
}

// Hypothesis 2: "API uses Express middleware pattern"
{
  "id": "hypothesis_express_middleware",
  "name": "Check: Express middleware architecture",
  "category": "exploration",
  "tasks": [
    {
      "id": "check_express_usage",
      "description": "Verify Express middleware pattern",
      "validation": {
        "requiredPatterns": ["app.use\\(", "express\\.Router"],
        "requiredFiles": ["src/index.ts", "package.json"]
      }
    }
  ]
}

// Hypothesis 3: "Redis is available for state storage"
{
  "id": "hypothesis_redis_available",
  "name": "Check: Redis availability for rate limiter state",
  "category": "exploration",
  "tasks": [
    {
      "id": "check_redis",
      "description": "Check if Redis is configured",
      "validation": {
        "requiredPatterns": ["redis", "REDIS_URL"],
        "requiredFiles": ["package.json"]
      }
    }
  ]
}
```

**Step 1.3: Execute Hypothesis Activities**

```typescript
// Use existing run_goal with Thompson Sampling
const result1 = await run_goal({
  goal: "Test hypothesis: Existing rate limiter",
  activity_id: "hypothesis_existing_rate_limiter"
});

const result2 = await run_goal({
  goal: "Test hypothesis: Express middleware",
  activity_id: "hypothesis_express_middleware"
});

const result3 = await run_goal({
  goal: "Test hypothesis: Redis available",
  activity_id: "hypothesis_redis_available"
});
```

**Step 1.4: Analyze Results**

```
✅ hypothesis_existing_rate_limiter: FAILED
   - No existing rate limiter found
   - Validator expected rate-limit.ts, not found

✅ hypothesis_express_middleware: SUCCESS
   - Express middleware pattern confirmed
   - Found app.use() and express.Router

❌ hypothesis_redis_available: FAILED
   - Redis not in package.json
   - No REDIS_URL in environment
```

### Phase 2: Instrumentation (Same Activities, Different Purpose)

Now that we have hypothesis results, we can instrument the codebase:

**Step 2.1: Create Implementation Activity**

Based on confirmed hypotheses:
- Express middleware pattern ✅
- Redis not available ❌

Generate implementation activity:

```typescript
{
  "id": "implement_rate_limiting_in_memory",
  "name": "Implement in-memory rate limiting for Express",
  "category": "feature",
  "impulses": [
    {
      "id": "express_middleware_trace",
      "pointer": {
        "type": "activityExecutionTrace",
        "activity_id": "hypothesis_express_middleware",
        "include_state": true
      },
      "budget": 2000,
      "priority": "high"
    }
  ],
  "tasks": [
    {
      "id": "create_middleware",
      "description": "Create rate limiter middleware using in-memory store",
      "validation": {
        "requiredFiles": ["src/middleware/rate-limit.ts"],
        "requiredPatterns": ["export.*rateLimit", "Map<"],
        "forbiddenPatterns": ["redis", "external-store"]
      }
    },
    {
      "id": "apply_middleware",
      "description": "Apply rate limiter to Express app",
      "validation": {
        "requiredFiles": ["src/index.ts"],
        "requiredPatterns": ["app\\.use\\(rateLimit"]
      }
    }
  ]
}
```

**Step 2.2: Execute Implementation (Instrumented)**

```typescript
const implResult = await run_goal({
  goal: "Implement rate limiting",
  activity_id: "implement_rate_limiting_in_memory"
});

// Trace captures:
// - Files created: src/middleware/rate-limit.ts
// - Files modified: src/index.ts
// - Patterns found: Map<string, number>, app.use(rateLimit)
// - Validator results: ALL PASSED
```

### Phase 3: Differential Alignment

Now user provides new context: **"Actually, we need distributed rate limiting across multiple instances"**

**Step 3.1: Re-evaluate Hypothesis**

Original hypothesis: Redis not available ❌
New requirement: Distributed rate limiting (needs Redis) ✅

**Decision Point:**
- Option A: **Align code to new validator** (add Redis)
- Option B: **Align validator to existing code** (accept in-memory)

**Step 3.2: Context-Based Decision**

```typescript
// Alignment Decision Logic (using existing goal history)
const pastGoals = await activityApi.getGoals({ org_id });
const scalabilityGoals = pastGoals.filter(g =>
  g.keywords.includes('scale') ||
  g.keywords.includes('distributed')
);

if (scalabilityGoals.length > 0) {
  // User has indicated scalability is important
  decision = "align_code_to_validator"; // Add Redis
} else {
  // No past evidence of scalability needs
  decision = "align_validator_to_code"; // Keep in-memory
}
```

**Step 3.3: Generate Alignment Activity**

If decision = `align_code_to_validator`:

```typescript
{
  "id": "align_rate_limiter_add_redis",
  "name": "Align rate limiter to use Redis for distribution",
  "category": "refactor",
  "impulses": [
    {
      "id": "current_implementation",
      "pointer": {
        "type": "activityExecutionTrace",
        "activity_id": "implement_rate_limiting_in_memory"
      }
    },
    {
      "id": "redis_pattern",
      "pointer": {
        "type": "activityTemplate",
        "search": "redis rate limiting",
        "category": "rate_limiting"
      }
    }
  ],
  "tasks": [
    {
      "id": "add_redis_dependency",
      "description": "Add Redis client to package.json",
      "validation": {
        "requiredFiles": ["package.json"],
        "requiredPatterns": ["redis.*:\\s*\"\\^"]
      }
    },
    {
      "id": "refactor_to_redis",
      "description": "Replace Map with Redis client",
      "validation": {
        "requiredFiles": ["src/middleware/rate-limit.ts"],
        "requiredPatterns": ["RedisClient", "redis\\.incr"],
        "forbiddenPatterns": ["Map<string"]
      }
    }
  ]
}
```

If decision = `align_validator_to_code`:

```typescript
{
  "id": "align_validator_accept_in_memory",
  "name": "Update validator to accept in-memory rate limiting",
  "category": "tool",
  "tasks": [
    {
      "id": "update_hypothesis",
      "description": "Update hypothesis activity to accept in-memory",
      "validation": {
        "requiredFiles": ["activity_templates/hypothesis_redis_available.json"],
        "requiredPatterns": ["in-memory.*acceptable"]
      }
    }
  ]
}
```

## Implementation: Seed Activities in metabob-proto

### Activity 1: create_hypothesis_activity.json

This meta-activity teaches MiniBob to generate hypothesis activities from goals.

```json
// repos/metabob-proto/activities/meta/create_hypothesis_activity.json
{
  "id": "meta_create_hypothesis_activity",
  name: 'generate_hypothesis_activities',
  description: 'Generate testable hypothesis activities to understand a codebase',
  inputSchema: {
    type: 'object',
    properties: {
      goal: {
        type: 'string',
        description: 'What you want to accomplish (e.g., "Add rate limiting")',
      },
      focus_areas: {
        type: 'array',
        items: { type: 'string' },
        description: 'Areas to investigate (e.g., ["middleware", "auth", "database"])',
      },
      entry_points: {
        type: 'array',
        items: { type: 'string' },
        description: 'Starting files to analyze (e.g., ["src/index.ts"])',
      },
    },
    required: ['goal'],
  },

  handler: async (input, apiClient, sessionId) => {
    // Step 1: Index codebase (existing endpoint)
    await apiClient.post('/v2/analysis/index', {
      session_id: sessionId,
      files: input.entry_points || [],
    });

    // Step 2: Get CPG structure (existing endpoint)
    const cpgStatus = await apiClient.get('/v2/analysis/status', {
      session_id: sessionId,
    });

    // Step 3: Generate hypotheses based on goal + CPG
    const response = await apiClient.post('/v2/activities/generate-hypotheses', {
      session_id: sessionId,
      goal: input.goal,
      focus_areas: input.focus_areas || [],
      cpg_components: cpgStatus.componentsCount,
    });

    // Returns: Array of activity templates (stored in activity_template table)
    return JSON.stringify({
      generated: response.hypotheses.length,
      hypotheses: response.hypotheses.map(h => ({
        id: h.id,
        name: h.name,
        tests: h.tasks.map(t => t.description),
      })),
      next_step: "Use 'run_instrumentation' to execute these hypotheses",
    }, null, 2);
  },
};
```

## Implementation: Hypothesis Generator Service

```typescript
// repos/metabob-activity-api/src/services/hypothesis-generator.ts

export class HypothesisGeneratorService {
  constructor(
    private db: SurrealDBClient,
    private cpgService: CPGService
  ) {}

  /**
   * Generate hypothesis activities based on goal and CPG analysis
   */
  async generateHypotheses(
    orgId: string,
    sessionId: string,
    goal: string,
    focusAreas: string[]
  ): Promise<ActivityTemplate[]> {
    // Analyze goal to extract intent
    const intent = this.extractIntent(goal);

    // Get CPG components
    const components = await this.cpgService.getComponents(sessionId);

    // Generate hypotheses based on intent
    const hypotheses: ActivityTemplate[] = [];

    // Hypothesis 1: Check if feature already exists
    hypotheses.push(
      this.generateExistenceHypothesis(intent.feature, components)
    );

    // Hypothesis 2: Check architectural pattern
    hypotheses.push(
      this.generateArchitectureHypothesis(components)
    );

    // Hypothesis 3: Check dependencies
    if (intent.requires_external) {
      hypotheses.push(
        this.generateDependencyHypothesis(intent.dependencies, components)
      );
    }

    // Hypothesis 4: Check data flow
    hypotheses.push(
      this.generateDataFlowHypothesis(focusAreas, components)
    );

    // Store as activity templates
    for (const hypothesis of hypotheses) {
      await this.db.create('activity_template', {
        org_id: orgId,
        ...hypothesis,
        category: 'exploration',
        created_by: 'hypothesis_generator',
      });
    }

    return hypotheses;
  }

  private extractIntent(goal: string): {
    feature: string;
    requires_external: boolean;
    dependencies: string[];
  } {
    const lower = goal.toLowerCase();

    // Simple intent extraction (can be enhanced with LLM)
    return {
      feature: this.extractFeatureName(goal),
      requires_external:
        lower.includes('redis') ||
        lower.includes('database') ||
        lower.includes('distributed'),
      dependencies: this.extractDependencies(lower),
    };
  }

  private generateExistenceHypothesis(
    feature: string,
    components: CPGComponent[]
  ): ActivityTemplate {
    // Check if feature already exists in codebase
    const relatedFiles = components
      .filter(c => c.name.toLowerCase().includes(feature.toLowerCase()))
      .map(c => c.file_path);

    return {
      id: `hypothesis_existing_${feature.replace(/\s+/g, '_')}`,
      name: `Check: Existing ${feature} implementation`,
      tasks: [
        {
          id: 'search_existing',
          description: `Search for existing ${feature} code`,
          validation: {
            requiredPatterns: [
              feature.toLowerCase(),
              feature.replace(/\s+/g, ''),
            ],
          },
        },
      ],
    };
  }

  private generateArchitectureHypothesis(
    components: CPGComponent[]
  ): ActivityTemplate {
    // Detect common patterns (Express, FastAPI, etc.)
    const hasExpress = components.some(c =>
      c.file_path.includes('node_modules/express') ||
      c.code?.includes('express')
    );

    const hasFastAPI = components.some(c =>
      c.code?.includes('FastAPI') ||
      c.code?.includes('from fastapi')
    );

    return {
      id: 'hypothesis_architecture_pattern',
      name: 'Check: Application architecture pattern',
      tasks: [
        {
          id: 'detect_framework',
          description: 'Identify web framework',
          validation: {
            requiredPatterns: hasExpress
              ? ['express', 'app\\.use']
              : hasFastAPI
              ? ['FastAPI', '@app\\.']
              : ['http\\.', 'server'],
          },
        },
      ],
    };
  }

  private generateDependencyHypothesis(
    dependencies: string[],
    components: CPGComponent[]
  ): ActivityTemplate {
    return {
      id: 'hypothesis_dependencies_available',
      name: 'Check: Required dependencies availability',
      tasks: dependencies.map(dep => ({
        id: `check_${dep}`,
        description: `Check if ${dep} is available`,
        validation: {
          requiredFiles: ['package.json'],
          requiredPatterns: [dep],
        },
      })),
    };
  }

  private generateDataFlowHypothesis(
    focusAreas: string[],
    components: CPGComponent[]
  ): ActivityTemplate {
    // Use CPG to identify data flow between components
    return {
      id: 'hypothesis_data_flow',
      name: 'Check: Data flow patterns',
      tasks: [
        {
          id: 'trace_data_flow',
          description: 'Trace data flow through focus areas',
          validation: {
            requiredPatterns: focusAreas.map(area => `${area}.*->`),
          },
        },
      ],
    };
  }

  private extractFeatureName(goal: string): string {
    // Simple extraction - can be enhanced
    const match = goal.match(/(?:add|implement|create)\s+(\w+(?:\s+\w+)*)/i);
    return match ? match[1] : 'feature';
  }

  private extractDependencies(goalLower: string): string[] {
    const deps: string[] = [];
    if (goalLower.includes('redis')) deps.push('redis');
    if (goalLower.includes('postgres')) deps.push('pg');
    if (goalLower.includes('mongo')) deps.push('mongodb');
    return deps;
  }
}
```

## Implementation: Alignment Decision Service

```typescript
// repos/metabob-activity-api/src/services/alignment-decision.ts

export class AlignmentDecisionService {
  constructor(private db: SurrealDBClient) {}

  /**
   * Decide whether to align code to validator or validator to code
   */
  async decideAlignment(
    orgId: string,
    failedActivityId: string,
    validatorFailures: ValidatorFailure[],
    currentGoal: string
  ): Promise<'align_code' | 'align_validator'> {
    // Get past goals for context
    const pastGoals = await this.getPastGoals(orgId);

    // Get execution history for this activity
    const executions = await this.getExecutionHistory(failedActivityId);

    // Analyze validator failure
    const failureAnalysis = this.analyzeFailures(validatorFailures);

    // Decision logic
    if (failureAnalysis.type === 'pattern_not_found') {
      // Code doesn't match expected pattern

      // Check if pattern was explicitly requested in goal
      if (this.goalExplicitlyRequiresPattern(currentGoal, failureAnalysis.pattern)) {
        return 'align_code'; // Fix code to match explicit requirement
      }

      // Check if past goals consistently used this pattern
      if (this.pastGoalsPreferPattern(pastGoals, failureAnalysis.pattern)) {
        return 'align_code'; // Maintain consistency with past
      }

      // Check if current implementation works (no runtime errors)
      if (executions.some(e => e.success && e.status === 'completed')) {
        return 'align_validator'; // Code works, update expectation
      }

      // Default: align code
      return 'align_code';
    }

    if (failureAnalysis.type === 'file_not_found') {
      // Expected file doesn't exist

      // Check if file is critical to goal
      if (this.goalRequiresFile(currentGoal, failureAnalysis.file)) {
        return 'align_code'; // Create missing file
      }

      // File might be in different location
      return 'align_validator'; // Update expected path
    }

    // Default: align code
    return 'align_code';
  }

  private analyzeFailures(failures: ValidatorFailure[]): {
    type: 'pattern_not_found' | 'file_not_found' | 'forbidden_pattern_found';
    pattern?: string;
    file?: string;
  } {
    // Analyze validator failures to categorize
    if (failures.some(f => f.type === 'required_pattern_missing')) {
      return {
        type: 'pattern_not_found',
        pattern: failures.find(f => f.type === 'required_pattern_missing')?.pattern,
      };
    }

    if (failures.some(f => f.type === 'required_file_missing')) {
      return {
        type: 'file_not_found',
        file: failures.find(f => f.type === 'required_file_missing')?.file,
      };
    }

    return { type: 'pattern_not_found' };
  }

  private goalExplicitlyRequiresPattern(goal: string, pattern: string): boolean {
    return goal.toLowerCase().includes(pattern.toLowerCase());
  }

  private pastGoalsPreferPattern(pastGoals: Goal[], pattern: string): boolean {
    const goalsWithPattern = pastGoals.filter(g =>
      g.description.toLowerCase().includes(pattern.toLowerCase())
    );
    return goalsWithPattern.length >= 3; // Threshold
  }

  private goalRequiresFile(goal: string, file: string): boolean {
    return goal.toLowerCase().includes(file.toLowerCase());
  }

  private async getPastGoals(orgId: string): Promise<Goal[]> {
    const result = await this.db.query<Goal[]>(
      `SELECT * FROM goal WHERE org_id = $org_id ORDER BY created_at DESC LIMIT 20`,
      { org_id: orgId }
    );
    return result[0]?.result || [];
  }

  private async getExecutionHistory(activityId: string): Promise<ExecutionTrace[]> {
    const result = await this.db.query<ExecutionTrace[]>(
      `SELECT * FROM activity_execution_trace
       WHERE activity_id = $activity_id
       ORDER BY started_at DESC LIMIT 10`,
      { activity_id: activityId }
    );
    return result[0]?.result || [];
  }
}
```

## MCP Tool: align_expectations

```typescript
// repos/metabob-mcp/src/tools/align-expectations.ts

export const AlignExpectationsTool = {
  name: 'align_expectations',
  description: 'Decide whether to align code to validator or validator to code after hypothesis failure',
  inputSchema: {
    type: 'object',
    properties: {
      failed_activity_id: {
        type: 'string',
        description: 'Activity that failed validation',
      },
      goal: {
        type: 'string',
        description: 'Current goal context',
      },
    },
    required: ['failed_activity_id', 'goal'],
  },

  handler: async (input, apiClient, sessionId) => {
    // Get alignment decision from backend
    const response = await apiClient.post('/v2/activities/alignment-decision', {
      session_id: sessionId,
      failed_activity_id: input.failed_activity_id,
      goal: input.goal,
    });

    // Generate appropriate activity based on decision
    if (response.decision === 'align_code') {
      // Create activity to fix code
      const fixActivity = await apiClient.post('/v2/activities/generate-fix', {
        session_id: sessionId,
        failed_activity_id: input.failed_activity_id,
        validator_failures: response.failures,
      });

      return `Decision: Align code to match validator\n\nGenerated fix activity: ${fixActivity.id}\n\nReason: ${response.reason}\n\nNext: Use 'run_goal' to execute the fix activity`;
    } else {
      // Create activity to update validator
      const updateActivity = await apiClient.post('/v2/activities/generate-validator-update', {
        session_id: sessionId,
        failed_activity_id: input.failed_activity_id,
        align_to_reality: true,
      });

      return `Decision: Align validator to match code\n\nGenerated update activity: ${updateActivity.id}\n\nReason: ${response.reason}\n\nNext: Use 'run_goal' to execute the validator update`;
    }
  },
};
```

## Complete Workflow Example

```typescript
// 1. MiniBob enters new codebase
const hypotheses = await mcp.generate_hypothesis_activities({
  goal: "Add rate limiting to API endpoints",
  entry_points: ["src/index.ts"],
});

// 2. Execute hypothesis activities (instrumentation)
for (const h of hypotheses.hypotheses) {
  const result = await mcp.run_goal({
    goal: `Test: ${h.name}`,
    activity_id: h.id,
  });

  // Trace captures observations
  // Validators check expectations
}

// 3. Review results
// hypothesis_existing_rate_limiter: FAILED (doesn't exist)
// hypothesis_express_middleware: SUCCESS (confirmed)
// hypothesis_redis_available: FAILED (not installed)

// 4. Generate implementation based on confirmed hypotheses
const implActivity = await activityApi.recommend({
  goal: "Implement rate limiting",
  context: {
    confirmed_hypotheses: ["express_middleware"],
    failed_hypotheses: ["redis_available"],
  },
});

// 5. Execute implementation
const implResult = await mcp.run_goal({
  goal: "Implement rate limiting",
  activity_id: implActivity.id,
});

// 6. User provides new context: "Need distributed rate limiting"
// This invalidates the hypothesis that in-memory is acceptable

// 7. Alignment decision
const alignment = await mcp.align_expectations({
  failed_activity_id: "hypothesis_redis_available",
  goal: "Distributed rate limiting across instances",
});

// Decision: align_code (add Redis)
// Generates fix activity to install Redis and refactor

// 8. Execute alignment
await mcp.run_goal({
  goal: "Align to distributed architecture",
  activity_id: alignment.fix_activity_id,
});
```

## Key Advantages

1. **No New Storage**: Uses existing activity_template, activity_execution_trace tables
2. **No New Impulse Types**: Uses existing activityExecutionTrace, activityMetrics
3. **Reuses Learning Loop**: Thompson Sampling tracks which hypotheses are reliable
4. **Reuses Trailblazing**: Failed hypotheses create variants
5. **Composable**: Hypothesis activities compose with implementation activities
6. **Measurable**: Success rate = how often hypothesis is confirmed
7. **Adaptive**: Alignment decisions based on goal history

## Success Metrics

1. **Hypothesis Accuracy**: % of hypotheses confirmed on first execution
2. **Alignment Quality**: % of alignment decisions that satisfy goal
3. **Learning Rate**: How quickly hypothesis accuracy improves over time
4. **Code Quality**: Does aligned code pass tests and meet requirements?
5. **Validator Quality**: Do aligned validators accurately reflect reality?

## Summary

This approach uses activities as **both hypothesis and instrumentation**, leveraging the existing infrastructure:

- **Activities** = Hypotheses with validators
- **Execution** = Testing hypotheses
- **Traces** = Observations
- **Validators** = Expectations
- **Thompson Sampling** = Learn which hypotheses are reliable
- **Trailblazing** = Create variants when hypotheses fail
- **Alignment Decision** = Fix code vs update expectations

No new storage, no new idioms - just activities all the way down.
