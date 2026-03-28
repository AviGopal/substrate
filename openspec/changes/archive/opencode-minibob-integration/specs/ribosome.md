# Ribosome Specification (Backend-Focused)

**Component:** `repos/metabob-activity-api/src/routes/ribosome.ts`
**Status:** ⚠️ PARTIALLY IMPLEMENTED (backend extraction exists, session observation endpoint missing)
**Owner:** metabob-activity-api

---

## Purpose

Extract reusable activity templates from successful execution patterns. This is the **Instance → Vessel transformation** - the continuous loop that enables self-improvement.

## Ontological Context

```
Instance (execution trace)
       │
       │ Pattern recurs 3+ times
       ▼
   Ribosome (mechanical extraction)
       │
       │ Template synthesized
       ▼
Vessel (activity template)
       │
       │ Thompson Sampling recommends
       ▼
   Becoming (template execution)
       │
       ▼
Instance (new execution trace)
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     OpenCode Client                             │
│                                                                 │
│  Session Events (Bus)  ────────────────────────┐                │
│  - Session.Updated                             │                │
│  - Session.Diff (state changes)                │                │
│  - Tool calls (bash, read, write, edit)        │                │
│                                                 │                │
└─────────────────────────────────────────────────┼───────────────┘
                                                  │
                                                  │ MCP: observe_session()
                                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│              metabob-activity-api Backend                       │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  observe_session() - NEW ENDPOINT                        │  │
│  │  - Receive raw session events from OpenCode              │  │
│  │  - Store in session_events table                         │  │
│  │  - On session complete: convert to execution trace       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Trace Converter                                         │  │
│  │  - Parse session events                                  │  │
│  │  - Extract tool calls as tasks                           │  │
│  │  - Build state transitions (files modified/created)      │  │
│  │  - Calculate success/duration/cost                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Pattern Detection                                       │  │
│  │  - Check success criteria (success = true, tasks > 1)    │  │
│  │  - Count similar tool sequences                          │  │
│  │  - Require 3+ occurrences before extraction              │  │
│  │  - Check for duplicate templates                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Template Extraction (EXISTING)                          │  │
│  │  - Group tool calls into tasks                           │  │
│  │  - Generate prompt templates with variables              │  │
│  │  - Infer validation rules from outputs                   │  │
│  │  - Calculate confidence score                            │  │
│  │  - Store in activity_templates                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  SurrealDB Tables                                        │  │
│  │  - session_events (raw OpenCode events)                  │  │
│  │  - activity_execution_traces (converted traces)          │  │
│  │  - activity_templates (extracted templates)              │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## NEW: Session Observation Endpoint

**Purpose:** Receive raw session events from OpenCode, store them, and trigger trace conversion.

```typescript
// POST /v2/ribosome/observe-session
interface ObserveSessionRequest {
  sessionId: string;
  type: 'update' | 'diff' | 'complete' | 'error';
  timestamp: number;
  data: {
    // Session.Updated event
    parts?: Array<{
      type: 'text' | 'tool' | 'error';
      tool?: string;
      input?: unknown;
      output?: unknown;
      error?: string;
      duration?: number;
    }>;

    // Session.Diff event
    before?: Record<string, string>;  // File → hash
    after?: Record<string, string>;   // File → hash

    // Metadata
    directory?: string;
    title?: string;
    cost?: number;
    tokens?: { input: number; output: number; cache: number };
  };
}

