# Conversational Vessel - Task List

## Commit Milestones

Each milestone represents a working, testable state.

---

## Milestone 1: Skeleton Vessel (Commit: `feat(vessel): scaffold conversational vessel`)

**Goal**: Basic vessel structure that MiniBob can recognize and work with.

### Tasks

- [ ] **1.1** Create `repos/conversation-vessel/` directory structure
  - Create `src/`, `.minibob/`
  - Files: `package.json`, `tsconfig.json`, `bun.lock`

- [ ] **1.2** Create vessel definition `.minibob/vessel.json`
  - id: "conversation-vessel"
  - version: "0.1.0"
  - resolves: ["file", "memo"]
  - development.enabled: true

- [ ] **1.3** Create entry point `src/index.ts`
  - Parse CLI args (--port, --model)
  - Log startup message
  - Export main function

- [ ] **1.4** Add dependencies to `package.json`
  - ai, @ai-sdk/anthropic, @ai-sdk/openai, zod
  - bun types, typescript

- [ ] **1.5** Verify MiniBob recognizes vessel
  - Run `minibob vessel list` - should show conversation-vessel
  - Run `bun run src/index.ts --help` - should show usage

**Testable**: `bun run src/index.ts` starts without error, MiniBob can discover vessel.

---

## Milestone 2: Core Types (Commit: `feat(vessel): add core type definitions`)

**Goal**: Type foundation copied/adapted from MiniBob.

### Tasks

- [ ] **2.1** Copy `types.ts` from MiniBob
  - Message, ToolDefinition, ToolResult, CompletionOptions
  - Adapt as needed for conversation focus

- [ ] **2.2** Create conversation-specific types in `src/types.ts`
  ```typescript
  interface Conversation {
    id: string
    messages: Message[]
    impulses: ImpulseRef[]
    metadata: ConversationMetadata
  }

  interface Turn {
    id: string
    userMessage: string
    assistantMessage: string
    toolCalls: ToolCall[]
    usage: Usage
    durationMs: number
  }
  ```

- [ ] **2.3** Create impulse types
  - ImpulsePointer (file, memo, custom)
  - Impulse (with loaded state)
  - ImpulseRef (pointer + budget + priority)

- [ ] **2.4** Create trace types
  - ConversationTrace (extends ExecutionTrace)
  - TurnTrace (per-turn detail)

**Testable**: `bun run typecheck` passes with no errors.

---

## Milestone 3: AI Provider Layer (Commit: `feat(vessel): implement ai-sdk provider abstraction`)

**Goal**: Can call any LLM via ai-sdk.

### Tasks

- [ ] **3.1** Create `src/ai-provider.ts`
  - Provider registry (anthropic, openai, google)
  - Model resolver (provider:model-id → ai-sdk model)
  - Default model configuration

- [ ] **3.2** Implement `generateResponse` function
  ```typescript
  async function generateResponse(opts: {
    model: string
    messages: CoreMessage[]
    tools?: Record<string, Tool>
    maxTokens?: number
  }): Promise<GenerateTextResult>
  ```

- [ ] **3.3** Implement `streamResponse` function
  - Same signature but returns AsyncIterable<TextStreamPart>
  - Handle tool calls mid-stream

- [ ] **3.4** Create provider test
  - Test with anthropic (claude-3-haiku)
  - Test with openai (gpt-4o-mini) if key available
  - Verify tool calling works

**Testable**: `bun test src/ai-provider.test.ts` passes, can generate text with real LLM.

---

## Milestone 4: Tool System (Commit: `feat(vessel): implement tool registry and handlers`)

**Goal**: Tools can be defined, called, and executed securely.

### Tasks

- [ ] **4.1** Create `src/tools/definitions.ts`
  - bash, read, write, edit, glob, grep
  - Convert to ai-sdk tool format

- [ ] **4.2** Create `src/tools/security.ts`
  - Command whitelist (from MiniBob)
  - Path validation (canonicalization)
  - Blocked pattern detection

- [ ] **4.3** Create tool handlers in `src/tools/handlers/`
  - `bash.ts` - Command execution
  - `read.ts` - File reading with offset/limit
  - `write.ts` - File creation
  - `edit.ts` - In-place replacement

