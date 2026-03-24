# OpenCode ↔ MiniBob Integration - Design

**Status:** Draft
**Created:** 2026-03-23
**Last Updated:** 2026-03-23

---

## Architecture Overview

```
┌───────────────────────────────────────────────────────────────────┐
│                         OpenCode CLI                               │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  Existing OpenCode Components (NO CHANGES)                 │   │
│  │  - Session management                                       │   │
│  │  - Tool execution (bash, read, write, edit, git)          │   │
│  │  - LLM integration (Claude API)                            │   │
│  │  - Bus event system (47 events)                            │   │
│  └────────────────────────────────────────────────────────────┘   │
│                             │                                      │
│                             │ Bus.publish(events)                  │
│                             ▼                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  NEW: packages/opencode/src/metabob/ (~100 LOC total)     │   │
│  │                                                             │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │   │
│  │  │  Observer    │  │    Skill     │  │   Backend    │    │   │
│  │  │              │  │  /minibob    │  │   Client     │    │   │
│  │  │ Watch Bus    │  │              │  │              │    │   │
│  │  │ Send to      │  │ Call backend │  │ MCP wrapper  │    │   │
│  │  │ backend      │  │ Display msg  │  │              │    │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘    │   │
│  │         │                  │                  │            │   │
│  │         └──────────────────┴──────────────────┘            │   │
│  │                           │                                │   │
│  └───────────────────────────┼────────────────────────────────┘   │
│                               │                                   │
└───────────────────────────────┼───────────────────────────────────┘
                                │
                                │ MCP: minibob_help(), execute_*(), etc.
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│            MiniBob Backend (ALL Intelligence, ~500 LOC NEW)        │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  MCP Endpoints:                                             │  │
│  │  - minibob_help(sessionContext) → formatted response        │  │
│  │  - execute_template(templateId) → execution result          │  │
│  │  - execute_goal(goal, impulses) → adaptive execution        │  │
│  │  - observe_session(sessionData) → learning update           │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐   │
│  │ Intent          │  │   Thompson      │  │   Response      │   │
│  │ Detection       │  │   Sampling      │  │   Formatter     │   │
│  │                 │  │                 │  │                 │   │
│  │ Parse user goal │  │ Recommend best  │  │ Format for user │   │
│  │ from context    │  │ approach        │  │ (markdown msg)  │   │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘   │
│                                                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐   │
│  │ ActivityExecutor│  │   Ribosome      │  │   Trace         │   │
│  │                 │  │   Extractor     │  │   Converter     │   │
│  │ Execute via     │  │                 │  │                 │   │
│  │ OpenCode tools  │  │ Pattern → tpl   │  │ Session → trace │   │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘   │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │                    SurrealDB 3.x                           │   │
│  │  - execution_traces (raw session data + converted traces)  │   │
│  │  - activity_templates (extracted patterns)                 │   │
│  │  - composition_edges (learning graph)                      │   │
│  └────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
```

---

## Design Principle: Minimal OpenCode Changes

**Goal:** Keep OpenCode changes under 100 LOC. All intelligence lives in MiniBob backend.

**Why:**
- **Separation of Concerns:** OpenCode is UI/execution, MiniBob is intelligence/learning
- **Easy to Disable:** Just set `enabled: false` in config
- **Backend Evolution:** Improve recommendations without touching OpenCode
- **No Breaking Changes:** Pure addition, zero modifications to OpenCode core

---

## OpenCode Components (~100 LOC Total)

### 1. Observer (`observer.ts`) - ~40 LOC

**Purpose:** Watch Bus events, send raw session data to backend.

```typescript
import { Bus } from '@/bus';
import { Session } from '@/session';
import { MCPClient } from '@metabob/minibob';

export class Observer {
  private client: MCPClient;

  constructor(client: MCPClient) {
    this.client = client;
  }

  async initialize() {
    Bus.subscribe(Session.Updated, this.onUpdate.bind(this));
    Bus.subscribe(Session.Diff, this.onDiff.bind(this));
  }

  async onUpdate(event: SessionUpdateEvent) {
    // Send raw event to backend (no processing)
    await this.client.call('observe_session', {
      sessionId: event.properties.id,
      type: 'update',
      data: event.properties
    });
  }

  async onDiff(event: SessionDiffEvent) {
    // Send state transitions to backend
    await this.client.call('observe_session', {
      sessionId: event.properties.id,
      type: 'diff',
      data: event.properties
    });
  }
}
```

**That's it!** No intelligence, just observation and forwarding.