interface ObserveSessionResponse {
  received: boolean;
  sessionId: string;
  eventType: string;
  traceConverted?: boolean;  // True if session completed and trace extracted
  templateExtracted?: boolean;  // True if pattern eligible for extraction
  templateId?: string;  // If template was created
}
```

**Implementation:**

```typescript
app.post('/observe-session', async (c) => {
  const event = await c.req.json<ObserveSessionRequest>();

  // Store raw event
  await surrealDB.query(`
    INSERT INTO session_events {
      session_id: $session_id,
      type: $type,
      timestamp: $timestamp,
      data: $data,
      received_at: time::now()
    }
  `, {
    session_id: event.sessionId,
    type: event.type,
    timestamp: event.timestamp,
    data: event.data
  });

  // If session complete, convert to trace
  if (event.type === 'complete') {
    const trace = await convertSessionToTrace(event.sessionId);

    await surrealDB.query(`
      INSERT INTO activity_execution_traces $trace
    `, { trace });

    // Check for extraction eligibility
    const eligible = await checkExtractionEligibility(trace);

    if (eligible) {
      const template = await extractTemplateFromTraces([trace]);

      await surrealDB.query(`
        INSERT INTO activity_templates $template
      `, { template });

      return c.json({
        received: true,
        sessionId: event.sessionId,
        eventType: event.type,
        traceConverted: true,
        templateExtracted: true,
        templateId: template.id
      });
    }

    return c.json({
      received: true,
      sessionId: event.sessionId,
      eventType: event.type,
      traceConverted: true,
      templateExtracted: false
    });
  }

  return c.json({
    received: true,
    sessionId: event.sessionId,
    eventType: event.type
  });
});
```

---

## Trace Conversion Algorithm

**Convert OpenCode session events → ActivityExecutionTrace:**

```typescript
interface ActivityExecutionTrace {
  execution_id: string;
  activity_id: string;
  variant_id: string;
  success: boolean;
  duration_ms: number;
  cost: number;
  tokens: { input: number; output: number; cache: number };
  tasks: Array<{
    task_id: string;
    description: string;
    tool: string;
    input: unknown;
    output: unknown;
    success: boolean;
    duration_ms: number;
  }>;
  state_snapshot: {
    input_state: {
      filesAvailable: string[];
      directory: string;
    };
    output_state: {
      filesModified: string[];
      filesCreated: string[];
      filesDeleted: string[];
    };
  };
  executed_at: string;
}

async function convertSessionToTrace(sessionId: string): Promise<ActivityExecutionTrace> {
  // Load all events for this session
  const events = await surrealDB.query<SessionEvent[]>(`
    SELECT * FROM session_events
    WHERE session_id = $session_id
    ORDER BY timestamp ASC
  `, { session_id: sessionId });

  // Extract tool calls from update events
  const toolCalls = events
    .filter(e => e.type === 'update' && e.data.parts)
    .flatMap(e => e.data.parts?.filter(p => p.type === 'tool') || []);

  // Convert to tasks
  const tasks = toolCalls.map((call, index) => ({
    task_id: `task-${index}`,
    description: inferDescription(call),
    tool: call.tool,
    input: call.input,
    output: call.output,
    success: !call.error,
    duration_ms: call.duration || 0
  }));

  // Extract state transitions from diff events
  const diffs = events.filter(e => e.type === 'diff');
  const firstDiff = diffs[0]?.data;
  const lastDiff = diffs[diffs.length - 1]?.data;

  const inputState = {
    filesAvailable: Object.keys(firstDiff?.before || {}),
    directory: events[0]?.data.directory || ''
  };

  const outputState = {
    filesModified: computeModified(firstDiff?.before, lastDiff?.after),
    filesCreated: computeCreated(firstDiff?.before, lastDiff?.after),
    filesDeleted: computeDeleted(firstDiff?.before, lastDiff?.after)
  };

  // Aggregate metadata
  const lastEvent = events[events.length - 1];
  const success = !events.some(e => e.type === 'error');
  const duration = lastEvent.timestamp - events[0].timestamp;

  return {
    execution_id: `opencode-${sessionId}`,
    activity_id: lastEvent.data.title || 'opencode-session',
    variant_id: sessionId,
    success,
    duration_ms: duration,
    cost: lastEvent.data.cost || 0,
    tokens: lastEvent.data.tokens || { input: 0, output: 0, cache: 0 },
    tasks,
    state_snapshot: { input_state: inputState, output_state: outputState },
    executed_at: new Date(events[0].timestamp).toISOString()
  };
}

