# Recommendation Specification

**Component:** Backend MCP endpoints (minibob_help, execute_template, execute_goal)
**Status:** ⚠️ PARTIALLY IMPLEMENTED (Thompson Sampling exists, MCP endpoints don't)
**LOC:** ~200 lines backend
**Owner:** metabob-activity-api

---

## Purpose

Backend intelligence for activity recommendations using Thompson Sampling. ALL recommendation logic lives in the backend - intent detection, template selection, response formatting, and SurrealDB integration.

## Key Principle

**Backend-Centric:** OpenCode just calls `minibob_help()` and displays the response. The backend does everything else.

---

## MCP Endpoints

### 1. `minibob_help(message, context)`

**Purpose:** Main entry point - analyzes intent, recommends approaches, formats response.

**Request:**
```typescript
{
  message?: string,              // Explicit user message (e.g., "/minibob add auth")
  context: {
    sessionId: string | null,
    directory: string,
    messages: Message[],         // Session conversation history
    files: string[]              // Files in working directory
  }
}
```

**Response:**
```typescript
{
  message: string,               // Markdown-formatted response for user
  actions: Action[]              // Available next actions
}

type Action =
  | { type: 'execute_template', templateId: string }
  | { type: 'execute_goal', goal: string, impulses: Impulse[] }
  | { type: 'improvise', goal: string }
```

---

### 2. `execute_template(templateId, sessionId)`

**Purpose:** Execute activity template via MiniBob ActivityExecutor.

**Request:**
```typescript
{
  templateId: string,
  sessionId: string,
  variables?: Record<string, unknown>
}
```

**Response:**
```typescript
{
  success: boolean,
  message: string,               // Formatted result for user
  trace: ActivityExecutionTrace
}
```

---

### 3. `execute_goal(goal, impulses, sessionId)`

**Purpose:** Execute goal-seeking activity (adaptive improvisation).

**Request:**
```typescript
{
  goal: string,
  impulses: Impulse[],
  sessionId: string
}
```

**Response:**
```typescript
{
  success: boolean,
  message: string,
  trace: ActivityExecutionTrace
}
```

---

## Backend Architecture

**Location:** `repos/metabob-activity-api/src/routes/minibob.ts` (NEW FILE)

```typescript
import { Hono } from 'hono';
import { surrealDB } from '../db/surreal';
import { logger } from '../utils/logger';

const app = new Hono();

/**
 * MCP: minibob_help()
 *
 * All intelligence happens here:
 * 1. Intent detection from context
 * 2. Thompson Sampling for recommendations
 * 3. Response formatting (markdown for user)
 */
app.post('/minibob/help', async (c) => {
  const { message, context } = await c.req.json();

  logger.info('minibob_help', {
    message: message?.substring(0, 50),
    sessionId: context.sessionId
  });

  // 1. Detect intent
  const intent = await detectIntent(message, context);

  // 2. Thompson Sampling recommendations
  const recommendations = await thompsonSample(intent, context);

  if (recommendations.length === 0) {
    return c.json({
      message: "I'm here to help! What would you like to do?",
      actions: []
    });
  }

  const best = recommendations[0];

  // 3. Format response based on type
  const response = formatResponse(best);

  return c.json(response);
});

/**
 * MCP: execute_template()
 */
app.post('/minibob/execute-template', async (c) => {
  const { templateId, sessionId, variables = {} } = await c.req.json();

  logger.info('execute_template', { templateId, sessionId });

  // Load template from SurrealDB
  const template = await loadTemplate(templateId);

  // Execute via ActivityExecutor (delegates to OpenCode tools)
  const executor = new ActivityExecutor({
    tools: openCodeTools,
    traceStorage: surrealDBStorage
  });

  const result = await executor.execute({
    templateId,
    variables,
    reason: `OpenCode session ${sessionId}`
  });

  // Update Thompson Sampling metrics
  await updateMetrics(templateId, result.success);

  return c.json({
    success: result.success,
    message: formatExecutionResult(result),
    trace: result.trace
  });
});

export default app;
```

---

## Intent Detection (Backend)

**Purpose:** Extract user goal from message + session context.

```typescript
async function detectIntent(message: string | undefined, context: SessionContext): Promise<Intent> {
  // Explicit message provided
  if (message) {
    return {
      goal: message,
      category: inferCategory(message),
      confidence: 0.9
    };
  }

  // Analyze session conversation
  const messages = context.messages || [];
  const lastUserMessage = messages.filter(m => m.role === 'user').pop();

  return {
    goal: lastUserMessage?.content || 'Help with this codebase',
    category: inferCategory(lastUserMessage?.content),
    confidence: 0.6
  };
}

function inferCategory(text: string): Category {
  const lower = (text || '').toLowerCase();
  if (lower.includes('add') || lower.includes('implement')) return 'feature';
  if (lower.includes('fix') || lower.includes('bug')) return 'bugfix';
  if (lower.includes('refactor') || lower.includes('improve')) return 'refactor';
  return 'feature';
}
```

---

## Thompson Sampling (Backend)

**Purpose:** Select best template using Beta distribution sampling.

**Current Implementation:** ✅ `POST /recommend` (lines 1244-1357 in activities.ts)

```typescript
async function thompsonSample(intent: Intent, context: SessionContext): Promise<Recommendation[]> {
  // Fetch templates from SurrealDB
  const templates = await surrealDB.query(`
    SELECT variant_id, activity_id, variant_name, category
    FROM activity_template
    WHERE category = $category
  `, { category: intent.category });

  // Enrich with metrics (thompson_alpha, thompson_beta)
  const enriched = await enrichTemplatesWithMetrics(templates);

  // Sample from Beta distributions
  const recommendations = enriched.map(template => {
    const alpha = template.metrics?.thompson_alpha || 1.0;
    const beta = template.metrics?.thompson_beta || 1.0;

    // Sample = expected value of Beta(alpha, beta)
    // In production: sample = betaRandom(alpha, beta)
    const sample = alpha / (alpha + beta);

    return {
      type: 'template',
      templateId: template.variant_id,
      templateName: template.variant_name,
      tasks: template.task_steps,
      selectionMetadata: {
        method: 'thompson_sampling',
        alpha,
        beta,
        sample,
        score: sample
      }
    };
  });

  // Sort by sample (highest first)
  recommendations.sort((a, b) =>
    b.selectionMetadata.sample - a.selectionMetadata.sample
  );

  return recommendations.slice(0, 3);
}
```

**Integration with SurrealDB:**
- Templates stored in `activity_template` table
- Metrics tracked in `variant_performance_metrics` table
- Thompson alpha/beta updated on each execution

---

## Response Formatting (Backend)

**Purpose:** Convert recommendation to user-friendly markdown message.

```typescript
function formatResponse(rec: Recommendation): HelpResponse {
  if (rec.type === 'template') {
    const successRate = Math.round(
      (rec.selectionMetadata.alpha /
       (rec.selectionMetadata.alpha + rec.selectionMetadata.beta)) * 100
    );

    return {
      message: `
I can help with that using a proven template: **${rec.templateName}**
(${successRate}% success rate)

**What it will do:**
${rec.tasks.map((t, i) => `${i + 1}. ${t.description}`).join('\n')}

Would you like me to execute this template?
- Reply "yes" to execute automatically
- Or follow along manually - I'll guide you step by step
      `.trim(),
      actions: [
        { type: 'execute_template', templateId: rec.templateId }
      ]
    };
  }

  if (rec.type === 'goal') {
    return {
      message: `
I found ${rec.similarSuccesses.length} similar successful sessions.

**Recommended approach:**
${rec.approach}

I'll adapt as we go. Ready to start?
      `.trim(),
      actions: [
        { type: 'execute_goal', goal: rec.goal, impulses: rec.impulses }
      ]
    };
  }

  // Improvisation
  return {
    message: `
This is new territory - no existing templates match.

Let's figure it out step by step. I'll learn from what works.
    `.trim(),
    actions: [
      { type: 'improvise', goal: rec.goal }
    ]
  };
}
```

---

## SurrealDB Schema Integration

**Tables Used:**

```surql
-- Activity templates (vessels)
DEFINE TABLE activity_template SCHEMAFULL;
DEFINE FIELD variant_id ON activity_template TYPE string;
DEFINE FIELD variant_name ON activity_template TYPE string;
DEFINE FIELD category ON activity_template TYPE string;
DEFINE FIELD task_steps ON activity_template TYPE array;

-- Performance metrics (Thompson Sampling data)
DEFINE TABLE variant_performance_metrics SCHEMAFULL;
DEFINE FIELD variant_id ON variant_performance_metrics TYPE string;
DEFINE FIELD thompson_alpha ON variant_performance_metrics TYPE float DEFAULT 1.0;
DEFINE FIELD thompson_beta ON variant_performance_metrics TYPE float DEFAULT 1.0;
DEFINE FIELD total_executions ON variant_performance_metrics TYPE int DEFAULT 0;
DEFINE FIELD successful_executions ON variant_performance_metrics TYPE int DEFAULT 0;
DEFINE FIELD success_rate ON variant_performance_metrics TYPE float;

-- Execution traces (instances)
DEFINE TABLE activity_execution_trace SCHEMAFULL;
DEFINE FIELD activity_id ON activity_execution_trace TYPE string;
DEFINE FIELD success ON activity_execution_trace TYPE bool;
DEFINE FIELD duration_ms ON activity_execution_trace TYPE int;
DEFINE FIELD cost_usd ON activity_execution_trace TYPE float;
```

**Update Flow:**
1. Template executed → trace stored
2. Metrics table updated:
   - `successful_executions++` or `total_executions++`
   - `thompson_alpha = successful_executions + 1`
   - `thompson_beta = (total_executions - successful_executions) + 1`
   - `success_rate = successful_executions / total_executions`

---

## What Backend Does

✅ **Intent detection** - Extract goal from user message/context
✅ **Thompson Sampling** - Select best template using Beta distribution
✅ **Response formatting** - Create user-friendly markdown messages
✅ **Template execution** - Run ActivityExecutor with OpenCode tools
✅ **Metrics tracking** - Update alpha/beta after each execution
✅ **SurrealDB integration** - Store templates, traces, metrics

---

## What OpenCode Does

✅ **Call backend** - `client.call('minibob_help', { message, context })`
✅ **Display response** - Show formatted message to user
✅ **Handle errors** - Graceful degradation if backend offline

**That's it!** ~40 LOC in OpenCode, ~200 LOC in backend.

---

## Testing

**Backend Tests:**

```typescript
describe('minibob_help', () => {
  it('detects intent from message', async () => {
    const response = await fetch('/minibob/help', {
      method: 'POST',
      body: JSON.stringify({
        message: 'add authentication',
        context: { sessionId: null, directory: '/app', messages: [], files: [] }
      })
    });

    const data = await response.json();
    expect(data.message).toContain('authentication');
    expect(data.actions).toHaveLength(1);
  });

  it('uses Thompson Sampling for template selection', async () => {
    // Setup: Template A has higher success rate
    await seedTemplate('template-a', { alpha: 10, beta: 2 });
    await seedTemplate('template-b', { alpha: 5, beta: 5 });

    const response = await fetch('/minibob/help', {
      method: 'POST',
      body: JSON.stringify({
        message: 'add feature',
        context: { sessionId: null, directory: '/app', messages: [], files: [] }
      })
    });

    const data = await response.json();
    expect(data.actions[0].templateId).toBe('template-a'); // Higher alpha wins
  });

  it('formats response with success rate', async () => {
    await seedTemplate('template-c', { alpha: 8, beta: 2 }); // 80% success

    const response = await fetch('/minibob/help', {
      method: 'POST',
      body: JSON.stringify({
        message: 'test',
        context: { sessionId: null, directory: '/app', messages: [], files: [] }
      })
    });

    const data = await response.json();
    expect(data.message).toContain('80% success rate');
  });
});
```

---

## Performance

**Target:** < 200ms recommendation latency

**Optimizations:**
- Template metrics cached in Redis (1hr TTL)
- Thompson Sampling uses expected value (deterministic, fast)
- Async execution doesn't block recommendations
- SurrealDB indexes on variant_id, category

---

## References

- [design.md](../design.md) - Full OpenCode ↔ MiniBob architecture
- [observer.md](./observer.md) - Session observation pattern
- [static-skill.md](./static-skill.md) - Skill registration pattern
- Backend recommendation: `repos/metabob-activity-api/src/routes/activities.ts` (lines 1244-1357)
- SurrealDB schema: `repos/metabob-activity-api/sql/008-unified-activity-model.surql`