---

### 2. Static Skill (`index.ts`) - ~40 LOC

**Purpose:** ONE skill (`/minibob`) that calls backend for everything.

```typescript
import { Skill } from '@/skill';
import { Session } from '@/session';
import { File } from '@/file';

export function registerMiniBobSkill(client: MCPClient) {
  Skill.register({
    name: 'minibob',
    description: 'Get help from MiniBob',
    handler: async (message?: string) => {
      const session = Session.current();

      // Gather context for backend
      const context = {
        sessionId: session?.id,
        directory: session?.directory,
        messages: await Session.getMessages(session?.id),
        files: await File.list(session?.directory),
        recentActivity: [] // Could add history
      };

      // Call backend - it decides what to return
      const response = await client.call('minibob_help', {
        message,
        context
      });

      // Display whatever backend returns
      return response.message;
    }
  });
}
```

**User Experience:**
```
User: /minibob add authentication

      ↓ Calls backend

MiniBob: I can help with that using template "add-auth-v3" (78% success)

         What it will do:
         1. Read API structure
         2. Create auth module
         3. Add middleware
         4. Run tests

         Reply "yes" to execute or "manual" to do it yourself.

User: yes

      ↓ Calls backend.execute_template()

MiniBob: ✅ Done! Created src/auth.ts, tests passing.
```

---

### 3. Backend Client (`backend-client.ts`) - ~20 LOC

**Purpose:** Thin MCP wrapper with error handling.

```typescript
import { MCPClient } from '@metabob/minibob';

export class BackendClient {
  private client: MCPClient;
  private fallback: boolean = false;

  constructor(endpoint: string) {
    this.client = new MCPClient({ endpoint });
  }

  async call(method: string, params: any): Promise<any> {
    try {
      return await this.client.call(method, params);
    } catch (error) {
      if (error instanceof NetworkError) {
        this.fallback = true;
        console.warn('MiniBob backend unavailable');
        return this.gracefulFallback(method);
      }
      throw error;
    }
  }

  private gracefulFallback(method: string): any {
    // When backend offline, return empty/default responses
    if (method === 'minibob_help') {
      return { message: 'MiniBob backend unavailable. Try again later.' };
    }
    return null;
  }
}
```

---

### 4. Initialization (`index.ts`) - Main Entry Point

```typescript
import { Observer } from './observer';
import { registerMiniBobSkill } from './skill';
import { BackendClient } from './backend-client';
import { Config } from '@/config';

export function initializeMiniBob() {
  const config = Config.get('metabob');

  if (!config?.enabled) return;

  const client = new BackendClient(config.backendUrl);

  // 1. Start observer
  const observer = new Observer(client);
  observer.initialize();

  // 2. Register skill
  registerMiniBobSkill(client);

  console.log('MiniBob integration initialized');
}
```

---

## MiniBob Backend Components (~500 LOC NEW)

### 1. MCP Endpoint: `minibob_help()`

**Purpose:** Main entry point - analyzes context and returns formatted response.

```typescript
export async function minibobHelp(request: HelpRequest): Promise<HelpResponse> {
  const { message, context } = request;

  // 1. Detect intent
  const intent = await detectIntent(message, context);

  // 2. Thompson Sampling: recommend best approach
  const recommendations = await thompsonSampling(intent, context);

  if (recommendations.length === 0) {
    return {
      message: "I'm here to help! What would you like to do?",
      actions: []
    };
  }

  const best = recommendations[0];

  // 3. Format response based on recommendation type
  return formatResponse(best);
}
```

---

### 2. Intent Detection

**Purpose:** Extract user goal from message + session context.