function inferDescription(toolCall: ToolCall): string {
  switch (toolCall.tool) {
    case 'bash':
      return `Run command: ${toolCall.input?.command}`;
    case 'read':
      return `Read file: ${toolCall.input?.file_path}`;
    case 'write':
      return `Write file: ${toolCall.input?.file_path}`;
    case 'edit':
      return `Edit file: ${toolCall.input?.file_path}`;
    default:
      return `Execute ${toolCall.tool}`;
  }
}
```

---

## Extraction Eligibility Checks

**When to extract a template from a trace:**

```typescript
async function checkExtractionEligibility(trace: ActivityExecutionTrace): Promise<boolean> {
  // 1. Must be successful
  if (!trace.success) return false;

  // 2. Must have meaningful work (at least 2 tasks)
  if (trace.tasks.length < 2) return false;

  // 3. Must have state changes
  const hasChanges =
    trace.state_snapshot.output_state.filesModified.length > 0 ||
    trace.state_snapshot.output_state.filesCreated.length > 0;
  if (!hasChanges) return false;

  // 4. Check for duplicate templates
  const toolSeq = trace.tasks.map(t => t.tool).join(',');
  const existing = await surrealDB.query<Template[]>(`
    SELECT * FROM activity_templates
    WHERE tool_sequence = $tool_seq
    LIMIT 1
  `, { tool_seq: toolSeq });

  if (existing && existing.length > 0) {
    // Template already exists
    return false;
  }

  // 5. Check recurrence (needs 3+ occurrences)
  const count = await surrealDB.query<[{ count: number }]>(`
    SELECT COUNT(*) as count
    FROM activity_execution_traces
    WHERE tool_sequence = $tool_seq
    AND success = true
  `, { tool_seq: toolSeq });

  if (count[0].count < 3) {
    // Wait for more data
    return false;
  }

  // All checks passed - eligible for extraction
  return true;
}
```

---

## Template Extraction (EXISTING)

**Already implemented in `/repos/metabob-activity-api/src/routes/ribosome.ts`:**

- ✅ `POST /v2/ribosome/extract` - Extract template from execution IDs
- ✅ `POST /v2/ribosome/extract-from-session` - Extract from session ID
- ✅ `GET /v2/ribosome/candidates` - Find extraction candidates

**Key functions:**
- `extractTemplateFromTraces()` - Mechanical extraction (no LLM)
- `groupToolCallsIntoTasks()` - Group tool calls by category transitions
- `extractVariablesFromArgs()` - Pattern matching for variables
- `generatePromptTemplate()` - Template synthesis from tasks
- `extractValidation()` - Infer validation rules from successful traces
- `calculateConfidence()` - Confidence scoring based on traces

---

## Pattern Recurrence Detection

**Why 3+ occurrences:**

```
Occurrence 1: read → write → bash
  → Store trace, don't extract (might be one-off)

Occurrence 2: read → write → bash
  → Store trace, don't extract (still might be coincidence)

Occurrence 3: read → write → bash
  → EXTRACT! Pattern proven reliable (3+ is statistically significant)

Occurrence 4+:
  → Thompson Sampling recommends extracted template
  → Higher success rate = higher probability
```

**Benefits:**
- Avoids extracting one-off work
- Waits for pattern to prove itself through repetition
- Learns from measured recurrence, not reasoning

---

## Database Schema

**NEW: session_events table:**

```sql
DEFINE TABLE session_events SCHEMAFULL;

DEFINE FIELD session_id ON session_events TYPE string;
DEFINE FIELD type ON session_events TYPE string;  -- 'update', 'diff', 'complete', 'error'
DEFINE FIELD timestamp ON session_events TYPE number;
DEFINE FIELD data ON session_events TYPE object;
DEFINE FIELD received_at ON session_events TYPE datetime;

DEFINE INDEX idx_session_id ON session_events FIELDS session_id;
DEFINE INDEX idx_timestamp ON session_events FIELDS timestamp;
```

**EXISTING: activity_execution_traces table:**

```sql
DEFINE TABLE activity_execution_traces SCHEMAFULL;

DEFINE FIELD execution_id ON activity_execution_traces TYPE string;
DEFINE FIELD activity_id ON activity_execution_traces TYPE string;
DEFINE FIELD variant_id ON activity_execution_traces TYPE string;
DEFINE FIELD tool_sequence ON activity_execution_traces TYPE string;  -- For pattern matching
DEFINE FIELD success ON activity_execution_traces TYPE bool;
DEFINE FIELD tasks ON activity_execution_traces TYPE array;
DEFINE FIELD state_snapshot ON activity_execution_traces TYPE object;