- [ ] **4.4** Create `src/tools/index.ts`
  - Tool registry (name → handler)
  - Tool execution loop (handle multiple calls)
  - Security validation wrapper

- [ ] **4.5** Create tool tests
  - Test each handler
  - Test security validation (block dangerous commands)
  - Test tool loop (multi-turn tool calling)

**Testable**: `bun test src/tools/` passes, tools execute correctly.

---

## Milestone 5: Impulse Context (Commit: `feat(vessel): implement impulse loading and context injection`)

**Goal**: Context can be loaded lazily and injected into prompts.

### Tasks

- [ ] **5.1** Create `src/context/impulse-resolver.ts`
  - Resolve `file` pointer (read file with offset/limit)
  - Resolve `memo` pointer (passthrough)
  - Extensible resolver registry

- [ ] **5.2** Create `src/context/impulse-context.ts`
  - Load impulses within budget
  - Prioritize by priority field
  - Truncate to fit budget

- [ ] **5.3** Create `src/context/memory-agent.ts`
  - Track loaded impulses
  - Unload when not needed
  - Calculate token usage

- [ ] **5.4** Implement prompt formatting
  - Format loaded impulses as context block
  - Support pointer-mode (metadata only) and content-mode
  - Inject before user message

- [ ] **5.5** Create impulse tests
  - Test file loading
  - Test budget enforcement
  - Test priority ordering

**Testable**: `bun test src/context/` passes, impulses load and format correctly.

---

## Milestone 6: Conversation Core (Commit: `feat(vessel): implement conversation management`)

**Goal**: Can conduct multi-turn conversation with tools and context.

### Tasks

- [ ] **6.1** Create `src/conversation.ts`
  - ConversationManager class
  - Message history management
  - Impulse context injection

- [ ] **6.2** Implement `turn()` method
  ```typescript
  async turn(userMessage: string): Promise<Turn> {
    // 1. Create user message impulse
    // 2. Load context impulses
    // 3. Build messages array
    // 4. Call LLM with tools
    // 5. Execute tool calls
    // 6. Store assistant response
    // 7. Record trace
    // 8. Return turn result
  }
  ```

- [ ] **6.3** Create `src/history/message-store.ts`
  - In-memory message storage
  - Conversation isolation
  - Optional persistence

- [ ] **6.4** Create `src/history/truncation.ts`
  - Sliding window truncation
  - Summary-based truncation (future)
  - Token counting

- [ ] **6.5** Create conversation tests
  - Test single turn
  - Test multi-turn with history
  - Test tool calling during turn
  - Test impulse injection

**Testable**: `bun test src/conversation.ts` passes, can conduct full conversation.

---

## Milestone 7: Trace Recording (Commit: `feat(vessel): implement trace recording`)

**Goal**: Every turn produces a trace for learning.

### Tasks

- [ ] **7.1** Create `src/trace/formats.ts`
  - ConversationTrace schema
  - TurnTrace schema
  - Compatible with backend execution_trace table

- [ ] **7.2** Create `src/trace/recorder.ts`
  - Record turn start/end
  - Capture tool calls and results
  - Calculate metrics (duration, cost, tokens)

- [ ] **7.3** Create `src/trace/reporter.ts` (optional)
  - MCP client for backend sync
  - Batch reporting
  - Offline queue

- [ ] **7.4** Integrate with conversation
  - Record trace after each turn
  - Store locally in `.minibob/traces/`
  - Optional backend reporting

- [ ] **7.5** Create trace tests
  - Test trace format
  - Test local storage
  - Test backend reporting (mock)

**Testable**: `bun test src/trace/` passes, traces appear in `.minibob/traces/`.

---

## Milestone 8: HTTP Server (Commit: `feat(vessel): implement HTTP/WebSocket server`)

**Goal**: Vessel accessible via HTTP API and WebSocket.

### Tasks

- [ ] **8.1** Create `src/server.ts`
  - Bun.serve with routes
  - CORS configuration
  - Error handling