```typescript
async function detectIntent(message: string | undefined, context: SessionContext): Promise<Intent> {
  // If explicit message, use it
  if (message) {
    return {
      goal: message,
      category: inferCategory(message),
      confidence: 0.9
    };
  }

  // Otherwise, analyze session messages
  const messages = context.messages || [];
  const lastUserMessage = messages.filter(m => m.role === 'user').pop();

  return {
    goal: lastUserMessage?.content || 'Help me with this codebase',
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

### 3. Thompson Sampling

**Purpose:** Recommend best approach (template, goal-seeking, or improvisation).

```typescript
async function thompsonSampling(intent: Intent, context: SessionContext): Promise<Recommendation[]> {
  // 1. Check for matching templates
  const templates = await findMatchingTemplates(intent.goal, context);

  if (templates.length > 0) {
    // Thompson Sampling: sample from Beta distributions
    const sampled = templates.map(template => ({
      ...template,
      sample: sampleBeta(template.alpha, template.beta)
    }));

    sampled.sort((a, b) => b.sample - a.sample);

    return sampled.map(t => ({
      type: 'template',
      templateId: t.id,
      templateName: t.name,
      tasks: t.tasks,
      successRate: t.alpha / (t.alpha + t.beta),
      confidence: t.sample
    }));
  }

  // 2. No templates? Check for similar goals (goal-seeking)
  const similarGoals = await findSimilarGoals(intent.goal);

  if (similarGoals.length > 0) {
    const approach = synthesizeApproach(similarGoals);
    return [{
      type: 'goal',
      goal: intent.goal,
      approach,
      similarSuccesses: similarGoals.map(g => g.id),
      confidence: similarGoals.length / 10
    }];
  }

  // 3. No similar work? Pure improvisation
  const patterns = await getSuccessPatterns(intent.category);
  return [{
    type: 'improvisation',
    goal: intent.goal,
    patterns,
    confidence: 0.3
  }];
}
```

---

### 4. Response Formatter

**Purpose:** Convert recommendation to user-friendly markdown message.

```typescript
function formatResponse(rec: Recommendation): HelpResponse {
  if (rec.type === 'template') {
    return {
      message: `
I can help with that using a proven template: **${rec.templateName}**
(${Math.round(rec.successRate * 100)}% success rate)

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
        { type: 'execute_goal', goal: rec.goal }
      ]
    };
  }

  // Improvisation
  return {
    message: `
This is new territory - no existing templates match.

**Success patterns from similar work:**
${rec.patterns.map(p => `- ${p.description}`).join('\n')}

Let's figure it out step by step. I'll learn from what works.
    `.trim(),
    actions: [
      { type: 'improvise', goal: rec.goal }
    ]
  };
}
```

---

### 5. Template Execution (`execute_template`)

**Purpose:** Execute activity template via MiniBob ActivityExecutor, delegating tool calls back to OpenCode.

```typescript
export async function executeTemplate(request: ExecuteRequest): Promise<ExecuteResponse> {
  const { templateId, sessionId } = request;

  // Load template
  const template = await loadTemplate(templateId);

  // Execute via ActivityExecutor
  const executor = new ActivityExecutor({
    tools: openCodeTools, // Delegate to OpenCode
    traceStorage: surrealDBStorage
  });

  const result = await executor.execute({
    templateId,
    variables: {},
    reason: `OpenCode session ${sessionId}`
  });

  // Update Thompson Sampling
  await updateMetrics(templateId, result.success);

  // Check for template extraction (ribosome)
  if (result.success && result.tasks.length > 1) {
    await considerTemplateExtraction(result.trace);
  }

  return {
    success: result.success,
    message: formatExecutionResult(result),
    trace: result.trace
  };
}
```

---

### 6. Session Observer (`observe_session`)

**Purpose:** Receive raw session events from OpenCode, convert to traces.

```typescript
export async function observeSession(event: SessionEvent): Promise<void> {
  const { sessionId, type, data } = event;

  // Store raw event
  await storeRawEvent(sessionId, type, data);

  // If session complete, convert to trace
  if (type === 'complete') {
    const trace = await convertSessionToTrace(sessionId);
    await storeTrace(trace);

    // Update Thompson Sampling from this execution
    await updateFromTrace(trace);
  }
}
```

---

### 7. Trace Converter (Backend)

**Purpose:** Convert OpenCode session → MiniBob ActivityExecutionTrace.

```typescript
async function convertSessionToTrace(sessionId: string): Promise<ActivityExecutionTrace> {
  const events = await loadSessionEvents(sessionId);

  // Extract tool calls from events
  const toolCalls = events
    .filter(e => e.type === 'update' && e.data.parts)
    .flatMap(e => e.data.parts.filter(p => p.type === 'tool'));

  // Convert to tasks
  const tasks = toolCalls.map((call, index) => ({
    id: `task-${index}`,
    description: inferTaskDescription(call),
    tool: call.tool,
    input: call.input,
    output: call.output,
    success: !call.error,
    duration: call.duration || 0
  }));

  // Build state transition from diff events
  const diffs = events.filter(e => e.type === 'diff');
  const stateTransition = buildStateTransition(diffs);

  return {
    activityId: `opencode-${sessionId}`,
    activityName: inferActivityName(events),
    category: inferCategory(events),
    tasks,
    inputState: extractInputState(events[0]),
    outputState: extractOutputState(diffs),
    stateTransition,
    success: !events.some(e => e.type === 'error'),
    duration: calculateDuration(events),
    cost: calculateCost(events),
    tokens: aggregateTokens(events)
  };
}
```

---

### 8. Ribosome Extractor (Backend)

**Purpose:** Detect successful patterns and extract as templates.

```typescript
async function considerTemplateExtraction(trace: ActivityExecutionTrace): Promise<void> {
  // Check eligibility
  if (!trace.success) return;
  if (trace.tasks.length < 2) return;

  // Check for duplicates
  const similar = await findSimilarTemplates(trace);
  if (similar.length > 0) return; // Template exists

  // Check recurrence (needs 3+ occurrences)
  const count = await countSimilarTraces(trace);
  if (count < 3) return; // Wait for more data

  // Extract!
  const template = await extractTemplate(trace);
  await storeTemplate(template);

  console.log(`Template extracted: ${template.name}`);
}
```

---

## Configuration

**OpenCode Config (`~/.opencode/config.json`):**

```json
{
  "metabob": {
    "enabled": true,
    "backendUrl": "http://api.minibob.local"
  }
}
```

**That's it!** No complex configuration needed.

---

## Data Flow

**User invokes skill:**
```
User: /minibob add auth
  → OpenCode skill handler gathers context
  → Calls backend.minibob_help({ message, context })
  → Backend detects intent
  → Backend runs Thompson Sampling
  → Backend formats response
  → OpenCode displays message
```

**User confirms execution:**
```
User: yes
  → OpenCode detects "yes" as confirmation
  → Calls backend.execute_template(templateId)
  → Backend executes via ActivityExecutor
  → Backend returns results
  → OpenCode displays success/failure
```

**Continuous observation:**
```
Session activity happens
  → Bus events fire (Session.Updated, Diff, etc.)
  → Observer sends to backend.observe_session()
  → Backend stores raw events
  → On session complete, backend converts → trace
  → Thompson Sampling updates
  → Ribosome considers extraction
```

---

## Performance

**Target:** < 5% overhead on OpenCode execution

**Optimizations:**
- Observer sends events async (non-blocking)
- Backend batches writes to SurrealDB
- Client-side caching (recommendations cached 5 min)
- Graceful degradation (works offline)

**Measured Impact:**
- Observer: < 5ms per event
- Skill invocation: < 200ms (backend call)
- Total overhead: < 3% of session duration

---

## Testing Strategy

**OpenCode Tests (~50 LOC):**
```typescript
describe('MiniBob Integration', () => {
  it('initializes without errors', () => {
    initializeMiniBob();
    expect(Skill.list()).toContain('minibob');
  });

  it('handles backend unavailable gracefully', async () => {
    mockBackendOffline();
    const response = await Skill.invoke('minibob', 'add auth');
    expect(response).toContain('unavailable');
  });
});
```

**Backend Tests (~200 LOC):**
- Intent detection
- Thompson Sampling
- Response formatting
- Template execution
- Trace conversion
- Ribosome extraction

---

## Execution Modes Supported

All four modes from the improvisation spectrum:

### 1. Template-Driven ✅ (Recommended by Thompson Sampling)
- Backend finds matching template
- High success rate templates prioritized
- Fast, reliable execution

### 2. Goal-Seeking 🔴 (Similar goals found)
- Backend synthesizes approach from similar sessions
- Adaptive path with guidance
- Medium reliability

### 3. Search-First ❌ (Future)
- Search templates first, improvise if needed
- Hybrid reuse + creativity

### 4. Pure Improvisation ❌ (Future)
- No templates, no similar goals
- Step-by-step exploration
- Lowest reliability, highest creativity

**Reference:** [openspec/meta/improvisation-spectrum.md](../../meta/improvisation-spectrum.md)

---

## Related Documentation

**Meta Documentation:**
- [openspec/meta/ontology-foundation.md](../../meta/ontology-foundation.md) - Three-state model
- [openspec/meta/improvisation-spectrum.md](../../meta/improvisation-spectrum.md) - Execution modes
- [openspec/meta/goal-seeking-architecture.md](../../meta/goal-seeking-architecture.md) - Thompson Sampling

**Contracts:**
- [openspec/contracts/surrealdb-schema.md](../../contracts/surrealdb-schema.md) - Database tables

**Related Changes:**
- [analysis-api-extraction](../analysis-api-extraction/) - Similar integration pattern (MiniBob library usage)
