# Conversational Vessel - Design Specification

## Overview

A minimal vessel for ordinary LLM conversations that follows the impulse-activity foundation. Designed to be lightweight (~2,500 LOC), provider-agnostic via ai-sdk, and serve as a template for teaching MiniBob to create vessels.

## 1. Interface Boundaries

### 1.1 Core Interfaces

```
┌─────────────────────────────────────────────────────────────────┐
│                    Conversational Vessel                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Conversation                           │  │
│  │  ┌─────────┐   ┌──────────┐   ┌────────────────────────┐ │  │
│  │  │ ai-sdk  │──▶│ Messages │──▶│ Impulse Context Inject │ │  │
│  │  │ provider│   │  History │   │  (file, memo, custom)  │ │  │
│  │  └─────────┘   └──────────┘   └────────────────────────┘ │  │
│  │       │                              │                    │  │
│  │       ▼                              ▼                    │  │
│  │  ┌─────────┐   ┌──────────┐   ┌────────────────────────┐ │  │
│  │  │  Tools  │◀─▶│Tool Call │◀─▶│     Tool Handlers      │ │  │
│  │  │ Registry│   │   Loop   │   │ (bash, read, write...) │ │  │
│  │  └─────────┘   └──────────┘   └────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                     │
│                           ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Trace Recorder                          │  │
│  │   turn → trace → (optional) backend via MCP               │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow Boundaries

| Boundary | Input | Output | Transformation |
|----------|-------|--------|----------------|
| **User → Vessel** | Text message | N/A | Parse, validate |
| **Vessel → LLM** | Messages + Tools + Impulses | CompletionResult | ai-sdk format |
| **LLM → Tools** | ToolCall | ToolResult | Handler execution |
| **Vessel → Backend** | ExecutionTrace | Stored trace | MCP protocol |
| **Impulse Load** | Pointer | Content | Local resolver |

### 1.3 Service Boundaries

**Local Resolution (Vessel handles)**:
- `file` - Filesystem read with offset/limit
- `memo` - Embedded content passthrough
- `custom` - Registered resolver functions

**Backend Delegation (MCP)**:
- `activityExecutionTrace` - Historical traces
- `activityTemplate` - Template metadata
- `activityMetrics` - Performance data
- Any new type - Backend extensible

## 2. Database Schema Mapping

### 2.1 Required Tables (Minimal Set)

| Table | Purpose | Key Fields for Conversation |
|-------|---------|----------------------------|
| `connection` | Active session | `session_token`, `status`, `last_heartbeat` |
| `impulse` | Context data | `pointer`, `shape`, `content`, `token_estimate` |
| `execution` | Turn traces | `input_impulses`, `output_impulses`, `success`, `trace` |
| `vessel` | Vessel registration | `id`, `name`, `resolves`, `is_active` |

### 2.2 Field Sourcing

**From conversation turn**:
```typescript
// execution table
execution_id      ← generated UUID
activity_id       ← "conversation:turn"
input_impulses    ← [user_message_impulse_id, ...context_impulse_ids]
output_impulses   ← [assistant_message_impulse_id]
success           ← !error
duration_ms       ← end - start
cost_usd          ← usage.totalCost
tokens_in         ← usage.promptTokens
tokens_out        ← usage.completionTokens
trace             ← { messages, toolCalls, toolResults }
```

**From impulse creation**:
```typescript
// impulse table
id                ← generated UUID
pointer           ← { type: "memo", content: message }
shape             ← "conversation_message" | "file" | "tool_result"
summary           ← truncate(content, 100)
token_estimate    ← countTokens(content)
content           ← null (lazy) or materialized
```

### 2.3 Multi-Tenant Isolation

All tables include:
- `org_id` (record<organizations>) - Required
- `project_id` (record<projects>) - Optional scope
- `created_by` (record<users> | record<minibob_instance>)

PERMISSIONS enforce `WHERE org_id = $auth.org_id` at database level.

## 3. Reusable Components

### 3.1 Copy As-Is from MiniBob

| Component | LOC | Location | Why Reuse |
|-----------|-----|----------|-----------|
| `types.ts` | 380 | `src/types.ts` | Core type definitions, perfect abstraction |
| `llm.ts` | 250 | `src/llm.ts` | Direct Anthropic fallback if ai-sdk fails |
| `session.ts` | 150 | `src/session.ts` | Session tracking, minimal and complete |

### 3.2 Adapt from MiniBob

| Component | LOC | Changes Needed |
|-----------|-----|----------------|
| `tools.ts` | 400 | Remove boredom hooks, keep security validation |
| `impulse.ts` | 300 | Remove WebSocket callbacks, keep core resolver |

### 3.3 Build New

| Component | LOC | Purpose |
|-----------|-----|---------|
| `conversation.ts` | 400 | Message history, turn management, impulse injection |
| `ai-provider.ts` | 200 | ai-sdk provider abstraction |
| `trace-recorder.ts` | 150 | Turn → trace format, optional MCP reporting |
| `server.ts` | 300 | HTTP API, WebSocket streaming |

### 3.4 ai-sdk Integration

```typescript
import { generateText, streamText, tool } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'
import { google } from '@ai-sdk/google'

// Provider registry - extensible
const providers = {
  anthropic: (model: string) => anthropic(model),
  openai: (model: string) => openai(model),
  google: (model: string) => google(model),
}