DEFINE INDEX idx_tool_sequence ON activity_execution_traces FIELDS tool_sequence;
```

**EXISTING: activity_templates table:**

```sql
DEFINE TABLE activity_templates SCHEMAFULL;

DEFINE FIELD template_id ON activity_templates TYPE string;
DEFINE FIELD name ON activity_templates TYPE string;
DEFINE FIELD tool_sequence ON activity_templates TYPE string;  -- For similarity checks
DEFINE FIELD tasks ON activity_templates TYPE array;
DEFINE FIELD metadata.extracted ON activity_templates TYPE bool;
DEFINE FIELD metadata.extractedFrom ON activity_templates TYPE object;
DEFINE FIELD metadata.confidence ON activity_templates TYPE number;

DEFINE INDEX idx_tool_sequence ON activity_templates FIELDS tool_sequence;
```

---

## Testing Strategy

```typescript
// Test observe_session endpoint
test('observe_session stores raw events', async () => {
  const response = await fetch('http://api.minibob.local/v2/ribosome/observe-session', {
    method: 'POST',
    body: JSON.stringify({
      sessionId: 'test-session-1',
      type: 'update',
      timestamp: Date.now(),
      data: {
        parts: [{ type: 'tool', tool: 'bash', input: { command: 'ls' } }]
      }
    })
  });

  expect(response.ok).toBe(true);
  const json = await response.json();
  expect(json.received).toBe(true);
});

// Test trace conversion
test('convertSessionToTrace extracts tasks from events', async () => {
  // Seed events
  await seedSessionEvents('test-session-2', [
    { type: 'update', data: { parts: [{ type: 'tool', tool: 'read', input: { file_path: 'test.ts' } }] } },
    { type: 'update', data: { parts: [{ type: 'tool', tool: 'write', input: { file_path: 'test.ts' } }] } },
    { type: 'complete', data: {} }
  ]);

  const trace = await convertSessionToTrace('test-session-2');

  expect(trace.tasks).toHaveLength(2);
  expect(trace.tasks[0].tool).toBe('read');
  expect(trace.tasks[1].tool).toBe('write');
});

// Test extraction eligibility
test('checkExtractionEligibility requires 3+ occurrences', async () => {
  const trace = mockTrace('read,write,bash');

  // First occurrence
  await storeTrace(trace);
  expect(await checkExtractionEligibility(trace)).toBe(false);

  // Second occurrence
  await storeTrace({ ...trace, execution_id: 'exec-2' });
  expect(await checkExtractionEligibility(trace)).toBe(false);

  // Third occurrence - eligible!
  await storeTrace({ ...trace, execution_id: 'exec-3' });
  expect(await checkExtractionEligibility(trace)).toBe(true);
});

// Test template extraction
test('extractTemplateFromTraces generates valid template', async () => {
  const traces = [
    mockTrace('read,write,bash'),
    mockTrace('read,write,bash'),
    mockTrace('read,write,bash')
  ];

  const template = await extractTemplateFromTraces(traces);

  expect(template.tasks).toHaveLength(3);
  expect(template.confidence).toBeGreaterThan(0.5);
  expect(template.extractedFrom.traceCount).toBe(3);
});
```

---

## Implementation Status

**✅ COMPLETE:**
- Template extraction logic (`/v2/ribosome/extract`)
- Pattern grouping and task synthesis
- Variable extraction from tool args
- Validation inference from successful traces
- Confidence scoring

**⚠️ MISSING:**
- `POST /v2/ribosome/observe-session` endpoint
- `session_events` table schema
- Trace conversion algorithm
- Extraction eligibility checking (recurrence detection)
- Tool sequence indexing for pattern matching

**Estimated LOC:** ~150 lines (endpoint + conversion + eligibility)

---

## References

- [design.md](../design.md#7-trace-converter-backend) - Trace conversion architecture
- [openspec/meta/improvisation-spectrum.md](../../../meta/improvisation-spectrum.md#the-ribosome-pattern) - Ribosome pattern
- Existing backend: `/repos/metabob-activity-api/src/routes/ribosome.ts`
- Backend schema: `/repos/metabob-activity-api/sql/*.surql`