- [ ] **8.2** Implement HTTP endpoints
  - `POST /conversations` - Create
  - `GET /conversations/:id` - Get state
  - `POST /conversations/:id/turn` - Send message
  - `GET /conversations/:id/history` - Get history
  - `DELETE /conversations/:id` - End
  - `GET /health` - Health check

- [ ] **8.3** Implement WebSocket protocol
  - Connection handling
  - Message routing
  - Streaming response tokens

- [ ] **8.4** Create server tests
  - Test each endpoint
  - Test WebSocket streaming
  - Test error responses

**Testable**: `bun run src/index.ts --port 3000` serves API, `curl` commands work.

---

## Milestone 9: Integration & Polish (Commit: `feat(vessel): complete integration and documentation`)

**Goal**: Everything works together, documented, ready for MiniBob to use.

### Tasks

- [ ] **9.1** Create `src/index.ts` CLI
  - `conversation-vessel serve` - Start server
  - `conversation-vessel turn "message"` - Single turn CLI
  - `conversation-vessel --help` - Usage

- [ ] **9.2** Update vessel.json
  - List all capabilities
  - Configure development settings
  - Set promotion thresholds

- [ ] **9.3** Create README.md
  - Installation
  - Usage examples
  - API documentation
  - Configuration

- [ ] **9.4** Run full integration test
  - Start server
  - Create conversation
  - Send multiple turns
  - Verify traces recorded
  - Verify tools executed

- [ ] **9.5** Test with MiniBob
  - MiniBob discovers vessel
  - MiniBob can create activities for vessel
  - MiniBob can execute activities

**Testable**: Full conversation flow works, MiniBob can interact with vessel.

---

## Milestone 10: Activity Templates (Commit: `feat(vessel): add conversation activity templates`)

**Goal**: Reusable activities for common conversation patterns.

### Tasks

- [ ] **10.1** Create `templates/conversation-turn.json`
  - Basic turn activity
  - Variables: message, model, impulse_refs

- [ ] **10.2** Create `templates/code-review.json`
  - Code review conversation pattern
  - Pre-loads file impulses
  - Structured output

- [ ] **10.3** Create `templates/debug-session.json`
  - Debugging conversation pattern
  - Error analysis impulses
  - Tool-heavy interaction

- [ ] **10.4** Register templates with vessel
  - Local template storage
  - Thompson Sampling integration
  - Promotion to backend

**Testable**: Activities appear in MiniBob, can be executed via goal processor.

---

## Summary

| Milestone | Commit Message | LOC (est) | Key Deliverable |
|-----------|---------------|-----------|-----------------|
| 1 | `feat(vessel): scaffold conversational vessel` | 100 | Discoverable vessel |
| 2 | `feat(vessel): add core type definitions` | 250 | Type foundation |
| 3 | `feat(vessel): implement ai-sdk provider abstraction` | 200 | LLM calling |
| 4 | `feat(vessel): implement tool registry and handlers` | 400 | Tool execution |
| 5 | `feat(vessel): implement impulse loading and context injection` | 300 | Context loading |
| 6 | `feat(vessel): implement conversation management` | 400 | Core conversation |
| 7 | `feat(vessel): implement trace recording` | 200 | Learning traces |
| 8 | `feat(vessel): implement HTTP/WebSocket server` | 350 | API server |
| 9 | `feat(vessel): complete integration and documentation` | 200 | Polish |
| 10 | `feat(vessel): add conversation activity templates` | 100 | Activity templates |
| **Total** | | **~2,500** | |

---

## MiniBob Development Notes

This vessel is designed to be developed **by MiniBob**. Each milestone should be:

1. **Small enough** for MiniBob to complete in one session
2. **Testable** so MiniBob can verify success
3. **Buildable** on previous milestone (dependencies clear)

MiniBob should approach each milestone as a goal:
```
"Implement Milestone 1: Scaffold conversational vessel"
```

MiniBob will:
1. Read the task list for that milestone
2. Search for existing patterns (in minibob, ai-sdk)
3. Implement each task
4. Run tests to verify
5. Commit when milestone complete
6. Move to next milestone