// Tool conversion: our format → ai-sdk format
function convertTool(def: ToolDefinition): Parameters<typeof tool>[0] {
  return {
    description: def.description,
    parameters: z.object(def.parameters.properties),
    execute: async (params) => toolHandlers[def.name](params),
  }
}
```

## 4. Common Patterns to Colocate

### 4.1 Impulse-Context Pattern

Both conversation turns and activity tasks need:
- Lazy-load context on demand
- Enforce token budgets
- Format for LLM injection

**Colocate in**: `src/context/impulse-context.ts`

```typescript
interface ContextManager {
  loadImpulses(refs: ImpulseRef[], budget: number): Promise<LoadedImpulse[]>
  formatForPrompt(impulses: LoadedImpulse[]): string
  unload(impulseIds: string[]): void
}
```

### 4.2 Tool Execution Pattern

Tool definition + handler + security validation used everywhere.

**Colocate in**: `src/tools/`
```
tools/
  index.ts        # Registry and execution loop
  definitions.ts  # Tool schemas (shared)
  handlers/       # Individual handlers
    bash.ts
    read.ts
    write.ts
    edit.ts
  security.ts     # Command whitelist, path validation
```

### 4.3 Trace Recording Pattern

Every execution (conversation turn, activity task, tool call) produces trace.

**Colocate in**: `src/trace/`
```
trace/
  recorder.ts     # Generic trace capture
  formats.ts      # Trace schemas (conversation, activity, tool)
  reporter.ts     # Optional MCP backend sync
```

### 4.4 Message History Pattern

Conversation needs history. Activities need execution history. Same pattern.

**Colocate in**: `src/history/`
```
history/
  message-store.ts   # In-memory message history
  persistence.ts     # Optional local persistence
  truncation.ts      # Context window management
```

## 5. File Structure

```
repos/conversation-vessel/
├── .minibob/
│   └── vessel.json           # Vessel definition
├── src/
│   ├── index.ts              # Entry point, CLI
│   ├── server.ts             # HTTP/WebSocket server
│   ├── conversation.ts       # Core conversation logic
│   ├── ai-provider.ts        # ai-sdk abstraction
│   ├── context/
│   │   ├── impulse-context.ts
│   │   └── memory-agent.ts   # Token budget management
│   ├── tools/
│   │   ├── index.ts
│   │   ├── definitions.ts
│   │   ├── security.ts
│   │   └── handlers/
│   ├── trace/
│   │   ├── recorder.ts
│   │   ├── formats.ts
│   │   └── reporter.ts
│   ├── history/
│   │   ├── message-store.ts
│   │   └── truncation.ts
│   └── types.ts              # Shared types
├── package.json
├── tsconfig.json
└── README.md
```

## 6. Vessel Definition

```json
{
  "id": "conversation-vessel",
  "name": "Conversational Vessel",
  "version": "0.1.0",
  "description": "Lightweight vessel for LLM conversations",
  "development": {
    "enabled": true,
    "cacheStrategy": "local-first",
    "promotion": {
      "minExecutions": 5,
      "minSuccessRate": 0.8,
      "autoPromote": true
    }
  },
  "capabilities": {
    "tools": ["bash", "read", "write", "edit", "glob", "grep"],
    "impulses": ["file", "memo"],
    "activities": ["conversation:turn"]
  },
  "resolves": ["file", "memo"]
}
```

## 7. API Surface

### 7.1 HTTP Endpoints

```
POST /conversations              # Create new conversation
GET  /conversations/:id          # Get conversation state
POST /conversations/:id/turn     # Send message, get response
GET  /conversations/:id/history  # Get message history
DELETE /conversations/:id        # End conversation

POST /impulses                   # Create impulse
GET  /impulses/:id               # Load impulse content
DELETE /impulses/:id             # Remove impulse

GET  /health                     # Health check
```

### 7.2 WebSocket Protocol

```typescript
// Client → Server
{ type: "turn", conversationId: string, message: string }
{ type: "cancel", conversationId: string }

// Server → Client
{ type: "token", conversationId: string, token: string }
{ type: "tool_call", conversationId: string, tool: string, params: object }
{ type: "tool_result", conversationId: string, result: ToolResult }
{ type: "complete", conversationId: string, usage: Usage }
{ type: "error", conversationId: string, error: string }
```

## 8. Dependencies

### 8.1 Required

```json
{
  "dependencies": {
    "ai": "^4.0.0",
    "@ai-sdk/anthropic": "^1.0.0",
    "@ai-sdk/openai": "^1.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "@types/bun": "latest"
  }
}
```

### 8.2 Optional (for backend integration)

```json
{
  "@modelcontextprotocol/sdk": "^0.6.0"
}
```

## 9. Security Model

### 9.1 Tool Security (from MiniBob)

- **Command whitelist** - Only allowed commands execute
- **Path canonicalization** - Prevent directory traversal
- **Blocked patterns** - `rm -rf /`, fork bombs, etc.
- **Working directory** - All paths relative to vessel root

### 9.2 Conversation Security

- **Message sanitization** - No injection via user messages
- **Tool call validation** - Schema validation before execution
- **Rate limiting** - Max turns per minute (configurable)
- **Context isolation** - Each conversation isolated

## 10. Testing Strategy

### 10.1 Unit Tests

- Tool handlers (mock filesystem)
- Impulse resolution (mock content)
- Message formatting (deterministic)
- Trace recording (snapshot)

### 10.2 Integration Tests

- Full conversation turn (mock LLM)
- Tool execution loop (real filesystem)
- WebSocket streaming (real server)
- Backend sync (mock MCP)

### 10.3 E2E Tests

- Real LLM conversation (anthropic)
- Multi-provider (openai, google)
- Trace appears in dashboard
